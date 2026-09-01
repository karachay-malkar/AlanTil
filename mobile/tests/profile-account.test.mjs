import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { filterNickname, providerLabel, validateNickname } from '../src/mobile/profile/policy.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('nickname policy matches the web account contract', () => {
  assert.deepEqual(validateNickname('Alan_14'), { nickname: 'Alan_14', valid: true, reason: null });
  assert.equal(validateNickname('12_').valid, false);
  assert.equal(validateNickname('абв').valid, false);
  assert.equal(validateNickname('ab').valid, false);
  assert.equal(validateNickname('abcdefghijklmnop').valid, false);
  assert.equal(filterNickname('a л@a-n_123456789012345'), 'aan_12345678901');
  assert.equal(providerLabel({ provider: 'google' }), 'Google');
});

test('account creation debounces availability checks and avatar choice is one-time', async () => {
  const [screen, repository] = await Promise.all([
    read('src/mobile/profile/account-screen.tsx'),
    read('src/mobile/profile/repository.ts'),
  ]);
  assert.match(screen, /setTimeout\(\(\) => \{/);
  assert.match(screen, /\}, 500\)/);
  assert.match(screen, /await checkNickname\(nickname\)/);
  assert.match(screen, /account\.nickname_available/);
  assert.match(screen, /account\.nickname_taken/);
  assert.match(repository, /rpc\('is_nickname_available'/);
  assert.match(repository, /\.is\('avatar_gender', null\)/);
});

test('profile root is locked for guests and opens a selected Path story', async () => {
  const [route, home, path] = await Promise.all([
    read('app/(tabs)/profile/index.tsx'),
    read('src/mobile/profile/home-screen.tsx'),
    read('src/mobile/path.tsx'),
  ]);
  assert.match(route, /profile\/home-screen/);
  assert.match(home, /!auth\.user/);
  assert.match(home, /profile\.locked/);
  assert.match(home, /loadStoryProgress/);
  assert.match(home, /storyRequest: String\(Date\.now\(\)\)/);
  assert.doesNotMatch(home, /auth\.user\.email/);
  assert.match(path, /appliedStoryRequestRef/);
  assert.match(path, /bundle\.route\.stories\[requestedStoryId\]/);
});
