import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("user activity routes stay under profile and preserve user/test identifiers", async () => {
  const router = await read("src/app/router.js");
  assert.match(router, /second === "users"/);
  assert.match(router, /route: "admin\.users"/);
  assert.match(router, /route: "admin\.user", params: \{ userId: third \}/);
  assert.match(router, /route: "admin\.test", params: \{ userId: third, sessionId: fifth \}/);
  assert.match(router, /\/profile\/users\/\$\{encodeSegment\(params\.userId\)\}/);
});

test("profile navigation exposes Users only through the activity-access marker", async () => {
  const navigation = await read("src/shared/ui/profile-navigation.js");
  const styles = await read("src/features/admin/admin.css");
  assert.match(navigation, /id: "users"[\s\S]*activityOnly: true/);
  assert.match(navigation, /data-activity-only/);
  assert.match(styles, /profilePrimaryTab\[data-activity-only\]\{display:none\}/);
  assert.match(styles, /data-activity-access="true"/);
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
  assert.match(styles, /scroll-padding-bottom:calc\(var\(--safe-bottom\) \+ var\(--nav-h\) \+ var\(--content-rest-gap\)\)/);
  assert.match(chrome, /adminUsersScroll[\s\S]*padding:calc\(var\(--safe-top\) \+ 42px\) 0 calc\(var\(--safe-bottom\) \+ var\(--nav-h\) \+ var\(--content-rest-gap\)\)!important/);
  assert.match(styles, /\.adminUsersTable thead th\{position:sticky;top:calc\(var\(--safe-top\) \+ 42px\);z-index:2/);
  assert.match(styles, /\.adminUserStickyCell\{position:sticky;left:0[^}]*z-index:3/);
  assert.match(styles, /\.adminUserStickyHead\{z-index:4!important/);
  assert.match(styles, /tbody tr:last-child>th[^}]*border-bottom:0/);
  assert.match(styles, /height:46px/);
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
