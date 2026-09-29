import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('guest state is captured before switching to an account scope', async () => {
  const source = await read('src/shared/progress/progress-sync.js');
  const start = source.indexOf('async function activateScopeForUser');
  const end = source.indexOf('function bindSynchronizationEvents', start);
  const block = source.slice(start, end);
  const capture = block.indexOf('captureGuestClaimSnapshot(userId)');
  const switchScope = block.indexOf('setStorageScope(userId)');
  assert.ok(capture >= 0 && switchScope > capture);
});

test('guest claim waits for a successful cloud pull and preserves existing cloud settings', async () => {
  const source = await read('src/shared/progress/progress-sync.js');
  const start = source.indexOf('async function synchronizeActiveScope');
  const end = source.indexOf('async function activateScopeForUser', start);
  const block = source.slice(start, end);
  assert.match(block, /const pulled = await pullCloudProgress\(\)/);
  assert.ok(block.indexOf('if (!pulled)') < block.indexOf('claimGuestData(userId'));
  assert.match(block, /preserveUserSettings: Boolean\(cloudState\?\.hasUserSettings\)/);
  assert.match(source, /sourceEntries\.filter\(\(entry\) => entry\.type !== "user_settings"\)/);
});

test('guest cleanup has an explicit migration-only path after account activation', async () => {
  const [sync, scope] = await Promise.all([
    read('src/shared/progress/progress-sync.js'),
    read('src/shared/progress/storage-scope.js'),
  ]);
  assert.match(scope, /export function removeScopedValueForMigration/);
  assert.match(sync, /removeScopedValueForMigration\(key, STORAGE_SCOPES\.GUEST\)/);
  assert.match(sync, /WORD_PROGRESS_LOCAL_KEY, PROGRESS_QUEUE_KEY/);
});
