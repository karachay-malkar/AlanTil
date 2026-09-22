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

test('16.7 Web auth release refreshes the service-worker cache namespace', () => {
  const serviceWorker = read('service-worker.js');
  assert.match(serviceWorker, /const VERSION = "16\.7\.0\.15";/);
});

test('16.7 Web auth keeps callback initialization blocking and singleton import mapping', () => {
  const auth = read('src/shared/auth/auth-service.js');
  const index = read('index.html');
  assert.match(auth, /export async function initializeAuth\(\)\s*\{\s*return startAuthInitialization\(\);\s*\}/);
  assert.equal((auth.match(/exchangeCodeForSession\(/g) || []).length, 1);
  assert.match(index, /const targetVersion = "16\.7\.0\.15";/);
  assert.match(index, /\/src\/shared\/auth\/auth-service\.js/);
});
