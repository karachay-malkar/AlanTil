import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { adminAlanWord, adminTranslation, boundedProgress } from '../src/mobile/profile/admin-policy.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const settings = (updates = {}) => ({
  interface_language_code: 'ru',
  translation_language_code: 'ru',
  alan_script_code: 'cyrillic',
  alan_dialect_code: 'canonical',
  ...updates,
});

test('admin word rendering follows the current script, dialect and language', () => {
  const row = {
    word_alan_cyrillic: 'Җол',
    word_alan_turkic: 'Col',
    translation_ru: 'дорога',
    translation_en: 'road',
    translation_tr: 'yol',
  };
  assert.equal(adminAlanWord(row, settings()), 'Җол');
  assert.equal(adminAlanWord(row, settings({ alan_dialect_code: 'karachay' })), 'Джол');
  assert.equal(adminAlanWord(row, settings({ alan_script_code: 'turkic' })), 'Col');
  assert.equal(adminTranslation(row, settings({ interface_language_code: 'en' })), 'road');
});

test('admin story progress is clamped and never divides by zero', () => {
  assert.deepEqual(boundedProgress(3, 4), { passed: 3, total: 4, percent: 75 });
  assert.deepEqual(boundedProgress(8, 4), { passed: 8, total: 4, percent: 100 });
  assert.deepEqual(boundedProgress(-2, 0), { passed: 0, total: 0, percent: 0 });
});

test('admin repositories use only protected activity RPCs', async () => {
  const repository = await read('src/mobile/profile/admin-repository.ts');
  assert.match(repository, /admin_user_activity_list/);
  assert.match(repository, /admin_user_activity_detail/);
  assert.match(repository, /admin_user_test_history/);
  assert.match(repository, /admin_user_favorites/);
  assert.match(repository, /admin_station_test_detail/);
  assert.match(repository, /isActivityAccessDenied/);
});

test('users tab is conditional and all admin mobile routes exist', async () => {
  const [navigation, screens, listRoute, userRoute, historyRoute, favoritesRoute, testRoute] = await Promise.all([
    read('src/mobile/profile/navigation.tsx'),
    read('src/mobile/profile/admin-screens.tsx'),
    read('app/(tabs)/profile/users/index.tsx'),
    read('app/(tabs)/profile/users/[userId].tsx'),
    read('app/(tabs)/profile/users/history.tsx'),
    read('app/(tabs)/profile/users/favorites.tsx'),
    read('app/(tabs)/profile/users/test.tsx'),
  ]);
  assert.match(navigation, /profile\?\.activity_access === true/);
  assert.match(navigation, /activityAccess \? \[/);
  assert.match(screens, /AdminUsersScreen/);
  assert.match(screens, /AdminUserScreen/);
  assert.match(screens, /AdminHistoryScreen/);
  assert.match(screens, /AdminFavoritesScreen/);
  assert.match(screens, /AdminTestScreen/);
  assert.match(listRoute, /AdminUsersScreen/);
  assert.match(userRoute, /AdminUserScreen/);
  assert.match(historyRoute, /AdminHistoryScreen/);
  assert.match(favoritesRoute, /AdminFavoritesScreen/);
  assert.match(testRoute, /AdminTestScreen/);
});
