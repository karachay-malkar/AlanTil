import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("part 3 monthly regularity uses completed months and active-day thresholds", () => {
  const admin = read("src/features/admin/index.js");
  const migration = read("supabase/migrations/20261006172000_alantil_16_8_extended_statistics_source_map.sql");

  assert.match(admin, /function monthlyVisitorsChart/);
  assert.match(admin, /data\?\.monthly_visitors/);

  assert.match(migration, /month_person_days as/);
  assert.match(migration, /count\(distinct vd\.day\)::int as active_days/);
  assert.match(migration, /vd\.day<v_current_month/);
  assert.match(migration, /active_days>=1/);
  assert.match(migration, /active_days>=3/);
  assert.match(migration, /active_days>=7/);
  assert.match(migration, /active_days>=14/);
  assert.match(migration, /active_days>=28/);
  assert.match(migration, /v_current_month-interval '1 month'/);
});
