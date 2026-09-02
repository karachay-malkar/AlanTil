import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobile = path.resolve(here, '..');
const read = (relative) => fs.readFileSync(path.join(mobile, relative), 'utf8');

const parity = read('ui/parity.js');
const onboarding = read('screens/onboarding.js');
const pathScreen = read('screens/path.js');
const station = read('screens/station.js');
const learn = read('screens/learn.js');
const stationTest = read('screens/station-test.js');
const practice = read('screens/practice.js');
const practiceGames = read('screens/practice-games.js');
const favorites = read('screens/favorites.js');
const songs = read('screens/songs.js');
const profile = read('screens/profile.js');
const profileGate = read('screens/profile-gate.js');
const profileMain = read('screens/profile-main.js');
const appRoot = read('AppRoot.js');

const screenSources = [onboarding, pathScreen, station, learn, stationTest, practice, practiceGames, favorites, songs, profile, profileGate, profileMain];

test('16.3 exposes shared screen parity primitives', () => {
  for (const name of ['ScreenSection', 'SurfaceCard', 'CompactSegmentedControl', 'ListRow', 'MetricStrip', 'MonoLabel', 'EmptyState']) {
    assert.match(parity, new RegExp(`export function ${name}\\b`));
  }
});

test('onboarding consumes shared parity controls and shared setup core', () => {
  assert.match(onboarding, /CompactSegmentedControl/);
  assert.match(onboarding, /SurfaceCard/);
  assert.match(onboarding, /completeLearningSetupSettings/);
  assert.doesNotMatch(onboarding, /function Segment\b/);
});

test('path uses three-position route geometry and preserves progress core', () => {
  assert.match(pathScreen, /POSITION_PATTERN\s*=\s*\[-1,\s*0,\s*1\]/);
  assert.match(pathScreen, /scrollToEnd\(\{ animated: false \}\)/);
  assert.match(pathScreen, /createRouteProgressSnapshot/);
  assert.match(pathScreen, /stationWordProgress/);
  assert.match(pathScreen, /scaleDot:\s*\{[^}]*width:\s*4[^}]*height:\s*4/s);
  assert.match(pathScreen, /scaleDiamond:\s*\{[^}]*width:\s*8[^}]*height:\s*8/s);
});

test('station keeps selection/favorites business state while using shared controls', () => {
  assert.match(station, /CompactSegmentedControl/);
  assert.match(station, /loadNativeHiddenWords/);
  assert.match(station, /toggleFavorite/);
  assert.match(station, /onLearn\(activeWords, direction\)/);
  assert.match(station, /onTest\(station, direction\)/);
  assert.match(station, /stats\.recent\.slice\(0, 3\)/);
  assert.match(station, /stats\.problems\.slice\(0, 7\)/);
});

test('learn remains backed by shared learning core and resumable session storage', () => {
  assert.match(learn, /initializeLearnState/);
  assert.match(learn, /decideLearnCard/);
  assert.match(learn, /undoLearnDecision/);
  assert.match(learn, /loadNativeSessionSnapshot\('learn'\)/);
  assert.match(learn, /saveNativeSessionSnapshot\('learn'/);
  assert.match(learn, /SurfaceCard/);
  assert.match(learn, /MetricStrip/);
});

test('station test remains backed by station-test core and snapshot recovery', () => {
  assert.match(stationTest, /buildStationTestSessionState/);
  assert.match(stationTest, /stationTestActiveSnapshot/);
  assert.match(stationTest, /recordNativeTestSession/);
  assert.match(stationTest, /SurfaceCard/);
  assert.match(stationTest, /MetricStrip/);
});

test('practice and favorites consume the common list/control layer', () => {
  assert.match(practice, /ListRow/);
  assert.match(practice, /SurfaceCard/);
  assert.match(favorites, /CompactSegmentedControl/);
  assert.match(favorites, /loadNativeHiddenWords/);
  assert.match(favorites, /toggleFavorite/);
});

test('general Test and Match retain scope, limits and resumable shared-core sessions', () => {
  assert.match(practiceGames, /\[20, 40, 80\]/);
  assert.match(practiceGames, /initializeTestState/);
  assert.match(practiceGames, /initializeMatchState/);
  assert.match(practiceGames, /loadNativeSessionSnapshot\('test'\)/);
  assert.match(practiceGames, /loadNativeSessionSnapshot\('match'\)/);
});

test('songs remains isolated behind its platform adapter', () => {
  assert.match(songs, /\.\.\/platform\/songs\.js/);
});

test('profile setup is guarded and profile/statistics/settings use parity controls', () => {
  assert.match(profileGate, /!profile\?\.nickname \|\| !profile\?\.avatar_gender/);
  assert.match(profileGate, /AccountScreen/);
  assert.match(profileGate, /ProfileMainArea/);
  assert.match(profileMain, /CompactSegmentedControl/);
  assert.match(profileMain, /MetricStrip/);
  assert.match(profileMain, /dictionaryPathProgress/);
  assert.match(profileMain, /getNativeProgressSummary/);
  assert.match(profileMain, /<Text style=\{styles\.versionLabel\}>Приложение<\/Text>/);
});

test('screens never access Supabase directly', () => {
  for (const source of screenSources) {
    assert.doesNotMatch(source, /supabase-client|createClient\(|SUPABASE_URL|SUPABASE_ANON_KEY/);
  }
});

test('AppRoot retains main navigation round trips and safe-area contract', () => {
  assert.match(appRoot, /StationScreen/);
  assert.match(appRoot, /LearnScreen/);
  assert.match(appRoot, /StationTestScreen/);
  assert.match(appRoot, /GeneralTestFlow/);
  assert.match(appRoot, /MatchFlow/);
  assert.match(appRoot, /FavoritesScreen/);
  assert.match(appRoot, /SongsScreen/);
  assert.match(appRoot, /AccountScreen/);
  assert.match(appRoot, /ProfileGate/);
  assert.match(appRoot, /theme\.safeArea\.edges/);
});
