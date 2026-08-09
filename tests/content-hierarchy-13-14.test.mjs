import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("13.14 migration creates one thematic dictionary and preserves permanent Set IDs", async () => {
  const migration = await read("supabase/migrations/20260809040400_alantil_13_14_thematic_dictionary.sql");
  assert.match(migration, /'thematic','dictionary','pathways'/);
  assert.match(migration, /entity_id in \('universe','animals','natural_materials','plants'\)/);
  assert.match(migration, /dictionary_id='thematic'/);
  assert.match(migration, /universe\|animals\|natural_materials\|plants/);
  assert.match(migration, /Expected 4 dictionaries/);
  assert.match(migration, /Expected 10 sections/);
  assert.match(migration, /Expected 85 sets/);
  assert.match(migration, /Expected 596 thematic words/);
});

test("six level sections are localized and the final Russian level is Master", async () => {
  const migration = await read("supabase/migrations/20260809040400_alantil_13_14_thematic_dictionary.sql");
  for (const label of ["Вводный", "Базовый", "Средний", "Выше среднего", "Продвинутый", "Мастер"]) {
    assert.match(migration, new RegExp(label));
  }
  assert.doesNotMatch(migration, /name_ru='Мастерство'/);
  assert.match(migration, /name_tr='Usta'/);
  assert.match(migration, /name_alan_cyrillic='Уста'/);
});

test("Path keeps 13.14 visual behavior inside the permanent feature module", async () => {
  const feature = await read("src/features/path/feature.js");
  const styles = await read("src/features/path/path-navigation.css");
  assert.match(feature, /routeSectionHeading/);
  assert.match(feature, /LEVEL_DICTIONARIES/);
  assert.match(feature, /stationLabel/);
  assert.match(feature, /scrollIntoView\(\{ behavior: "auto", block: "nearest", inline: "center" \}\)/);
  assert.match(feature, /canScrollStart/);
  assert.match(feature, /canScrollEnd/);
  assert.match(styles, /overflow-x:auto/);
  assert.match(styles, /text-overflow:ellipsis/);
  assert.match(styles, /@media \(min-width:760px\)/);
});

test("Learn uses real thematic Set names while leaving unnamed level Sets numeric", async () => {
  const feature = await read("src/features/learn/feature.js");
  const catalog = await read("src/features/learn/catalog.js");
  assert.match(feature, /set_name/);
  assert.match(feature, /if \(!name\) return/);
  assert.match(catalog, /setNumberLabel\(setId\)/);
});

test("cached and starter dictionaries use an explicit structure compatibility adapter", async () => {
  const adapter = await read("src/shared/domain/word-structure-compat.js");
  const repository = await read("src/shared/data/word-repository.js");
  const config = await read("src/config/words.js");
  assert.match(adapter, /dictionaryId = "thematic"/);
  assert.match(adapter, /sectionId = dictionaryId/);
  assert.match(adapter, /"advanced-proficiency": \{ ru: "Мастер", en: "Proficiency", tr: "Usta"/);
  assert.match(adapter, /thematic: \{ ru: "Тематические слова", en: "Thematic Words", tr: "Tematik Kelimeler"/);
  assert.match(adapter, /"animals-07": \{ ru: "Птицы", en: "Birds", tr: "Kuşlar"/);
  assert.match(repository, /word-structure-compat\.js\?v=13\.15/);
  assert.match(config, /DICTIONARY_CACHE_KEY = "alantil_dictionary_cache_v5"/);
  assert.match(config, /"alantil_dictionary_cache_v4"/);
});

test("oblivion story has interface-language titles without changing the approved Russian intro", async () => {
  const migration = await read("supabase/migrations/20260809045500_alantil_13_14_oblivion_interface_localization.sql");
  const original = await read("supabase/migrations/20260808230307_restore_content_hierarchy.sql");
  assert.match(migration, /On the Threshold of Oblivion/);
  assert.match(migration, /Unutuluşun Eşiğinde/);
  assert.match(original, /Это история о последних мгновениях жизни языка\. Она написана скупо/);
});
