import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeUserSettings, settingsCloudPayload } from '../packages/alantil-core/settings.js';
import { filterNickname, normalizeAvatarGender, validateNickname } from '../packages/alantil-core/profile.js';
import { filterSongs, pairLyrics, parseLyricsBlocks, tokenizeSongLine } from '../packages/alantil-core/songs.js';
import { interfaceLocale, interpolateMessage, normalizeInterfaceLanguage } from '../packages/alantil-core/i18n.js';

test('shared settings preserve the common language and writing contract', () => {
  const settings = normalizeUserSettings({
    interface_language_code: 'tr',
    translation_language_code: 'en',
    alan_script_code: 'turkic',
    alan_dialect_code: 'karachay',
    text_size_code: 'large',
    onboarding_step: 'guide',
    onboarding_access_mode: 'guest',
  });
  assert.equal(settings.interface_language_code, 'tr');
  assert.equal(settings.translation_language_code, 'en');
  assert.equal(settings.alan_script_code, 'turkic');
  assert.equal(settings.alan_dialect_code, 'karachay');
  assert.equal(settings.text_size_code, 'large');
  assert.equal(settings.onboarding_step, 'guide');
  assert.equal(settings.onboarding_access_mode, 'guest');
  assert.equal('onboarding_step' in settingsCloudPayload(settings, 'u1'), false);
});

test('profile validation is identical for Web and Mobile adapters', () => {
  assert.equal(filterNickname('ab!c_123456789012345'), 'abc_12345678901');
  assert.deepEqual(validateNickname('abc_1'), { nickname: 'abc_1', valid: true, reason: null });
  assert.equal(validateNickname('12_').reason, 'requirements');
  assert.equal(normalizeAvatarGender(' Female '), 'female');
});

test('songs parse repeated chorus, pair lines and search consistently', () => {
  const lyrics = 'Куплет 1:\nLine one\n\nПрипев:\nChorus one\n\nПрипев:';
  const blocks = parseLyricsBlocks(lyrics);
  assert.equal(blocks.length, 3);
  assert.equal(blocks[2].type, 'chorus');
  assert.equal(blocks[2].repeated, true);
  assert.equal(pairLyrics(lyrics, 'Verse:\nOne').length, 3);
  assert.equal(tokenizeSongLine("Alan'ga, bar!").filter((token) => token.wordLike).length, 2);
  assert.equal(filterSongs([{ title: 'Mountain Song', artist: 'A', lyrics: 'B' }], 'mountain', 'title').length, 1);
});

test('i18n policy normalizes locales and interpolates parameters', () => {
  assert.equal(normalizeInterfaceLanguage('tu-TR'), 'tr');
  assert.equal(normalizeInterfaceLanguage('de'), 'ru');
  assert.equal(interfaceLocale('en'), 'en-GB');
  assert.equal(interpolateMessage('Step {current}/{total}', { current: 1, total: 3 }), 'Step 1/3');
});
