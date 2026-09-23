import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const fileUrl = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFile(fileUrl(path), "utf8");

test("16.7 beginner path uses DB-backed localized WebP metadata with circular fallback", async () => {
  const feature = await read("src/features/path/feature.js");
  const styles = await read("src/features/path/path.css");
  const appStyles = await read("src/shared/styles/app.css");
  const migration = await read("supabase/migrations/20260922124700_alantil_16_7_beginner_diorama_icons.sql");
  const worker = await read("service-worker.js");
  const routeScale = await read("src/shared/ui/route-scale.js");
  const groupLabelMigration = await read("supabase/migrations/20260922191240_hide_beginner_route_group_labels.sql");

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
  assert.match(feature, /BEGINNER_METADATA_CACHE_KEY = "alantil_beginner_set_metadata_v2"/);
  assert.match(feature, /SET_ICON_ASSET_VERSION = "16[.]7[.]0[.]32"/);
  assert.match(feature, /loading="eager"/);
  assert.match(feature, /fetchpriority="high"/);
  assert.match(feature, /beginnerDioramaNode[^`]*display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px/);
  assert.match(feature, /beginnerDioramaFrame" aria-hidden="true" style="position:relative;left:auto;top:auto;flex:0 0 118px/);
  assert.match(feature, /beginnerDioramaLabel" style="position:static;left:auto;top:auto;transform:none/);
  assert.doesNotMatch(feature, /loading="lazy"/);

  assert.match(styles, /beginnerDioramaNode/);
  assert.match(styles, /beginnerDioramaFrame/);
  assert.match(styles, /beginnerDioramaImage/);
  assert.match(styles, /beginnerDioramaFallback/);
  assert.match(styles, /beginnerDioramaError/);
  assert.match(styles, /beginnerDioramaImage\{[^}]*grayscale\(1\) saturate\(0\)/);
  assert.match(styles, /mastered \.beginnerDioramaImage/);
  assert.match(styles, /review_1_due \.beginnerDioramaImage/);
  assert.match(styles, /beginnerDioramaNode\\{width:168px;height:auto;min-height:148px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:6px/);
  assert.match(styles, /beginnerRouteMap \.routeCatalogGroups,.beginnerRouteMap \.routeSectionStations\{gap:33px\}/);
  assert.match(styles, /routeMap\.beginnerRouteMap\{padding-bottom:94px\}/);
  assert.match(styles, /beginnerDioramaFrame\{position:relative;left:auto;top:auto;flex:0 0 118px/);
  assert.match(styles, /beginnerDioramaLabel\{position:static;left:auto;top:auto;transform:none;flex:0 0 auto/);
  assert.doesNotMatch(styles, /beginnerDioramaLabel\{[^}]*position:absolute/);
  assert.match(styles, /font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif/);
  assert.match(appStyles, /features\/path\/path[.]css[?]v=16[.]7[.]0[.]32/);

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
  const actualBeginnerAssets = actualAssets.filter((name) => expectedAssets.includes(name));
  assert.deepEqual(actualBeginnerAssets, [...expectedAssets].sort());

  for (const asset of actualAssets) {
    const data = await readFile(fileUrl(`assets/icons/sets/${asset}`));
    assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", asset);
    assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP", asset);
  }

  assert.match(routeScale, /node\.querySelector\("\.beginnerDioramaFrame"\) \|\| node\.querySelector\("\.stationProgressRing"\) \|\| node/);
  assert.match(feature, /String\(catalogId\|\|""\)!=="beginner"/);
  assert.match(feature, /String\(catalog\.catalogId\|\|""\)!=="beginner"/);
  assert.match(feature, /beginnerRouteMap/);
  assert.match(groupLabelMigration, /entity_id in \('beginner-elementary', 'beginner-lower'\)/);
  assert.match(groupLabelMigration, /name_ru = null/);
  assert.match(groupLabelMigration, /current_version = '2026[.]09[.]23[.]1'/);
  assert.match(groupLabelMigration, /name_ru = 'Начальный'/);
  assert.match(worker, /const VERSION = "16[.]7[.]0[.]32"/);
});

test("16.7 beginner set titles are localized in ru/en/tr", async () => {
  const names = await read("supabase/migrations/20260922123000_alantil_16_7_beginner_set_names.sql");
  const correction = await read("supabase/migrations/20260922124600_alantil_16_7_beginner_set_name_correction.sql");
  const polish = await read("supabase/migrations/20260922163200_alantil_16_7_beginner_set_name_polish.sql");

  assert.equal([...names.matchAll(/\(\$q\$beginner-\d{2}\$q\$,\s*\$q\$/g)].length, 30);
  assert.match(names, /Мост через горную реку/);
  assert.match(names, /Bridge over a Mountain River/);
  assert.match(names, /Dağ Nehri Üzerindeki Köprü/);
  assert.match(correction, /Проезжая через поселок/);
  assert.match(polish, /Проезжая через посёлок/);
  assert.match(polish, /Тихое озеро/);
  assert.match(polish, /Quiet Lake/);
  assert.match(polish, /Sakin Göl/);
});

test("16.7.0.32 cache version is wired through the startup chain", async () => {
  const index = await read("index.html");
  const bootstrap = await read("src/app/bootstrap.js");
  const router = await read("src/app/router.js");
  const worker = await read("service-worker.js");

  assert.match(index, /targetVersion = "16[.]7[.]0[.]32"/);
  assert.match(index, /bootstrap[.]js[?]v=16[.]7[.]0[.]32/);
  assert.match(bootstrap, /router[.]js[?]v=16[.]7[.]0[.]32/);
  assert.match(bootstrap, /ASSET_VERSION = "16[.]7[.]0[.]32"/);
  assert.match(router, /ASSET_VERSION = "16[.]7[.]0[.]32"/);
  assert.match(worker, /VERSION = "16[.]7[.]0[.]32"/);
  assert.match(worker, /LEGACY_REFRESH_BEFORE_VERSION = "16[.]7[.]0[.]32"/);
});
