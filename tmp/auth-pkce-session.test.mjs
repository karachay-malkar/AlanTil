import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUTH_STORAGE_KEY = 'alantil_auth_session_v1';

function memoryStorage(shared = new Map()) {
  return {
    getItem(key) { return shared.has(key) ? shared.get(key) : null; },
    setItem(key, value) { shared.set(key, String(value)); },
    removeItem(key) { shared.delete(key); },
  };
}

function readVendorSource() {
  const metadata = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp/vendor/metadata.json'), 'utf8'));
  const encoded = [1, 2, 3, 4]
    .map((index) => fs.readFileSync(path.join(ROOT, `tmp/vendor/payload-${index}.txt`), 'utf8').trim())
    .join('');
  const source = gunzipSync(Buffer.from(encoded, 'base64'));
  assert.equal(metadata.version, '2.110.7');
  assert.equal(createHash('sha256').update(source).digest('hex'), metadata.sha256);
  assert.match(source.toString('utf8'), /export const createClient = supabase\.createClient;/);
  return source.toString('utf8');
}

async function loadVendor() {
  const source = readVendorSource();
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  const sdk = await import(dataUrl);
  assert.equal(typeof sdk.createClient, 'function');
  return sdk;
}

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function createClient(createClient, storage, fetchImpl) {
  return createClient('https://project.supabase.co', 'test-publishable-key', {
    auth: {
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: AUTH_STORAGE_KEY,
      storage,
    },
    global: { fetch: fetchImpl },
  });
}

test('vendored Supabase 2.110.7 survives reload and exchanges one PKCE code for a persisted user session', async () => {
  const { createClient: factory } = await loadVendor();
  const shared = new Map();
  const storage = memoryStorage(shared);
  const unexpectedFetch = async (input) => { throw new Error(`Unexpected OAuth-start fetch: ${String(input)}`); };
  const firstClient = createClient(factory, storage, unexpectedFetch);

  const start = await firstClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'https://alantil.ru/auth/callback',
      skipBrowserRedirect: true,
    },
  });
  assert.ifError(start.error);
  assert.match(String(start.data?.url || ''), /\/auth\/v1\/authorize/);
  const verifierEntry = [...shared.entries()].find(([key]) => key.includes('code-verifier'));
  assert.ok(verifierEntry?.[1], 'OAuth start must persist a PKCE code verifier');

  let tokenExchangeCount = 0;
  let exchangeBody = null;
  const now = Math.floor(Date.now() / 1000);
  const accessToken = jwt({ sub: 'user-1', aud: 'authenticated', role: 'authenticated', iat: now, exp: now + 3600 });
  const exchangeFetch = async (input, init = {}) => {
    const url = String(input);
    if (!url.includes('/auth/v1/token?grant_type=pkce')) throw new Error(`Unexpected callback fetch: ${url}`);
    tokenExchangeCount += 1;
    exchangeBody = JSON.parse(String(init.body || '{}'));
    return new Response(JSON.stringify({
      access_token: accessToken,
      refresh_token: 'refresh-token',
      token_type: 'bearer',
      expires_in: 3600,
      user: {
        id: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
        email: 'pkce@example.com',
        app_metadata: { provider: 'google', providers: ['google'] },
        user_metadata: {},
        identities: [],
        created_at: new Date(now * 1000).toISOString(),
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const callbackClient = createClient(factory, storage, exchangeFetch);
  const result = await callbackClient.auth.exchangeCodeForSession('auth-code');
  assert.ifError(result.error);
  assert.equal(tokenExchangeCount, 1);
  assert.equal(exchangeBody.auth_code, 'auth-code');
  assert.ok(exchangeBody.code_verifier, 'callback must reuse the verifier written before navigation');
  assert.equal(result.data.session.user.id, 'user-1');

  const restored = await callbackClient.auth.getSession();
  assert.ifError(restored.error);
  assert.equal(restored.data.session.user.id, 'user-1');
  assert.ok(storage.getItem(AUTH_STORAGE_KEY), 'session must be persisted under the application auth storage key');
});

test('PKCE callback without a verifier returns an explicit auth error instead of a session', async () => {
  const { createClient: factory } = await loadVendor();
  const storage = memoryStorage(new Map());
  let tokenExchangeCount = 0;
  const client = createClient(factory, storage, async () => {
    tokenExchangeCount += 1;
    return new Response(JSON.stringify({
      error: 'invalid_grant',
      error_description: 'PKCE code verifier is missing',
    }), { status: 400, headers: { 'content-type': 'application/json' } });
  });

  const result = await client.auth.exchangeCodeForSession('auth-code-without-verifier');
  assert.equal(result.data?.session || null, null);
  assert.ok(result.error);
  assert.match(String(result.error.message || result.error), /pkce|verifier/i);
  assert.ok(tokenExchangeCount <= 1, 'missing verifier must never trigger repeated token exchanges');
});
