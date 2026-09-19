import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("users list renders server rank beside nickname and decorates only top three", async () => {
  const feature = await read("src/features/admin/index.js");
  const styles = await read("src/features/admin/admin.css");
  assert.match(feature, /adminRankLabel">№\$\{rank\}/);
  assert.match(feature, /adminRankMedal/);
  assert.match(feature, /rank <= 3 \? ` adminRankRow adminRank\$\{rank\}`/);
  assert.match(styles, /\.adminRank1 \.adminRankMedal/);
  assert.match(styles, /\.adminRank2 \.adminRankMedal/);
  assert.match(styles, /\.adminRank3 \.adminRankMedal/);
});

test("individual user detail keeps nickname only in shell header", async () => {
  const feature = await read("src/features/admin/index.js");
  const detail = feature.match(/async function renderUserDetail[\s\S]*?\n}\n\nfunction resultWordRows/)?.[0] || "";
  assert.match(detail, /setHeaderContent\?\.\(\{ title: detail\.nickname/);
  assert.doesNotMatch(detail, /adminUserSummaryHead|<h1>\$\{escapeHtml\(detail\.nickname/);
  assert.doesNotMatch(detail, /renderProfileNavigation/);
});

test("profile previews use ten-row backend data, four-field test rows and word-only tiles", async () => {
  const feature = await read("src/features/admin/index.js");
  const history = feature.match(/function testHistory[\s\S]*?\n}\n\nfunction wordTiles/)?.[0] || "";
  const tiles = feature.match(/function wordTiles[\s\S]*?\n}\n\nfunction problemWords/)?.[0] || "";
  assert.match(history, /formatTestDate/);
  assert.match(history, /storyLabel\(test\.story_type\)/);
  assert.match(history, /setNumber\(test\)/);
  assert.match(history, /formatAccuracy\(test\.accuracy\)/);
  assert.doesNotMatch(history, /correct_total|questions_total/);
  assert.match(tiles, /currentAlanWord\(row\)/);
  assert.doesNotMatch(tiles, /currentTranslation/);
  assert.match(feature, /data-admin-tests-all/);
  assert.match(feature, /data-admin-favorites-all/);
});

test("full tests and favorites are fetched lazily into the shared content modal", async () => {
  const feature = await read("src/features/admin/index.js");
  const service = await read("src/shared/admin/admin-activity-service.js");
  const modal = await read("src/shared/ui/modal.js");
  assert.match(feature, /openHistoryModal/);
  assert.match(feature, /fetchUserTestHistory\(userId\)/);
  assert.match(feature, /openFavoritesModal/);
  assert.match(feature, /fetchUserFavorites\(userId\)/);
  assert.match(service, /admin_user_test_history/);
  assert.match(service, /admin_user_favorites/);
  assert.match(modal, /function openContent/);
  assert.match(modal, /data-content-modal-close/);
});

test("13.15.10 migration ranks by streak then mastered words and limits profile previews to ten", async () => {
  const migration = await read("supabase/migrations/20260823011023_alantil_13_15_10_profile_activity_ui.sql");
  assert.match(migration, /order by r\.streak_days desc, r\.mastered_words desc, r\.user_id/);
  assert.match(migration, /'rank', r\.rank/);
  assert.match(migration, /recent_tests[\s\S]*limit 10/i);
  assert.match(migration, /recent_favorites[\s\S]*limit 10/i);
  assert.match(migration, /create or replace function public\.admin_user_test_history/);
  assert.match(migration, /create or replace function public\.admin_user_favorites/);
});

test("current chrome keeps bracket navigation, unified viewport masks and CTA buttons", async () => {
  const chrome = await read("src/shared/styles/chrome.css");
  const admin = await read("src/features/admin/admin.css");
  assert.match(chrome, /Unified viewport chrome/);
  assert.match(chrome, /mask-image:linear-gradient/);
  assert.match(chrome, /\.profilePrimaryNav/);
  assert.match(chrome, /\.storyTabsShell\{/);
  assert.match(chrome, /\.stationLaunchActions \.stationStudyButton/);
  assert.match(chrome, /\.stationLaunchActions \.stationTestButton/);
  assert.match(chrome, /backdrop-filter:blur/);
  assert.match(admin, /\.adminUsersEmbedded \.adminUsersScroll/);
  assert.match(admin, /\.adminWordTiles/);
});


test("extended statistics nests Users and Guests dashboards without creating a root screen", async () => {
  const web = await read("src/features/admin/index.js");
  const css = await read("src/features/admin/admin.css");
  const mobile = await read("mobile/screens/admin-users.js");
  assert.match(web, /dataAttribute:"admin-stats-mode"/);
  assert.match(web, /renderGuestAnalytics/);
  assert.match(web, /guestChart/);
  assert.match(css, /\.adminGuestChart/);
  assert.match(css, /\.adminGuestMetrics/);
  assert.match(mobile, /ProfileTabs items=\{\[\["users",s\('statsUsers'\)\],\["guests",s\('statsGuests'\)\]\]\}/);
  assert.match(mobile, /GuestAnalyticsPane/);
  assert.match(mobile, /react-native-svg/);
});
