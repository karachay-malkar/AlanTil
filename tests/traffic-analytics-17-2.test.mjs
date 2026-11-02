import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { isProductionAnalyticsHost } from "../packages/alantil-core/analytics.js";
const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("analytics accepts production domains, not local tests or preview hosts", () => {
  for (const host of ["alantil.ru", "www.alantil.ru", "karachay-malkar.github.io"])
    assert.equal(isProductionAnalyticsHost(host), true, host);
  for (const host of ["localhost", "127.0.0.1", "0.0.0.0", "::1", "alantil.ru.evil.test", "preview.vercel.app", ""])
    assert.equal(isProductionAnalyticsHost(host), false, host);
});
test("web GA and Supabase visitors both have a production-origin gate", () => {
  const ga = read("src/shared/analytics/analytics.js");
  const visitor = read("src/shared/analytics/visitor-analytics.js");
  assert.match(ga, /productionAnalyticsEnabled = isProductionAnalyticsHost\(window\.location\.hostname\)/);
  assert.match(ga, /if \(!productionAnalyticsEnabled\) return false;/);
  assert.equal((visitor.match(/if \(!isProductionAnalyticsHost\(globalThis\.location\?\.hostname\)\) return false;/g) || []).length, 2);
});
test("server ignores test-origin browser and usage writes, without deleting historical rows", () => {
  const sql = read("supabase/migrations/20261102125000_traffic_analytics_test_isolation.sql");
  assert.match(sql, /current_setting\('request\.headers', true\)/);
  assert.match(sql, /HeadlessChrome/);
  assert.match(sql, /localhost\|127/);
  assert.match(sql, /before insert or update on public\.anonymous_visit_sessions/i);
  assert.match(sql, /before insert on public\.app_usage_events/i);
  assert.doesNotMatch(sql, /delete from public\./i);
});
test("admin labels historical guest totals as unreliable", () => {
  const admin = read("src/features/admin/index.js");
  assert.match(admin, /trafficQualityNote\(\)/);
  assert.match(admin, /Архивная статистика гостей/);
});
