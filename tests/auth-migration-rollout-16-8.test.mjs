import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

test('16.8 auth migration logs out only persisted pre-migration sessions and opens account UI',()=>{
  const client=read('src/shared/auth/supabase-client.js');
  const bootstrap=read('src/app/bootstrap.js');
  assert.match(client,/AUTH_MIGRATION_STORAGE_KEY = "alantil_auth_migration_v1"/);
  assert.match(client,/applyOneTimeAuthMigration/);
  assert.match(client,/localStorage\.removeItem\(AUTH_STORAGE_KEY\)/);
  assert.match(bootstrap,/applyOneTimeAuthMigration\(\{ preserveSession: callbackVisit \}\)/);
  assert.match(bootstrap,/authMigrationRequired[\s\S]*\/profile\/account/);
  assert.match(bootstrap,/!persistedAuth && !authMigrationRequired/);
});

test('mobile migration is one-time, preserves callbacks and forces the auth choice for affected users',()=>{
  const nativeAuth=read('mobile/platform/auth.native.js');
  const webAuth=read('mobile/platform/auth.web.js');
  const facade=read('mobile/platform/auth.js');
  const appRoot=read('mobile/AppRoot.js');
  assert.match(nativeAuth,/AUTH_MIGRATION_KEY='alantil:16\.8:auth-migration-v1'/);
  assert.match(nativeAuth,/NATIVE_SUPABASE_AUTH_STORAGE_KEY/);
  assert.match(nativeAuth,/preserveSession:initialUrl\.startsWith\(NATIVE_AUTH_REDIRECT_URL\)/);
  assert.match(nativeAuth,/consumeNativeAuthMigrationRequired/);
  assert.match(webAuth,/WEB_SUPABASE_AUTH_STORAGE_KEY/);
  assert.match(webAuth,/applyOneTimeAuthMigration\(\{preserveSession:callbackVisit\}\)/);
  assert.match(facade,/consumeNativeAuthMigrationRequired/);
  assert.match(appRoot,/authMigrationRequired=consumeNativeAuthMigrationRequired\(\)/);
  assert.match(appRoot,/setAuthChoiceRequired\(Boolean\(authMigrationRequired\|\|/);
});

test('legacy Google password setup keeps the original user id and explains the transition',()=>{
  const auth=read('src/shared/auth/auth-service.js');
  const nativeAuth=read('mobile/platform/auth.native.js');
  const messages=read('src/shared/i18n/messages.js');
  assert.match(auth,/flow === "legacy_google"[\s\S]*updatedUserId !== originalUserId/);
  assert.match(nativeAuth,/flow==='legacy_google'&&originalUserId&&updatedUserId!==originalUserId/);
  assert.match(messages,/По техническим причинам вход через Google больше недоступен/);
  assert.match(messages,/Все ваши данные, прогресс и достижения сохранятся/);
});
