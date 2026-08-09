import * as base from "/src/shared/domain/word-normalizer.js?v=13.13&base=1";

const THEMATIC_SECTIONS = new Set(["universe", "animals", "natural_materials", "plants"]);

const STORY_NAMES = Object.freeze({
  oblivion: { ru: "На пороге забвения", en: "On the Threshold of Oblivion", tr: "Unutuluşun Eşiğinde" },
  roots: { ru: "Возвращение к истокам", en: "Back to the Roots", tr: "Köklere Dönüş" },
  ascent: { ru: "Восхождение", en: "Ascent", tr: "Tırmanış" },
  pathways: { ru: "Тропы", en: "Pathways", tr: "Patikalar" },
});

const DICTIONARY_NAMES = Object.freeze({
  beginner: { ru: "Начальный", en: "Beginner", tr: "Başlangıç" },
  intermediate: { ru: "Средний", en: "Intermediate", tr: "Orta" },
  advanced: { ru: "Продвинутый", en: "Advanced", tr: "İleri Seviye" },
  thematic: { ru: "Тематические слова", en: "Thematic Words", tr: "Tematik Kelimeler" },
});

const SECTION_NAMES = Object.freeze({
  "beginner-starter": { ru: "Вводный", en: "Starter", tr: "Başlangıç", alanCyrillic: "Башланыу", alanTurkic: "Başlanıw" },
  "beginner-elementary": { ru: "Базовый", en: "Elementary", tr: "Temel", alanCyrillic: "Тамал", alanTurkic: "Tamal" },
  "intermediate-intermediate": { ru: "Средний", en: "Intermediate", tr: "Orta", alanCyrillic: "Орта", alanTurkic: "Orta" },
  "intermediate-upper-intermediate": { ru: "Выше среднего", en: "Upper-Intermediate", tr: "Orta Üstü", alanCyrillic: "Ортадан ёрге", alanTurkic: "Ortadan örge" },
  "advanced-advanced": { ru: "Продвинутый", en: "Advanced", tr: "İleri", alanCyrillic: "Къыйын дараҗа", alanTurkic: "Qıyın daraca" },
  "advanced-proficiency": { ru: "Мастер", en: "Proficiency", tr: "Usta", alanCyrillic: "Уста", alanTurkic: "Usta" },
  universe: { ru: "Вселенная", en: "Universe", tr: "Evren", alanCyrillic: "Алам", alanTurkic: "Alam" },
  animals: { ru: "Животные", en: "Animals", tr: "Hayvanlar", alanCyrillic: "Җаныуарла", alanTurkic: "Canıwarla" },
  natural_materials: { ru: "Природные материалы", en: "Natural Materials", tr: "Doğal Malzemeler", alanCyrillic: "Табийгъат материалла", alanTurkic: "Tabiyğat materialla" },
  plants: { ru: "Растения", en: "Plants", tr: "Bitkiler", alanCyrillic: "Гяхинле", alanTurkic: "Gyaxinle" },
});

const SET_NAMES = Object.freeze({
  "universe-01": { ru: "Времена года", en: "Seasons", tr: "Mevsimler" },
  "universe-02": { ru: "Месяцы года", en: "Months of the Year", tr: "Yılın Ayları" },
  "universe-03": { ru: "Дни недели", en: "Days of the Week", tr: "Haftanın Günleri" },
  "universe-04": { ru: "Космос", en: "Space", tr: "Uzay" },
  "universe-05": { ru: "Цвета", en: "Colours", tr: "Renkler" },
  "animals-01": { ru: "Водная фауна", en: "Aquatic Fauna", tr: "Su Faunası" },
  "animals-02": { ru: "Всеядные, травоядные и грызуны", en: "Omnivores, Herbivores and Rodents", tr: "Hepçiller, Otçullar ve Kemirgenler" },
  "animals-03": { ru: "Домашние животные", en: "Domestic Animals", tr: "Evcil Hayvanlar" },
  "animals-04": { ru: "Земноводные и рептилии", en: "Amphibians and Reptiles", tr: "İki Yaşamlılar ve Sürüngenler" },
  "animals-05": { ru: "Пауки, черви и насекомые", en: "Spiders, Worms and Insects", tr: "Örümcekler, Solucanlar ve Böcekler" },
  "animals-06": { ru: "Приматы и сумчатые", en: "Primates and Marsupials", tr: "Primatlar ve Keseliler" },
  "animals-07": { ru: "Птицы", en: "Birds", tr: "Kuşlar" },
  "animals-08": { ru: "Хищники и млекопитающие", en: "Predators and Mammals", tr: "Yırtıcılar ve Memeliler" },
  "natural_materials-01": { ru: "Горные породы", en: "Rocks", tr: "Kayaçlar" },
  "natural_materials-02": { ru: "Металлы", en: "Metals", tr: "Metaller" },
  "natural_materials-03": { ru: "Минералы", en: "Minerals", tr: "Mineraller" },
  "natural_materials-04": { ru: "Неметаллы", en: "Non-metals", tr: "Ametaller" },
  "natural_materials-05": { ru: "Другие материалы", en: "Other Materials", tr: "Diğer Malzemeler" },
  "plants-01": { ru: "Деревья", en: "Trees", tr: "Ağaçlar" },
  "plants-02": { ru: "Орехи, злаки и бобовые", en: "Nuts, Grains and Legumes", tr: "Kuruyemişler, Tahıllar ve Baklagiller" },
  "plants-03": { ru: "Другие растения", en: "Other Plants", tr: "Diğer Bitkiler" },
  "plants-04": { ru: "Специи и зелень", en: "Spices and Herbs", tr: "Baharatlar ve Yeşillikler" },
  "plants-05": { ru: "Фрукты, овощи", en: "Fruit and Vegetables", tr: "Meyveler ve Sebzeler" },
  "plants-06": { ru: "Цветы", en: "Flowers", tr: "Çiçekler" },
  "plants-07": { ru: "Ягоды и кустарники", en: "Berries and Shrubs", tr: "Meyveler ve Çalılar" },
});

function applyNames(word, storyId, dictionaryId, sectionId, setId) {
  const story = STORY_NAMES[storyId];
  const dictionary = DICTIONARY_NAMES[dictionaryId];
  const section = SECTION_NAMES[sectionId];
  const set = SET_NAMES[setId];
  return {
    ...word,
    ...(story ? {
      storyNameRu: story.ru,
      storyNameEn: story.en,
      storyNameTr: story.tr,
      story_name: story.ru,
    } : {}),
    ...(dictionary ? {
      dictionaryNameRu: dictionary.ru,
      dictionaryNameEn: dictionary.en,
      dictionaryNameTr: dictionary.tr,
      dictionary_name: dictionary.ru,
      dict: dictionary.ru,
    } : {}),
    ...(section ? {
      sectionNameRu: section.ru,
      sectionNameEn: section.en,
      sectionNameTr: section.tr,
      sectionNameAlanCyrillic: section.alanCyrillic || "",
      sectionNameAlanTurkic: section.alanTurkic || "",
      section_name: section.ru,
      section: section.ru,
    } : {}),
    ...(set ? {
      setNameRu: set.ru,
      setNameEn: set.en,
      setNameTr: set.tr,
      set_name: set.ru,
      set: set.ru,
    } : {}),
  };
}

function adaptStructure(word) {
  if (!word || typeof word !== "object") return word;
  let dictionaryId = String(word.dictionaryId || word.dictionary_id || "").trim();
  let sectionId = String(word.sectionId || word.section_id || "").trim();
  const setId = String(word.setId || word.set_id || "").trim();
  let storyId = String(word.storyId || word.story_id || word.story_type || "").trim();

  if (THEMATIC_SECTIONS.has(dictionaryId)) {
    sectionId = dictionaryId;
    dictionaryId = "thematic";
    storyId = "pathways";
  }

  const structural = {
    ...word,
    dictionaryId,
    dictionary_id: dictionaryId,
    catalog_id: dictionaryId,
    sectionId,
    section_id: sectionId,
    group_id: sectionId,
    storyId,
    story_id: storyId,
    story_type: storyId,
  };
  return applyNames(structural, storyId, dictionaryId, sectionId, setId);
}

export const normalizeId = base.normalizeId;
export const normalizePos = base.normalizePos;
export const parseSynonyms = base.parseSynonyms;
export const parseUsedInTest = base.parseUsedInTest;
export const permanentSectionId = base.permanentSectionId;
export const storyIdForDictionary = base.storyIdForDictionary;

export function normalizeSupabaseWordEntry(row, story = null) {
  return base.normalizeSupabaseWordEntry(row, story);
}

export function normalizeLegacyWordEntry(row) {
  return adaptStructure(base.normalizeLegacyWordEntry(row));
}

export function normalizeWordEntry(row, options = {}) {
  return adaptStructure(base.normalizeWordEntry(row, options));
}
