import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("13.13 content source exposes the real hierarchy", async () => {
  const config = await read("src/config/words.js");
  const normalizer = await read("src/shared/domain/word-normalizer.js");
  const selection = await read("src/shared/domain/word-selection.js");
  const route = await read("src/shared/domain/learning-route.js");
  assert.match(config, /DICTIONARY_CONTENT_TABLE = "v_words_app"/);
  assert.match(normalizer, /const sectionId = normalizeId\(row\.section_id\)/);
  assert.match(selection, /export function sectionsFrom/);
  assert.match(selection, /export function wordsForSection/);
  assert.match(route, /storyType, station\.dictionaryId, station\.sectionId, station\.setId/);
  assert.match(route, /sectionsMap/);
});

test("Test and Match stop scope selection at Section and retain 20 40 80", async () => {
  const testView = await read("src/features/test/view.js");
  const matchView = await read("src/features/match/view.js");
  const testEngine = await read("src/features/test/engine.js");
  const matchEngine = await read("src/features/match/engine.js");
  assert.match(testView, /data-section=/);
  assert.match(matchView, /data-section=/);
  assert.doesNotMatch(testView, /class="scopeCheckbox scopeSet"/);
  assert.doesNotMatch(matchView, /class="scopeCheckbox matchScopeSet"/);
  assert.match(testView, /\[20, 40, 80\]/);
  assert.match(matchView, /\[20, 40, 80\]/);
  assert.match(testEngine, /\[20, 40, 80\]\.includes/);
  assert.match(matchEngine, /\[20, 40, 80\]\.includes/);
});

test("Settings has no station-size concept and is loaded as 13.13", async () => {
  const settings = await read("src/features/settings/index.js");
  const router = await read("src/app/router.js");
  const worker = await read("service-worker.js");
  assert.doesNotMatch(settings, /station_size|getStationSize|stationSize/);
  assert.match(settings, /SETTINGS_ASSET_VERSION = "13\.13"/);
  assert.match(router, /features\/settings\/index\.js\?v=13\.13/);
  assert.match(worker, /url\.pathname\.startsWith\("\/src\/features\/settings\/"\)/);
});

test("missing structure names never fall back to internal IDs", async () => {
  const display = await read("src/shared/domain/alan-display.js");
  const learnCatalog = await read("src/features/learn/catalog.js");
  assert.doesNotMatch(display, /dictionaryName\s*\|\|\s*dictionaryId/);
  assert.doesNotMatch(display, /sectionName\s*\|\|\s*sectionId/);
  assert.doesNotMatch(display, /setName\s*\|\|\s*setId/);
  assert.match(learnCatalog, /setNumberLabel/);
});

test("approved first story and hierarchy counts are locked in the forward migration", async () => {
  const migration = await read("supabase/migrations/20260808230307_restore_content_hierarchy.sql");
  assert.match(migration, /'oblivion','story',null,1/);
  assert.match(migration, /'На пороге забвения'/);
  assert.match(migration, /Это история о последних мгновениях жизни языка\./);
  assert.match(migration, /Expected 2355 words after hierarchy migration/);
  assert.match(migration, /Expected 85 sets after hierarchy migration/);
  assert.match(migration, /Expected 31 sections/);
});
