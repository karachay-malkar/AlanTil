import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("16.7 beginner path is prepared for DB-backed WebP diorama assets", async () => {
  const feature = await read("src/features/path/feature.js");
  const styles = await read("src/features/path/path.css");
  const migration = await read("supabase/migrations/20260922124700_alantil_16_7_beginner_diorama_icons.sql");
  const worker = await read("service-worker.js");

  assert.match(feature, /content_structure/);
  assert.match(feature, /entity_id,icon_name/);
  assert.match(feature, /BEGINNER_ICON_PATTERN/);
  assert.match(feature, /[.]webp/);
  assert.match(feature, /beginnerDioramaFrame/);
  assert.match(feature, /beginnerDioramaImage/);
  assert.match(feature, /beginnerDioramaLabel/);
  assert.doesNotMatch(feature, /beginnerStone|Set_stone_icon_/);

  assert.match(styles, /beginnerDioramaNode/);
  assert.match(styles, /beginnerDioramaFrame/);
  assert.match(styles, /beginnerDioramaImage/);
  assert.match(styles, /beginnerDioramaLabel/);
  assert.doesNotMatch(styles, /beginnerStone/);

  const assignments = [...migration.matchAll(/\('beginner-(\d{2})', '(\d{2})_[a-z0-9_]+[.]webp'\)/g)];
  assert.equal(assignments.length, 30);
  assert.deepEqual(
    assignments.map((match) => match[1]),
    Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(2, "0")),
  );
  assert.deepEqual(assignments.map((match) => match[2]), assignments.map((match) => match[1]));

  assert.doesNotMatch(worker, /Set_stone_icon_/);
});

test("16.7 beginner set titles are localized in ru/en/tr", async () => {
  const names = await read("supabase/migrations/20260922123000_alantil_16_7_beginner_set_names.sql");
  const correction = await read("supabase/migrations/20260922124600_alantil_16_7_beginner_set_name_correction.sql");

  assert.equal([...names.matchAll(/\('beginner-\d{2}',\s*\$q\$/g)].length, 30);
  assert.match(names, /Мост через горную реку/);
  assert.match(names, /Bridge over a Mountain River/);
  assert.match(names, /Dağ Nehri Üzerindeki Köprü/);
  assert.match(correction, /Проезжая через поселок/);
});
