import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("extended statistics shows only unique people and frequency-by-days charts", () => {
  const admin = read("src/features/admin/index.js");
  assert.match(admin, /fetchExtendedAnalytics/);
  assert.match(admin, /dailyVisitorsChart/);
  assert.match(admin, /monthlyVisitorsChart/);
  for (const key of ["d1", "d3", "d7", "d14", "d28"]) {
    assert.match(admin, new RegExp(`key:"${key}"`));
  }
  assert.doesNotMatch(admin, /guestBreakdown\(/);
  assert.doesNotMatch(admin, /summary\.sessions/);
  assert.doesNotMatch(admin, /summary\.pageviews/);
  assert.doesNotMatch(admin, /avg_pages_per_session/);
});

test("usage section is grouped by the approved product areas", () => {
  const admin = read("src/features/admin/index.js");
  for (const key of [
    "usagePathUnderstanding",
    "usagePathRoots",
    "usageLearn",
    "usageTests",
    "usageAshykComputer",
    "usageAshykOnline",
    "usageLyrics",
  ]) {
    assert.match(admin, new RegExp(`guestText\\("${key}"\\)`));
  }
  for (const metric of [
    "understanding_learn",
    "understanding_test",
    "roots_learn",
    "roots_test",
    "ashyk_computer",
    "ashyk_online",
    "song_lyrics",
  ]) {
    assert.match(admin, new RegExp(metric));
  }
});

test("database contract counts completed months at 1, 3, 7, 14 and 28 active days", () => {
  const migration = read("supabase/migrations/20261006092000_alantil_16_8_extended_statistics.sql");
  assert.match(migration, /create table if not exists public\.app_usage_events/);
  assert.match(migration, /create or replace function public\.admin_extended_analytics/);
  assert.match(migration, /vd\.day<v_current_month/);
  for (const threshold of [1, 3, 7, 14, 28]) {
    assert.match(migration, new RegExp(`active_days>=${threshold}`));
  }
  assert.match(migration, /count\(distinct vd\.person_key\)/);
  assert.match(migration, /ashyk_online_complete/);
  assert.match(migration, /count\(distinct up\.item_key\)/);
  const aggregateFix = read("supabase/migrations/20261006094000_alantil_16_8_extended_statistics_aggregate_fix.sql");
  assert.match(aggregateFix, /usage_by_month as/);
  assert.match(aggregateFix, /jsonb_agg\(ubm\.value order by ubm\.month_start\)/);
  const usageByMonth = aggregateFix.match(/usage_by_month as \([\s\S]*?\n  \),\n  usage_months as/)?.[0] || "";
  assert.match(usageByMonth, /group by us\.month_start/);
  assert.doesNotMatch(usageByMonth, /jsonb_agg/);
});

test("meaningful web actions feed the usage event contract", () => {
  const visitor = read("src/shared/analytics/visitor-analytics.js");
  const learn = read("src/features/learn/study.js");
  const stationTest = read("src/features/path/station-test.js");
  const songs = read("src/features/songs/song-view.js");
  const ashyk = read("src/features/ashyk/index.js");

  assert.match(visitor, /record_app_usage_event/);
  assert.match(learn, /path_learn_complete/);
  assert.match(stationTest, /path_test_complete/);
  assert.match(songs, /song_lyrics_open/);
  assert.match(ashyk, /ashyk_computer_complete/);
});

test("daily visitor points expose a tap/click tooltip with a full calendar date", () => {
  const admin = read("src/features/admin/index.js");
  assert.match(admin, /data-analytics-point/);
  assert.match(admin, /bindAnalyticsPointTooltips/);
  assert.match(admin, /day:"numeric",month:"long"/);
  assert.match(admin, /usagePeopleShort/);
  const css = read("src/features/admin/admin.css");
  assert.match(css, /adminAnalyticsPointTooltip/);
});

test("embedded extended statistics opens directly without a second users/visitors mode", () => {
  const admin = read("src/features/admin/index.js");
  const embedded = admin.match(/export async function renderAdminUsersEmbedded[\s\S]*?\n}\n\nfunction storyProgressSection/)?.[0] || "";
  assert.match(embedded, /renderGuestAnalytics/);
  assert.match(embedded, /isAnalyticsOnly/);
  assert.doesNotMatch(embedded, /data-admin-stats-mode/);
  assert.doesNotMatch(embedded, /renderUsers\(/);
});

test("statistics chrome relies on the shared system chrome instead of feature-specific masks", () => {
  const css = read("src/features/admin/admin.css");
  const shell = read("src/shared/styles/shell.css");
  assert.doesNotMatch(css, /\[data-feature="friends"\] \.socialBody\.isStats[\s\S]*?background:transparent!important/);
  assert.match(shell, /\.appViewport::before,\.appViewport::after[\s\S]*backdrop-filter:blur\(var\(--system-mask-blur\)\)/);
  assert.match(shell, /\.appHeader[\s\S]*background:transparent/);
  assert.match(shell, /\.bottomNav[\s\S]*background:transparent/);
  assert.match(css, /\.adminUsersEmbedded\.isAnalyticsOnly\{grid-template-rows:minmax\(0,1fr\)\}/);
});


test("native screens feed the same usage contract", () => {
  const analytics = read("mobile/platform/analytics.js");
  const learn = read("mobile/screens/learn.js");
  const stationTest = read("mobile/screens/station-test.js");
  const songs = read("mobile/screens/songs.js");
  const ashyk = read("mobile/screens/ashyk.js");
  const admin = read("mobile/screens/admin-users.js");
  const adminPlatform = read("mobile/platform/admin.js");

  assert.match(analytics, /recordNativeUsageEvent/);
  assert.match(analytics, /record_app_usage_event/);
  assert.match(learn, /path_learn_complete/);
  assert.match(stationTest, /path_test_complete/);
  assert.match(songs, /song_lyrics_open/);
  assert.match(ashyk, /ashyk_computer_complete/);
});
