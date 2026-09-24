import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const UUIDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
  "44444444-4444-4444-8444-444444444444",
];

async function loadVisitorModule() {
  return import(`../src/shared/analytics/visitor-analytics.js?test=${Date.now()}-${Math.random()}`);
}

test("visitor id persists while the session id is reused inside 30 minutes", async () => {
  const { resolveAnonymousIdentity, anonymousAnalyticsConfig } = await loadVisitorModule();
  const storage = new MemoryStorage();
  let index = 0;
  const uuidFactory = () => UUIDS[index++];
  const first = resolveAnonymousIdentity({ storage, nowMs: 1_000, uuidFactory });
  const second = resolveAnonymousIdentity({ storage, nowMs: 1_000 + 29 * 60 * 1000, uuidFactory });
  assert.equal(first.visitorId, UUIDS[0]);
  assert.equal(second.visitorId, UUIDS[0]);
  assert.equal(first.sessionId, UUIDS[1]);
  assert.equal(second.sessionId, UUIDS[1]);
  assert.equal(second.isNewSession, false);
  assert.equal(anonymousAnalyticsConfig.sessionTimeoutMs, 30 * 60 * 1000);
});

test("a restored account can claim a guest session while another account starts a new session", async () => {
  const { resolveAnonymousIdentity } = await loadVisitorModule();
  const storage = new MemoryStorage();
  let index = 0;
  const uuidFactory = () => UUIDS[index++];
  const guest = resolveAnonymousIdentity({ storage, nowMs: 2_000, uuidFactory });
  const signed = resolveAnonymousIdentity({ storage, nowMs: 3_000, uuidFactory, scopeId: UUIDS[2] });
  const other = resolveAnonymousIdentity({ storage, nowMs: 4_000, uuidFactory, scopeId: UUIDS[3] });
  assert.equal(signed.visitorId, guest.visitorId);
  assert.equal(signed.sessionId, guest.sessionId);
  assert.equal(signed.isNewSession, false);
  assert.notEqual(other.sessionId, signed.sessionId);
  assert.equal(other.isNewSession, true);
});

test("a new visit session is created after more than 30 minutes without activity", async () => {
  const { resolveAnonymousIdentity } = await loadVisitorModule();
  const storage = new MemoryStorage();
  let index = 0;
  const uuidFactory = () => UUIDS[index++];
  const first = resolveAnonymousIdentity({ storage, nowMs: 2_000, uuidFactory });
  const second = resolveAnonymousIdentity({ storage, nowMs: 2_000 + 30 * 60 * 1000 + 1, uuidFactory });
  assert.equal(second.visitorId, first.visitorId);
  assert.notEqual(second.sessionId, first.sessionId);
  assert.equal(second.sessionId, UUIDS[2]);
  assert.equal(second.isNewSession, true);
});

test("persistent visit identity can still be explicitly cleared", async () => {
  const { resolveAnonymousIdentity, clearAnonymousAnalyticsIdentity, anonymousAnalyticsConfig } = await loadVisitorModule();
  const storage = new MemoryStorage();
  let index = 0;
  resolveAnonymousIdentity({ storage, nowMs: 3_000, uuidFactory: () => UUIDS[index++] });
  clearAnonymousAnalyticsIdentity({ storage });
  assert.equal(storage.getItem(anonymousAnalyticsConfig.visitorStorageKey), null);
  assert.equal(storage.getItem(anonymousAnalyticsConfig.sessionStorageKey), null);
});

test("internal visit recording is independent from the Google Analytics consent gate", async () => {
  const analytics = await read("src/shared/analytics/analytics.js");
  const visitor = await read("src/shared/analytics/visitor-analytics.js");
  const index = await read("index.html");
  assert.match(analytics, /trackEvent\("page_view", parameters\)/);
  assert.match(analytics, /recordAnonymousPageView/);
  assert.doesNotMatch(analytics, /if \(!sent\) return false/);
  assert.doesNotMatch(analytics, /clearAnonymousAnalyticsIdentity/);
  assert.match(visitor, /getCurrentAuthState/);
  assert.match(visitor, /client\.rpc\("record_anonymous_visit_v2"/);
  assert.match(index, /const targetVersion = "16\.8\.0\.1"/);
  assert.doesNotMatch(index, /analyticsTargetVersion/);
  assert.ok(index.includes('imports[`${analyticsPath}?v=${version}`] = `${analyticsPath}?v=${targetVersion}`'));
  assert.doesNotMatch(visitor, /\.from\("anonymous_visit_sessions"\)/);
});

test("13.15.9 migration links authenticated visits and keeps activity reads behind protected RPCs", async () => {
  const migration = await read("supabase/migrations/20260822211130_user_activity_admin.sql");
  assert.match(migration, /add column if not exists activity_access boolean not null default false/i);
  assert.match(migration, /where nickname = 'Taulu07'/);
  assert.match(migration, /add column if not exists user_id uuid/i);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = ''/i);
  assert.match(migration, /admin_user_activity_list/);
  assert.match(migration, /activity access denied/);
  assert.match(migration, /grant execute on function public\.admin_user_activity_list\(\) to authenticated/i);
  assert.doesNotMatch(migration, /grant execute on function public\.admin_user_activity_list\(\) to anon/i);
});


test("16.7 guest analytics records immutable guest origin with explicit platform and language", async () => {
  const migration = await read("supabase/migrations/20260919143000_alantil_16_7_guest_analytics.sql");
  const web = await read("src/shared/analytics/visitor-analytics.js");
  const mobile = await read("mobile/platform/analytics.js");
  assert.match(migration, /add column if not exists started_as_guest boolean/i);
  assert.match(migration, /add column if not exists platform text/i);
  assert.match(migration, /add column if not exists interface_language text/i);
  assert.match(migration, /v_started_as_guest boolean:=\(auth\.uid\(\) is null\)/i);
  assert.match(migration, /started_as_guest,v_platform,v_language/i);
  const conflict=migration.match(/on conflict\(session_id\) do update[\s\S]*?where public\.anonymous_visit_sessions\.visitor_id/)?.[0]||"";
  assert.doesNotMatch(conflict,/started_as_guest\s*=/i);
  assert.match(web,/record_anonymous_visit_v2/);
  assert.match(web,/p_platform: "web"/);
  assert.match(mobile,/record_anonymous_visit_v2/);
  assert.match(mobile,/p_platform:'mobile'/);
});

test("guest analytics stays aggregated and protected by activity_access", async () => {
  const migration = await read("supabase/migrations/20260919143000_alantil_16_7_guest_analytics.sql");
  assert.match(migration, /create or replace function public\.admin_guest_analytics/);
  assert.match(migration, /activity_access is true/);
  assert.match(migration, /activity access denied/);
  assert.match(migration, /grant execute on function public\.admin_guest_analytics\(integer\) to authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.admin_guest_analytics\(integer\) to anon/);
  assert.match(migration, /count\(distinct s\.visitor_id\)/);
  assert.match(migration, /started_as_guest is true and s\.user_id is not null/);
  assert.match(migration, /legacy_unknown_sessions/);
});
