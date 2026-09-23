import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const fileUrl = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fileUrl(path), "utf8");

test("16.7 intermediate path uses Alan-script DB metadata and 26 diorama assets", async () => {
  const feature = await read("src/features/path/feature.js");
  const migration = await read("supabase/migrations/20260923142000_alantil_16_7_intermediate_diorama_sets.sql");
  const nameCorrection = await read("supabase/migrations/20260923162500_alantil_16_7_intermediate_set_24_name_correction.sql");
  const styles = await read("src/features/path/path.css");

  assert.match(feature, /INTERMEDIATE_METADATA_CACHE_KEY = "alantil_intermediate_set_metadata_v2"/);
  assert.match(feature, /INTERMEDIATE_SET_PATTERN/);
  assert.match(feature, /name_alan_cyrillic,name_alan_turkic/);
  assert.match(feature, /getDisplayedSetName/);
  assert.match(feature, /applyIntermediateSetMetadataToRoute/);
  assert.match(feature, /intermediateSetIconName/);
  assert.match(feature, /\["beginner","intermediate"\]/);

  const assignments = [...migration.matchAll(/\('intermediate-(\d{2})',\s*'[^']+',\s*'[^']+',\s*'(\d{2}_[a-z0-9_]+[.]webp)'\)/g)];
  assert.equal(assignments.length, 26);
  assert.deepEqual(
    assignments.map((match) => match[1]),
    Array.from({ length: 26 }, (_, index) => String(index + 1).padStart(2, "0")),
  );
  assert.deepEqual(assignments.map((match) => match[2]), assignments.map((match) => match[1]));

  assert.match(migration, /Амманы җомакълары/);
  assert.match(migration, /Ammanı comaqları/);
  assert.match(migration, /Сабаннга барабыз!/);
  assert.match(migration, /Sabanña barabız!/);
  assert.match(migration, /current_version = '2026[.]09[.]23[.]2'/);
  assert.match(nameCorrection, /Сют саууу/);
  assert.match(nameCorrection, /Süt sawuu/);
  assert.match(nameCorrection, /current_version = '2026[.]09[.]23[.]3'/);
  assert.match(styles, /beginnerDioramaNode\\{width:118px;height:164px;min-height:164px;display:grid;grid-template-rows:118px minmax\\(24px,auto\\);row-gap:22px/);

  const expectedAssets = assignments.map((match) => match[3]).sort();
  const actualAssets = (await readdir(fileUrl("assets/icons/sets")))
    .filter((name) => expectedAssets.includes(name))
    .sort();
  assert.deepEqual(actualAssets, expectedAssets);

  for (const asset of actualAssets) {
    const data = await readFile(fileUrl(`assets/icons/sets/${asset}`));
    assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", asset);
    assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP", asset);
  }
});
