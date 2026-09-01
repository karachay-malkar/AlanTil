import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('release version is aligned across Expo, npm and lockfile', async () => {
  const [app, pkg, lock] = await Promise.all([
    read('app.json').then(JSON.parse),
    read('package.json').then(JSON.parse),
    read('package-lock.json').then(JSON.parse),
  ]);
  assert.equal(app.expo.version, '15.0.1');
  assert.equal(app.expo.extra.releaseVersion, '15.0.1');
  assert.equal(app.expo.extra.visualParity, '15.0.1-web-path-parity-4options-final');
  assert.equal(app.expo.android.versionCode, 9);
  assert.equal(app.expo.ios.buildNumber, '9');
  assert.equal(pkg.version, '15.0.1');
  assert.equal(lock.version, '15.0.1');
  assert.equal(lock.packages[''].version, '15.0.1');
  assert.equal(pkg.scripts.test, 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test tests/*.test.mjs');
  const runtimeVersion = await read('src/mobile/version.ts');
  assert.match(runtimeVersion, /expoConfig\?\.version/);
  assert.match(runtimeVersion, /expoConfig\?\.extra\?\.releaseVersion/);
  for (const path of [
    'src/mobile/profile/home-screen.tsx',
    'src/mobile/profile/document-screens.tsx',
    'src/mobile/profile/settings-screen.tsx',
    'src/mobile/visitor-analytics.ts',
  ]) {
    assert.doesNotMatch(await read(path), /14\.2\.0/);
  }
});

test('native OAuth returns through the app callback and exchanges PKCE once', async () => {
  const [app, pkg, source] = await Promise.all([
    read('app.json').then(JSON.parse),
    read('package.json').then(JSON.parse),
    read('src/mobile/session.tsx'),
  ]);
  assert.equal(app.expo.scheme, 'alantil');
  assert.ok(pkg.dependencies['expo-web-browser']);
  assert.match(source, /Linking\.createURL\('auth\/callback'\)/);
  assert.match(source, /skipBrowserRedirect: true/);
  assert.match(source, /WebBrowser\.openAuthSessionAsync\(data\.url, redirectTo\)/);
  assert.match(source, /supabase\.auth\.exchangeCodeForSession/);
  assert.match(source, /exchangedCodes\.current\.has\(code\)/);
  assert.doesNotMatch(source, /Linking\.openURL\(data\.url\)/);
});

test('dictionary starts locally and refreshes in the background', async () => {
  const source = await read('src/mobile/dictionary.ts');
  assert.match(source, /STARTER_DICTIONARY/);
  assert.match(source, /DICTIONARY_CACHE_KEY/);
  assert.match(source, /scheduleRefresh\(\)/);
  assert.match(source, /withRetry/);
});

test('station selection affects learning but never limits the station test', async () => {
  const [station, learn] = await Promise.all([
    read('src/mobile/station.tsx'),
    read('src/mobile/learn/engine.tsx'),
  ]);
  assert.match(station, /selectedIds: Array\.from\(selected\)\.join\(','\)/);
  assert.match(station, /pathname: '\/path\/station-test', params: commonParams/);
  assert.match(learn, /filterLearnWordsBySelection\(words, params\.selectedIds\)/);
  assert.doesNotMatch(station, /station-test[^\n]*selectedIds/);
});

test('startup waits for session/settings and Test/Match restore guarded snapshots', async () => {
  const [home, layout, testSource, matchSource] = await Promise.all([
    read('app/index.tsx'),
    read('app/_layout.tsx'),
    read('src/mobile/practice/test.tsx'),
    read('src/mobile/practice/match.tsx'),
  ]);
  assert.match(home, /if \(!ready \|\| !auth\.ready\)/);
  assert.match(home, /resumeActivitySession\('test'/);
  assert.match(home, /resumeActivitySession\('match'/);
  assert.match(layout, /practice\/test\/session" options=\{\{ gestureEnabled: false \}\}/);
  assert.match(layout, /practice\/match\/session" options=\{\{ gestureEnabled: false \}\}/);
  assert.match(testSource, /useSessionExitGuard/);
  assert.match(matchSource, /useSessionExitGuard/);
});

test('sync queue has retry, in-flight revision protection and safe cloud pruning', async () => {
  const source = await read('src/mobile/sync.ts');
  assert.match(source, /revision: revisionId\(\)/);
  assert.match(source, /next_attempt_at/);
  assert.match(source, /pruneSupersededQueue/);
  assert.match(source, /remoteSupersedes/);
  assert.match(source, /STORAGE_KEYS\.hiddenWords/);
  assert.match(source, /LEGACY_ACTIVE_PREFIX/);
  assert.match(source, /learn_session_words\(word_id,show_count,left_swipe_count,final_result,first_position\)/);
  assert.match(source, /station_test_session_words\(word_id,result,wrong_word_id\)/);
  assert.match(source, /STORAGE_KEYS\.activityHistory/);
});

test('guest statistics use the current scoped history', async () => {
  const source = await read('src/mobile/profile/statistics-screen.tsx');
  assert.match(source, /STORAGE_KEYS\.activityHistory/);
  assert.doesNotMatch(source, /alantil_mobile_session_history_v1/);
});

test('Path restores the selected story and an independent scroll offset for every story', async () => {
  const [pathSource, storageSource] = await Promise.all([
    read('src/mobile/path.tsx'),
    read('src/mobile/storage.ts'),
  ]);
  assert.match(storageSource, /pathState: 'path_state'/);
  assert.match(pathSource, /active_story_id/);
  assert.match(pathSource, /scroll_offsets/);
  assert.match(pathSource, /STORAGE_KEYS\.pathState/);
  assert.match(pathSource, /scrollOffsetsRef\.current\[story\.id\]/);
  assert.match(pathSource, /scrollTo\(\{ y: storedOffset, animated: false \}\)/);
  assert.doesNotMatch(pathSource, /export function StationScreen/);
});
