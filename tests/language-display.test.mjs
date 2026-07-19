import assert from "node:assert/strict";
import test from "node:test";

const memory = new Map();
globalThis.localStorage = {
  getItem(key) { return memory.has(key) ? memory.get(key) : null; },
  setItem(key, value) { memory.set(key, String(value)); },
  removeItem(key) { memory.delete(key); },
};
globalThis.window = {
  dispatchEvent() {},
  addEventListener() {},
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
};

const display = await import(new URL("../src/shared/domain/alan-display.js", import.meta.url));

const word = {
  wordAlanCyrillic: "җигер",
  wordAlanTurkic: "ciger",
  translationRu: "деятельный",
  translationEn: "energetic",
  translationTr: "gayretli",
  phrasesAlanCyrillic: "1.1 җигер урунуу",
  phrasesAlanTurkic: "1.1 ciger urunuw",
  phrasesRu: "1.1 доблестный труд",
  phrasesEn: "1.1 valiant work",
  phrasesTr: "1.1 yiğitçe emek",
  storyNameRu: "Восхождение",
  storyNameEn: "Ascent",
  storyNameTr: "Yükseliş",
};

test("interface language and Alan script are independent", () => {
  const shown = display.getDisplayedWordEntry(word, {
    interface_language_code: "en",
    translation_language_code: "en",
    alan_script_code: "cyrillic",
    alan_dialect_code: "karachay",
  });
  assert.equal(shown.word, "джигер");
  assert.equal(shown.trans, "energetic");
  assert.equal(shown.story_name, "Ascent");
  assert.equal(shown.example, "1.1 джигер урунуу ✦ valiant work");
});

test("missing Turkish structure text never falls back to another language", () => {
  const shown = display.getDisplayedWordEntry({
    ...word,
    storyId: "ascent",
    storyNameTr: "",
    dictionaryId: "2",
    dictionaryNameRu: "Основные слова",
    dictionaryNameTr: "",
    sectionId: "3",
    sectionNameRu: "Сложный",
    sectionNameTr: "",
    dict: "Основные слова",
    section: "Сложный",
  }, {
    interface_language_code: "tr",
    translation_language_code: "tr",
    alan_script_code: "turkic",
    alan_dialect_code: "canonical",
  });
  assert.equal(shown.word, "ciger");
  assert.equal(shown.story_name, "Yol ascent");
  assert.equal(shown.dictionary_name, "Sözlük 2");
  assert.equal(shown.section_name, "Bölüm 3");
  assert.equal(shown.dict, "Sözlük 2");
  assert.equal(shown.section, "Bölüm 3");
  assert.equal(shown.trans, "gayretli");
  assert.doesNotMatch([shown.story_name, shown.dictionary_name, shown.section_name, shown.dict, shown.section].join(" "), /Основные слова|Сложный/);
});
