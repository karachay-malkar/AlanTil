import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, stat } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("16.7 beginner path uses DB-backed local stone assets", async () => {
  const feature = await read("src/features/path/feature.js");
  const styles = await read("src/features/path/path.css");
  const migration = await read("supabase/migrations/20260922090000_alantil_16_7_beginner_set_stone_icons.sql");
  const worker = await read("service-worker.js");

  assert.match(feature, /content_structure/);
  assert.match(feature, /entity_id,icon_name/);
  assert.match(feature, /BEGINNER_ICON_PATTERN/);
  assert.match(feature, /\/assets\/icons\/sets\//);
  assert.match(feature, /beginnerStoneTitle/);
  assert.match(styles, /font-family:var\(--font-brand\)/);
  assert.match(styles, /grayscale\(100%\) saturate\(0%\) brightness\(\.92\) contrast\(\.9\)/);
  assert.match(styles, /color:#d7b56d/);
  assert.match(styles, /0 0 6px rgba\(215,181,109,\.45\)/);

  const assignments = [...migration.matchAll(/\('beginner-(\d{2})', 'Set_stone_icon_([1-7])\.png'\)/g)];
  assert.equal(assignments.length, 30);
  assert.deepEqual(assignments.map((match) => match[1]), Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(2, "0")));

  for (let index = 1; index <= 7; index += 1) {
    const path = `assets/icons/sets/Set_stone_icon_${index}.png`;
    await access(new URL(`../${path}`, import.meta.url));
    assert.ok((await stat(new URL(`../${path}`, import.meta.url))).size > 1000);
    assert.ok(worker.includes(`Set_stone_icon_${index}.png?v=16.7.0.16`));
  }
});
