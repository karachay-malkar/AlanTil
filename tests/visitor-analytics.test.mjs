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

test("anonymous visitor id persists while the session id is reused inside 30 minutes", async () => {
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

test("a new anonymous session is created after more than 30 minutes without a tracked page view", async () => {
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

test("disabling analytics can remove both persistent anonymous identifiers", async () => {
  const { resolveAnonymousIdentity, clearAnonymousAnalyticsIdentity, anonymousAnalyticsConfig } = await loadVisitorModule();
  const storage = new MemoryStorage();
  let index = 0;
  resolveAnonymousIdentity({ storage, nowMs: 3_000, uuidFactory: () => UUIDS[index++] });
  clearAnonymousAnalyticsIdentity({ storage });
  assert.equal(storage.getItem(anonymousAnalyticsConfig.visitorStorageKey), null);
  assert.equal(storage.getItem(anonymousAnalyticsConfig.sessionStorageKey), null);
});

test("page views write through the restricted RPC and only after the existing analytics gate", async () => {
  const analytics = await read("src/shared/analytics/analytics.js");
  const visitor = await read("src/shared/analytics/visitor-analytics.js");
  const index = await read("index.html");
  assert.match(analytics, /if \(!analyticsAvailable \|\| !runtimeEnabled \|\| !eventName\) return false/);
  assert.match(analytics, /recordAnonymousPageView/);
  assert.match(visitor, /client\.rpc\("record_anonymous_visit"/);
  assert.match(index, /analyticsTargetVersion = "13\.15\.8"/);
  assert.match(index, /\/src\/shared\/analytics\/analytics\.js/);
  assert.doesNotMatch(visitor, /\.from\("anonymous_visit_sessions"\)/);
});

test("database migration keeps anonymous rows private and exposes only the validated write RPC", async () => {
  const migration = await read("supabase/migrations/20260821174000_anonymous_visit_analytics.sql");
  assert.match(migration, /alter table public\.anonymous_visit_sessions enable row level security/i);
  assert.match(migration, /revoke all on table public\.anonymous_visit_sessions from public, anon, authenticated/i);
  assert.match(migration, /security definer/i);
  assert.match(migration, /set search_path = pg_catalog, public/i);
  assert.match(migration, /revoke all on function public\.record_anonymous_visit\(uuid, uuid, text, text, text\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.record_anonymous_visit\(uuid, uuid, text, text, text\) to anon, authenticated/i);
  assert.match(migration, /where public\.anonymous_visit_sessions\.visitor_id = excluded\.visitor_id/i);
});
