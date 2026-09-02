import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, '..');
const root = path.resolve(mobile, '..');
const read = (relative) => fs.readFileSync(path.join(mobile, relative), 'utf8');
const readRoot = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const visual = read('ui/web-visual-source.js');
const parity = read('ui/parity.js');
const profile = read('screens/profile-main.js');
const practice = read('screens/practice.js');
const pathScreen = read('screens/path.js');
const station = read('screens/station.js');
const dictionary = read('platform/dictionary.js');
const app = JSON.parse(read('app.json'));
const pkg = JSON.parse(read('package.json'));

const requiredWebSources = [
  'src/shared/styles/theme.css','src/shared/styles/typography.css','src/shared/styles/shell.css','src/shared/styles/chrome.css',
  'src/shared/styles/components.css','src/shared/styles/paper-components.css','src/shared/styles/segmented-control.css','src/shared/styles/table-system.css',
  'src/features/path/path.css','src/features/profile/profile.css','src/features/settings/settings.css','src/features/practice/practice.css',
  'src/features/learn/learn.css','src/features/test/test.css','src/features/match/match.css','src/features/songs/songs.css','src/features/onboarding/onboarding.css',
];

test('16.6 visual manifest covers canonical Web 13.15.12 system and feature sources', () => {
  for (const source of requiredWebSources) assert.match(visual, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(visual, /WEB_VISUAL_SOURCES\.features/);
});

test('Expo Web bundled dictionary is storage-independent', () => {
  assert.match(dictionary, /async function writeCache\(snapshot\)\{try\{/);
  assert.match(dictionary, /if\(bundled\)\{installed=bundled;writeCache\(bundled\)\.catch\(\(\)=>\{\}\);refreshNativeDictionary\(\)\.catch/);
  assert.doesNotMatch(dictionary, /if\(bundled\)\{installed=bundled;await writeCache/);
});

test('Settings follows the Web flat-page composition', () => {
  for (const token of ['Настройки','Сохранить','Языковые настройки','Язык интерфейса','Алфавит аланских слов','Вариант кириллицы','Версия словаря','Текущая','Актуальная','Обновить','Благодарности','Версия приложения','Политика конфиденциальности']) assert.ok(profile.includes(token), token);
  assert.match(profile, /settingsScroll: \{[^}]*maxWidth: 620/s);
  assert.match(profile, /settingRow: \{[^}]*minHeight: 46/s);
  assert.match(profile, /settingsLearningPreview: \{[^}]*height: 180/s);
  assert.match(profile, /versionFlatRow: \{[^}]*minHeight: 42/s);
  assert.doesNotMatch(profile.slice(profile.indexOf('function SettingsPane'), profile.indexOf('export function ProfileMainArea')), /SurfaceCard/);
});

test('Profile uses canonical avatar assets instead of synthetic geometry', () => {
  assert.match(profile, /avatar_male\.png/);
  assert.match(profile, /avatar_female\.png/);
  assert.doesNotMatch(profile, /avatarHead|avatarBody/);
});

test('Practice uses Web-like flat menu rows rather than a rounded card shell', () => {
  assert.match(practice, /<SurfaceCard flat/);
  assert.match(parity, /surfaceFlat:/);
  assert.match(practice, /borderTopWidth: 1/);
});

test('Path and Station preserve canonical route and compact row geometry', () => {
  assert.match(pathScreen, /POSITION_PATTERN\s*=\s*\[-1,\s*0,\s*1\]/);
  assert.match(pathScreen, /scaleDot: \{[^}]*width: 4[^}]*height: 4/s);
  assert.match(pathScreen, /scaleDiamond: \{[^}]*width: 8[^}]*height: 8/s);
  assert.match(station, /wordRow: \{[^}]*minHeight: 52/s);
  assert.match(station, /Учить слова/);
  assert.match(station, /Завершить этап: тест/);
});

test('16.6 version is coherent across Expo and package metadata', () => {
  assert.equal(app.expo.version, '16.6.0');
  assert.equal(pkg.version, '16.6.0');
  assert.equal(app.expo.extra.releaseVersion, '16.6.0');
  assert.equal(app.expo.android.versionCode, 23);
  assert.equal(app.expo.ios.buildNumber, '23');
});

test('Web reference Settings source still matches the geometry targeted by Mobile', () => {
  const css = readRoot('src/features/settings/settings.css');
  assert.match(css, /width:min\(100%,620px\)/);
  assert.match(css, /min-height:46px/);
  assert.match(css, /height:180px/);
});
