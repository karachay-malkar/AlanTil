import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('analytics is consent-gated, scoped, sanitized and cleared when disabled', async () => {
  const [analytics, storage] = await Promise.all([
    read('src/mobile/analytics.ts'),
    read('src/mobile/storage.ts'),
  ]);
  assert.match(analytics, /preference\.enabled !== true/);
  assert.match(analytics, /safeParameters/);
  assert.match(analytics, /FORBIDDEN_PARAMETER_NAMES/);
  assert.match(analytics, /'query'.*'search_query'/s);
  assert.match(analytics, /'word'.*'translation'/s);
  assert.match(analytics, /slice\(-499\)/);
  assert.match(analytics, /writeScopedJson\(STORAGE_KEYS\.analyticsEvents, \[\]/);
  assert.match(storage, /analyticsPreference/);
  assert.match(storage, /analyticsEvents/);
});

test('global analytics records page views and foreground-only screen time', async () => {
  const [tracker, activity] = await Promise.all([
    read('src/mobile/analytics-tracker.tsx'),
    read('src/mobile/activity-session.ts'),
  ]);
  assert.match(tracker, /AppState\.addEventListener/);
  assert.match(tracker, /page_view/);
  assert.match(tracker, /screen_time/);
  assert.match(tracker, /activeDurationMs/);
  assert.match(activity, /activity_start/);
  assert.match(activity, /activity_complete/);
  assert.match(activity, /activity_abandon/);
});

test('consent prompt waits for onboarding and links to the policy', async () => {
  const [gate, layout] = await Promise.all([
    read('src/mobile/analytics-consent.tsx'),
    read('app/_layout.tsx'),
  ]);
  assert.match(gate, /settings\.onboarding_step === 'done'/);
  assert.match(gate, /preference\?\.enabled === null/);
  assert.match(gate, /saveAnalyticsPreference/);
  assert.match(gate, /\/profile\/privacy/);
  assert.match(layout, /<AnalyticsConsentGate/);
  assert.match(layout, /<MobileAnalyticsTracker/);
});

test('privacy, acknowledgements and version screens are linked from Settings', async () => {
  const [documents, settings, privacyRoute, thanksRoute, versionRoute] = await Promise.all([
    read('src/mobile/profile/document-screens.tsx'),
    read('src/mobile/profile/settings-screen.tsx'),
    read('app/profile/privacy.tsx'),
    read('app/profile/thanks.tsx'),
    read('app/profile/version.tsx'),
  ]);
  assert.match(documents, /readAnalyticsPreference/);
  assert.match(documents, /saveAnalyticsPreference/);
  assert.match(documents, /getDictionaryStatus/);
  assert.match(settings, /settings\.thanks/);
  assert.match(settings, /settings\.app_version/);
  assert.match(settings, /settings\.privacy_policy/);
  assert.match(privacyRoute, /PrivacyScreen/);
  assert.match(thanksRoute, /ThanksScreen/);
  assert.match(versionRoute, /VersionScreen/);
});
