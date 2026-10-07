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

test("identity dedup keeps global one-account linking and resolves shared visitors by calendar day", () => {
  const migration = read("supabase/migrations/20261006123000_alantil_16_8_extended_statistics_identity_fix.sql");
  assert.match(migration, /visitor_accounts as/);
  assert.match(migration, /visitor_day_accounts as/);
  assert.match(migration, /vda\.linked_user_id/);
  assert.match(migration, /ue\.occurred_at at time zone 'UTC'/);
  assert.match(migration, /count\(distinct av\.user_id\)=1/);
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


test("part 1 data audit uses canonical domain sources without authenticated completion duplicates", () => {
  const audit = read("docs/analytics/extended-statistics-part1-data-map.md");
  const migration = read("supabase/migrations/20261006172000_alantil_16_8_extended_statistics_source_map.sql");

  for (const source of [
    "anonymous_visit_sessions",
    "learn_sessions",
    "station_test_sessions",
    "ashyk_rooms",
    "app_usage_events",
  ]) {
    assert.match(audit, new RegExp(source));
  }

  assert.match(migration, /drop trigger if exists learn_sessions_capture_usage on public\.learn_sessions/);
  assert.match(migration, /drop trigger if exists station_test_sessions_capture_usage on public\.station_test_sessions/);
  assert.match(migration, /drop trigger if exists ashyk_rooms_capture_usage on public\.ashyk_rooms/);
  assert.match(migration, /delete from public\.app_usage_events[\s\S]*event_type in \('path_learn_complete','path_test_complete'\)[\s\S]*coalesce\(ue\.platform,'web'\)<>'mobile'/);
  assert.match(migration, /delete from public\.app_usage_events[\s\S]*event_type='ashyk_online_complete'/);
  assert.match(migration, /if v_user_id is not null and v_platform='web' and p_event_type in \('path_learn_complete','path_test_complete'\) then[\s\S]*return true/);
  const duplicateCleanup = migration.match(/-- Remove only rows that are known duplicates[\s\S]*?-- Online Ashyk has a complete canonical room ledger\./)?.[0] || "";
  assert.match(duplicateCleanup, /exists[\s\S]*public\.learn_sessions/);
  assert.match(duplicateCleanup, /exists[\s\S]*public\.station_test_sessions/);

  const usageSources = migration.match(/usage_people as \([\s\S]*?\n  \),\n  usage_agg as/)?.[0] || "";
  assert.match(usageSources, /from public\.learn_sessions ls/);
  assert.match(usageSources, /from public\.station_test_sessions sts/);
  assert.match(usageSources, /from public\.ashyk_rooms r/);
  assert.match(usageSources, /from public\.app_usage_events ue/);
  assert.match(usageSources, /ue\.event_type in \('path_learn_complete','path_test_complete','ashyk_computer_complete','song_lyrics_open'\)/);
  assert.match(usageSources, /not exists[\s\S]*public\.learn_sessions/);
  assert.match(usageSources, /not exists[\s\S]*public\.station_test_sessions/);
});


test("part 2 daily visitors uses one combined person per UTC calendar day", () => {
  const admin = read("src/features/admin/index.js");
  const messages = read("src/shared/i18n/messages-13-15-9.js");
  const migration = read("supabase/migrations/20261006172000_alantil_16_8_extended_statistics_source_map.sql");

  const dailyChart = admin.match(/function dailyVisitorsChart\(data\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(dailyChart, /data\?\.daily_visitors/);
  assert.match(dailyChart, /visitorDailyTitle/);
  assert.match(dailyChart, /msg\("admin\.people"\)/);
  assert.match(admin, /day:"numeric",month:"long",timeZone:"UTC"/);
  assert.match(admin, /day:"2-digit",month:"2-digit",timeZone:"UTC"/);
  assert.match(messages, /"admin\.people": Object\.freeze\(\{ ru: "человек", en: "people", tr: "kişi" \}\)/);

  const visitorBlock = migration.match(/visitor_accounts as \([\s\S]*?\n  daily_json as \(/)?.[0] || "";
  assert.match(visitorBlock, /visitor_accounts as/);
  assert.match(visitorBlock, /visitor_day_accounts as/);
  assert.match(visitorBlock, /when av\.user_id is not null then 'u:'/);
  assert.match(visitorBlock, /when va\.linked_user_id is not null then 'u:'/);
  assert.match(visitorBlock, /when vda\.linked_user_id is not null then 'u:'/);
  assert.match(visitorBlock, /else 'v:'\|\|av\.visitor_id::text/);
  assert.match(visitorBlock, /count\(distinct vd\.person_key\)::int as people/);

  for (const legacyMetric of [
    /summary\.sessions/,
    /summary\.pageviews/,
    /avg_pages_per_session/,
    /guestBreakdown\(/,
  ]) {
    assert.doesNotMatch(admin, legacyMetric);
  }
});


test("part 4 path usage is counted only from completed actions with exact path ids", () => {
  const migration = read("supabase/migrations/20261007083000_alantil_16_8_extended_statistics_path_usage.sql");
  const webAnalytics = read("src/shared/analytics/visitor-analytics.js");
  const webLearn = read("src/features/learn/study.js");
  const webTest = read("src/features/path/station-test.js");
  const nativeAnalytics = read("mobile/platform/analytics.js");
  const nativeLearn = read("mobile/screens/learn.js");
  const nativeTest = read("mobile/screens/station-test.js");
  const admin = read("src/features/admin/index.js");

  for (const column of ["dictionary_id", "section_id", "set_id"]) {
    assert.match(migration, new RegExp(`add column if not exists ${column} text`));
  }
  assert.match(migration, /create or replace function public\.record_path_usage_event/);
  assert.match(migration, /from public\.content_words cw/);
  assert.match(migration, /cw\.story_id=v_story_type/);
  assert.match(migration, /cw\.dictionary_id=v_dictionary_id/);
  assert.match(migration, /cw\.section_id=v_section_id/);
  assert.match(migration, /cw\.set_id=v_set_id/);

  const usageSources = migration.match(/path_sets as \([\s\S]*?\n  \),\n  usage_agg as/)?.[0] || "";
  assert.match(usageSources, /select distinct[\s\S]*cw\.story_id[\s\S]*cw\.dictionary_id[\s\S]*cw\.section_id[\s\S]*cw\.set_id/);
  assert.match(usageSources, /from public\.learn_sessions ls[\s\S]*join path_sets ps[\s\S]*ps\.dictionary_id=ls\.dictionary_id[\s\S]*ps\.section_id=ls\.section_id[\s\S]*ps\.set_id=ls\.set_id[\s\S]*ls\.status='completed'/);
  assert.match(usageSources, /from public\.station_test_sessions sts[\s\S]*join path_sets ps[\s\S]*ps\.story_id=sts\.story_type[\s\S]*ps\.dictionary_id=sts\.dictionary_id[\s\S]*ps\.section_id=sts\.group_id[\s\S]*ps\.set_id=sts\.set_id[\s\S]*sts\.status='completed'/);
  assert.match(usageSources, /ue\.dictionary_id=ps\.dictionary_id[\s\S]*ue\.section_id=ps\.section_id[\s\S]*ue\.set_id=ps\.set_id/);

  for (const analytics of [webAnalytics, nativeAnalytics]) {
    assert.match(analytics, /record_path_usage_event/);
    assert.match(analytics, /p_dictionary_id/);
    assert.match(analytics, /p_section_id/);
    assert.match(analytics, /p_set_id/);
  }
  for (const caller of [webLearn, webTest, nativeLearn, nativeTest]) {
    assert.match(caller, /dictionaryId/);
    assert.match(caller, /sectionId/);
    assert.match(caller, /setId/);
  }

  assert.match(admin, /selected\.understanding_learn/);
  assert.match(admin, /selected\.understanding_test/);
  assert.match(admin, /selected\.roots_learn/);
  assert.match(admin, /selected\.roots_test/);
  assert.match(admin, /usageSets/);
  assert.match(admin, /usageTestsCount/);
});


test("part 5 Ashyk and songs count only real completed usage", () => {
  const store = read("packages/ashyk-game/store.js");
  const webAshyk = read("src/features/ashyk/index.js");
  const nativeAshyk = read("mobile/screens/ashyk.js");
  const webSongs = read("src/features/songs/song-view.js");
  const nativeSongs = read("mobile/screens/songs.js");
  const migration = read("supabase/migrations/20261007043500_alantil_16_8_extended_statistics_ashyk_songs.sql");

  assert.match(store, /export function isNaturalAshykComputerCompletion/);
  assert.match(store, /state\?\.lastOutcome\?\.code==='capture'/);
  assert.match(webAshyk, /isNaturalAshykComputerCompletion\(finished\)/);
  assert.match(webAshyk, /itemKey:finished\.winByKyt\?"kyt":"score"/);
  assert.match(nativeAshyk, /isNaturalAshykComputerCompletion\(state\)/);
  assert.match(nativeAshyk, /itemKey:state\.winByKyt\?'kyt':'score'/);

  const usageSources = migration.match(/usage_people as \([\s\S]*?\n  \),\n  usage_agg as/)?.[0] || "";
  assert.match(usageSources, /r\.status='finished'/);
  assert.match(usageSources, /r\.finish_reason in \('score','kyt'\)/);
  assert.match(usageSources, /r\.guest_user_id is not null/);
  assert.match(migration, /p_event_type='ashyk_computer_complete'[\s\S]*v_item_key not in \('score','kyt'\)/);

  assert.match(webSongs, /if \(lyricsMarkup\) \{[\s\S]*song_lyrics_open/);
  assert.match(nativeSongs, /song\?\.id&&model\.length[\s\S]*song_lyrics_open/);
  assert.match(migration, /p_event_type='song_lyrics_open'[\s\S]*from public\.songs s[\s\S]*s\.is_published is true[\s\S]*from public\.song_lines sl/);
});
