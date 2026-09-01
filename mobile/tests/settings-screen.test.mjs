import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('settings use an explicit draft, save action and unsaved-change guard', async () => {
  const [screen, layout] = await Promise.all([
    read('src/mobile/profile/settings-screen.tsx'),
    read('app/(tabs)/profile/_layout.tsx'),
  ]);
  assert.match(screen, /const \[draft, setDraft\] = useState<SettingsDraft>/);
  assert.match(screen, /const dirty = !sameDraft\(draft, storedDraft\)/);
  assert.match(screen, /Alert\.alert\(t\('settings\.unsaved_title'\)/);
  assert.match(screen, /hardwareBackPress/);
  assert.match(screen, /await save\(draft\)/);
  assert.match(layout, /name="settings" options=\{\{ gestureEnabled: false \}\}/);
});

test('interface language owns translation language and text size has a preview', async () => {
  const screen = await read('src/mobile/profile/settings-screen.tsx');
  assert.match(screen, /interface_language_code: value, translation_language_code: value/);
  assert.match(screen, /text_size_code/);
  assert.match(screen, /previewScale/);
  assert.match(screen, /settings\.text_small/);
  assert.match(screen, /settings\.text_medium/);
  assert.match(screen, /settings\.text_large/);
});

test('dictionary status supports installed/latest versions and a manual update', async () => {
  const [screen, dictionary, account] = await Promise.all([
    read('src/mobile/profile/settings-screen.tsx'),
    read('src/mobile/dictionary.ts'),
    read('src/mobile/profile/account-screen.tsx'),
  ]);
  assert.match(dictionary, /export async function getDictionaryStatus/);
  assert.match(dictionary, /installedVersion/);
  assert.match(dictionary, /latestVersion/);
  assert.match(screen, /refreshDictionary\(\{ force: true \}\)/);
  assert.match(screen, /settings\.update_dictionary/);
  assert.doesNotMatch(account, /Apple Sign In будет включён/);
});
