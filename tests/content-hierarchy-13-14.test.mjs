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

test("Path removes level Set text labels, restores Section headings and exposes horizontal story navigation", async () => {
  const entry = await read("src/features/path/entry-13-14.js");
  const styles = await read("src/features/path/path-13-14.css");
  assert.match(entry, /routeSectionHeading/);
  assert.match(entry, /\["beginner", "intermediate", "advanced"\]/);
  assert.match(entry, /\.stationLabel/);
  assert.match(entry, /scrollIntoView\(\{ behavior: "auto", block: "nearest", inline: "center" \}\)/);
  assert.match(entry, /canScrollStart/);
  assert.match(entry, /canScrollEnd/);
  assert.match(styles, /overflow-x:auto/);
  assert.match(styles, /text-overflow:ellipsis/);
  assert.match(styles, /@media \(min-width:760px\)/);
});

test("Learn uses real thematic Set names while leaving unnamed level Sets numeric", async () => {
  const entry = await read("src/features/learn/entry-13-14.js");
  const catalog = await read("src/features/learn/catalog.js");
  assert.match(entry, /set_name/);
  assert.match(entry, /if \(!name\) continue/);
  assert.match(catalog, /setNumberLabel\(setId\)/);
});

test("old cached thematic dictionaries are adapted to the new hierarchy", async () => {
  const adapter = await read("src/shared/domain/word-normalizer-13-14.js");
  const config = await read("src/config/words.js");
  assert.match(adapter, /dictionaryId: "thematic"/);
  assert.match(adapter, /sectionId: oldDictionary/);
  assert.match(adapter, /setNameRu: oldTopicNameRu/);
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
