import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const fileUrl = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fileUrl(path), "utf8");

test("16.7 beginner path uses DB-backed localized WebP metadata with circular fallback", async () => {
  const feature = await read("src/features/path/feature.js");
  const styles = await read("src/features/path/path.css");
  const migration = await read("supabase/migrations/20260922124700_alantil_16_7_beginner_diorama_icons.sql");
  const worker = await read("service-worker.js");

  assert.match(feature, /content_structure/);
  assert.match(feature, /entity_id,icon_name,name_ru,name_en,name_tr/);
  assert.match(feature, /BEGINNER_METADATA_CACHE_KEY/);
  assert.match(feature, /getInterfaceLanguage/);
  assert.match(feature, /applyBeginnerSetMetadataToRoute/);
  assert.match(feature, /beginnerDioramaFrame/);
  assert.match(feature, /beginnerDioramaImage/);
  assert.match(feature, /beginnerDioramaFallback/);
  assert.match(feature, /beginnerDioramaError/);
  assert.match(feature, /stationProgressRing beginnerDioramaFallback/);
  assert.match(feature, /SET_ICON_ASSET_VERSION = "16[.]7[.]0[.]19"/);

  assert.match(styles, /beginnerDioramaNode/);
  assert.match(styles, /beginnerDioramaFrame/);
  assert.match(styles, /beginnerDioramaImage/);
  assert.match(styles, /beginnerDioramaFallback/);
  assert.match(styles, /beginnerDioramaError/);

  assert.match(migration, /add column if not exists icon_name text/);
  const assignments = [...migration.matchAll(/\('beginner-(\d{2})', '(\d{2})_[a-z0-9_]+[.]webp'\)/g)];
  assert.equal(assignments.length, 30);
  assert.deepEqual(
    assignments.map((match) => match[1]),
    Array.from({ length: 30 }, (_, index) => String(index + 1).padStart(2, "0")),
  );
  assert.deepEqual(assignments.map((match) => match[2]), assignments.map((match) => match[1]));

  const expectedAssets = assignments.map((match) => migration.slice(match.index).match(/'((?:0[1-9]|[12]\d|30)_[a-z0-9_]+[.]webp)'/)?.[1]);
  assert.equal(expectedAssets.filter(Boolean).length, 30);
  const actualAssets = (await readdir(fileUrl("assets/icons/sets"))).filter((name) => name.endsWith(".webp")).sort();
  assert.deepEqual(actualAssets, [...expectedAssets].sort());

  for (const asset of actualAssets) {
    const data = await readFile(fileUrl(`assets/icons/sets/${asset}`));
    assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", asset);
    assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP", asset);
  }

  assert.match(worker, /const VERSION = "16[.]7[.]0[.]19"/);
});

test("16.7 beginner set titles are localized in ru/en/tr", async () => {
  const names = await read("supabase/migrations/20260922123000_alantil_16_7_beginner_set_names.sql");
  const correction = await read("supabase/migrations/20260922124600_alantil_16_7_beginner_set_name_correction.sql");

  assert.equal([...names.matchAll(/\(\$q\$beginner-\d{2}\$q\$,\s*\$q\$/g)].length, 30);
  assert.match(names, /Мост через горную реку/);
  assert.match(names, /Bridge over a Mountain River/);
  assert.match(names, /Dağ Nehri Üzerindeki Köprü/);
  assert.match(correction, /Проезжая через поселок/);
});

test("16.7.0.19 cache version is wired through the startup chain", async () => {
  const index = await read("index.html");
  const bootstrap = await read("src/app/bootstrap.js");
  const router = await read("src/app/router.js");
  const worker = await read("service-worker.js");

  assert.match(index, /targetVersion = "16[.]7[.]0[.]19"/);
  assert.match(index, /bootstrap[.]js[?]v=16[.]7[.]0[.]19/);
  assert.match(bootstrap, /router[.]js[?]v=16[.]7[.]0[.]19/);
  assert.match(bootstrap, /ASSET_VERSION = "16[.]7[.]0[.]19"/);
  assert.match(router, /ASSET_VERSION = "16[.]7[.]0[.]19"/);
  assert.match(worker, /VERSION = "16[.]7[.]0[.]19"/);
  assert.match(worker, /LEGACY_REFRESH_BEFORE_VERSION = "16[.]7[.]0[.]19"/);
});
