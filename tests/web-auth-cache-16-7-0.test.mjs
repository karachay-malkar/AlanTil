import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('16.7 Web OAuth starts through the initialized Supabase client', () => {
  const auth = read('src/shared/auth/auth-service.js');
  assert.match(auth, /client\.auth\.signInWithOAuth\(/);
  assert.match(auth, /skipBrowserRedirect:\s*true/);
  assert.match(auth, /redirectTo:\s*getAuthRedirectUrl\(\)/);
  assert.doesNotMatch(auth, /function persistPkceVerifier\(/);
  assert.doesNotMatch(auth, /function buildOAuthRedirectUrl\(/);
});

function currentWebBuild() {
  const index = read('index.html');
  const meta = index.match(/<meta name="alantil-build" content="([^"]+)"/);
  const target = index.match(/const targetVersion = "([^"]+)"/);
  assert.ok(meta, 'index.html must expose alantil-build');
  assert.ok(target, 'index.html must expose targetVersion');
  assert.equal(target[1], meta[1], 'import-map target must match the declared build');
  return { build: meta[1], index };
}

test('Web auth release keeps the service-worker cache namespace aligned with the declared build', () => {
  const serviceWorker = read('service-worker.js');
  const { build } = currentWebBuild();
  assert.ok(serviceWorker.includes(`const VERSION = "${build}";`));
});

test('Web auth keeps callback initialization blocking and singleton import mapping', () => {
  const auth = read('src/shared/auth/auth-service.js');
  const { index } = currentWebBuild();
  assert.match(auth, /export async function initializeAuth\(\)\s*\{\s*return startAuthInitialization\(\);\s*\}/);
  assert.equal((auth.match(/exchangeCodeForSession\(/g) || []).length, 1);
  assert.match(index, /\/src\/shared\/auth\/auth-service\.js/);
});
