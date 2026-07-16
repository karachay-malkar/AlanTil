import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeLegacyWordEntry,
  normalizeSupabaseWordEntry,
} from "../src/shared/domain/word-normalizer.js";
import {
  getDisplayedAlanPhrases,
  getDisplayedAlanWord,
  getDisplayedDictionaryName,
  getDisplayedExample,
  getDisplayedSectionName,
  getDisplayedSetName,
  getDisplayedStoryName,
} from "../src/shared/domain/alan-display.js";

globalThis.window = {
  location: { search: "", pathname: "/", hostname: "localhost" },
  dispatchEvent() {},
};
const { renderSongLyrics } = await import("../src/features/songs/lyrics-renderer.js");

const supabaseRow = {
  word_id: "0012",
  global_order: 12,
  story_id: "ascent",
  story_name_ru: "Восхождение",
  story_name_alan_cyrillic: "Өрге барыу",
  story_name_alan_turkic: "Örge barıw",
  dictionary_id: "top",
  dictionary_name_ru: "Основной словарь",
  dictionary_name_alan_cyrillic: "Баш сёзлюк",
  dictionary_name_alan_turkic: "Baş sözlük",
  section_id: "people",
  section_name_ru: "Люди",
  section_name_alan_cyrillic: "Адамла",
  section_name_alan_turkic: "Adamla",
  set_id: "young",
  set_name_ru: "Молодёжь",
  set_name_alan_cyrillic: "Җаш тёлю",
  set_name_alan_turkic: "Caş tölü",
  pos: "noun",
  synonyms: "",
  word_alan_cyrillic: "җаш",
  word_alan_turkic: "caş",
  translation_ru: "юноша",
  phrases_alan_cyrillic: "1.1 җаш келди\n1.2 Җаш тёлю",
  phrases_alan_turkic: "1.1 caş keldi\n1.2 Caş tölü",
  phrases_ru: "1.1 юноша пришёл\n1.2 молодёжь",
  // Legacy aliases must not be consulted for a Supabase row.
  word: "неверное старое поле",
  translation: "неверный старый перевод",
};

test("v_words_app is normalized strictly and keeps both Alan scripts", () => {
  const word = normalizeSupabaseWordEntry(supabaseRow);
  assert.ok(word);
  assert.equal(word.id, "0012");
  assert.equal(word.wordAlanCyrillic, "җаш");
  assert.equal(word.wordAlanTurkic, "caş");
  assert.equal(word.translationRu, "юноша");
  assert.equal(word.dictionaryNameAlanTurkic, "Baş sözlük");

  assert.equal(normalizeSupabaseWordEntry({
    ...supabaseRow,
    word_alan_cyrillic: "",
    word: "legacy must not rescue Supabase",
  }), null);
});

test("legacy CSV normalization remains separate", () => {
  const word = normalizeLegacyWordEntry({
    id: "legacy-1",
    dict: "Словарь",
    section: "Раздел",
    set: "1",
    word: "тау",
    trans: "гора",
    example: "бийик тау ✦ высокая гора",
  });
  assert.ok(word);
  assert.equal(word.wordAlanCyrillic, "тау");
  assert.equal(word.translationRu, "гора");
  assert.equal(word.legacyExample, "бийик тау ✦ высокая гора");
});

test("Cyrillic dialect and stored Turkic text share one display layer", () => {
  const word = normalizeSupabaseWordEntry(supabaseRow);
  const karachay = { alan_script_code: "cyrillic", alan_dialect_code: "karachay" };
  const balkar = { alan_script_code: "cyrillic", alan_dialect_code: "balkar" };
  const canonical = { alan_script_code: "cyrillic", alan_dialect_code: "canonical" };
  const turkic = { alan_script_code: "turkic", alan_dialect_code: "balkar" };

  assert.equal(getDisplayedAlanWord(word, canonical), "җаш");
  assert.equal(getDisplayedAlanWord(word, karachay), "джаш");
  assert.equal(getDisplayedAlanWord(word, balkar), "жаш");
  assert.equal(getDisplayedAlanWord(word, turkic), "caş");
  assert.equal(getDisplayedAlanPhrases(word, turkic), "1.1 caş keldi\n1.2 Caş tölü");

  assert.equal(getDisplayedStoryName(word, turkic), "Örge barıw");
  assert.equal(getDisplayedDictionaryName(word, turkic), "Baş sözlük");
  assert.equal(getDisplayedSectionName(word, turkic), "Adamla");
  assert.equal(getDisplayedSetName(word, karachay), "Джаш тёлю");
  assert.equal(getDisplayedSetName(word, balkar), "Жаш тёлю");
  assert.equal(getDisplayedSetName(word, canonical), "Җаш тёлю");
  assert.equal(getDisplayedSetName(word, turkic), "Caş tölü");

  assert.equal(
    getDisplayedExample(word, karachay),
    "джаш келди ✦ юноша пришёл; Джаш тёлю ✦ молодёжь",
  );
  assert.equal(word.translationRu, "юноша");
});

test("song lookup keeps working when the displayed word uses another script", () => {
  const canonical = normalizeSupabaseWordEntry(supabaseRow);
  const displayedTurkic = {
    ...canonical,
    word: getDisplayedAlanWord(canonical, { alan_script_code: "turkic" }),
  };
  const html = renderSongLyrics("джаш келди", "юноша пришёл", [displayedTurkic]);
  assert.match(html, /data-word-id="0012"/);
  assert.match(html, />джаш<\/button>/);
});
