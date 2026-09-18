import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("user activity routes live under Friends statistics and preserve legacy profile entry redirects", async () => {
  const router = await read("src/app/router.js");
  assert.match(router, /second === "users"/);
  assert.match(router, /route: "admin\.users"/);
  assert.match(router, /route: "admin\.user", params: \{ userId: third \}/);
  assert.match(router, /route: "admin\.test", params: \{ userId: third, sessionId: fifth \}/);
  assert.match(router, /\/friends\/statistics\/\$\{encodeSegment\(params\.userId\)\}/);
  assert.match(router, /second === "users"/);
  assert.match(router, /redirected: true/);
});

test("profile navigation no longer exposes Users; Extended stats moved under Friends and stays activity-access gated", async () => {
  const navigation = await read("src/shared/ui/profile-navigation.js");
  const friends = await read("src/features/friends/index.js");
  const router = await read("src/app/router.js");
  assert.doesNotMatch(navigation, /id: "users"/);
  assert.doesNotMatch(navigation, /route: "admin\.users"/);
  assert.match(friends, /hasActivityAccess/);
  assert.match(friends, /renderBracketTabs/);
  assert.match(friends, /id:'stats'/);
  assert.match(friends, /extendedStats/);
  assert.match(router, /whenActivityAccessReady/);
  assert.match(router, /hasActivityAccess/);
});

test("users table uses the same full-height scroll architecture as the station word list", async () => {
  const feature = await read("src/features/admin/index.js");
  const styles = await read("src/features/admin/admin.css");
  const chrome = await read("src/shared/styles/chrome.css");
  const pathStyles = await read("src/features/path/path.css");
  assert.match(feature, /class="adminUserLink"[^>]+data-admin-user-id/);
  assert.doesNotMatch(feature, /<tr[^>]+data-admin-user-id/);
  assert.doesNotMatch(feature, /adminTableScroller/);
  assert.match(feature, /class="adminUsersScroll" role="region"/);
  assert.match(pathStyles, /\.stationWordList\{position:absolute;z-index:1;inset:0[^}]*overflow-y:auto/);
  assert.match(styles, /\.adminUsersScroll\{position:absolute;z-index:1;inset:0[^}]*overflow:auto/);
  assert.match(styles, /scroll-padding-bottom:calc\(var\(--safe-bottom\) \+ var\(--content-rest-gap\)\)/);
  assert.match(styles, /\.adminUsersTable thead th\{position:sticky;top:0;z-index:var\(--z-tabs\)/);
  assert.match(styles, /height:var\(--table-row-height\)/);
  assert.match(styles, /height:var\(--ui-list-table-header-height\)/);
  assert.doesNotMatch(styles, /adminUserStickyCell\{position:sticky/);
  const adminUsersChrome = chrome.match(/\[data-feature="admin"\]\[data-screen="users"\] \.adminUsersScroll\{[^}]*\}/)?.[0] || "";
  assert.ok(adminUsersChrome, "admin users chrome rule must exist");
  assert.doesNotMatch(adminUsersChrome, /var\(--nav-h\)/);
});

test("general table contains only agreed comparison fields", async () => {
  const feature = await read("src/features/admin/index.js");
  assert.match(feature, /admin\.last_visit/);
  assert.match(feature, /admin\.streak/);
  assert.match(feature, /admin\.mastered_words/);
  assert.match(feature, /STORY_ORDER\.map/);
  const usersFunction = feature.match(/async function renderUsers[\s\S]*?\n}\n\nfunction storyProgressSection/)?.[0] || "";
  assert.doesNotMatch(usersFunction, /admin\.accuracy|admin\.station_tests|last station/i);
});

test("other-user problem words use the same compact tile principle as profile statistics", async () => {
  const feature = await read("src/features/admin/index.js");
  const styles = await read("src/features/admin/admin.css");
  const renderer = feature.match(/function problemWords[\s\S]*?\n}\n\nfunction bindTestLinks/)?.[0] || "";
  assert.match(renderer, /adminProblemRows/);
  assert.match(renderer, /adminProblemRow/);
  assert.match(renderer, /adminProblemCounts/);
  assert.doesNotMatch(renderer, /currentTranslation/);
  assert.match(styles, /\.adminProblemRows\{display:flex;flex-wrap:wrap;gap:7px/);
  assert.match(styles, /\.adminProblemRow\{min-width:92px[^}]*border:1px solid var\(--line-soft\)/);
  assert.match(styles, /\.adminProblemCounts\{[^}]*color:var\(--danger-strong\)/);
});

test("detail screen contains story progress, station test history, favorites and problem words", async () => {
  const feature = await read("src/features/admin/index.js");
  assert.match(feature, /storyProgressSection/);
  assert.match(feature, /admin\.station_tests/);
  assert.match(feature, /data-admin-test-id/);
  assert.match(feature, /admin\.favorite_words/);
  assert.match(feature, /admin\.problem_words/);
  assert.match(feature, /fetchStationTestDetail/);
});

test("migration protects activity_access from client insert/update and does not create a permissions table", async () => {
  const migration = await read("supabase/migrations/20260822211130_user_activity_admin.sql");
  assert.match(migration, /revoke insert, update on table public\.profiles from anon, authenticated/i);
  assert.match(migration, /grant insert \(user_id, nickname, avatar_gender\)/i);
  assert.match(migration, /grant update \(nickname, avatar_gender\)/i);
  assert.doesNotMatch(migration, /create table[^;]*user_permissions/i);
  assert.doesNotMatch(migration, /dfcf124e-735b-4caa-81d2-99eb5f02218d/i);
});
