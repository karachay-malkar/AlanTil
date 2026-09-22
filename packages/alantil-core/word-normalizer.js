export function normalizeId(id) {
  return String(id ?? "").trim();
}

export function normalizePos(value) {
  return String(value || "").trim().toLowerCase();
}

export function parseSynonyms(raw) {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean);
  }
  return String(raw || "")
    .toLowerCase()
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseUsedInTest(rawValue, hasColumn = true) {
  if (!hasColumn) return true;
  const normalized = String(rawValue ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function text(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry || "").trim()).filter(Boolean).join("\n");
  if (value && typeof value === "object") return text(Object.values(value));
  return String(value || "").trim();
}

function numberValue(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function setOrdinal(setId) {
  const match = String(setId || "").match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

const THEMATIC_SECTION_BY_SET = Object.freeze({
  "universe-01": "universe-seasons",
  "universe-02": "universe-months",
  "universe-03": "universe-weekdays",
  "universe-04": "universe-space",
  "universe-05": "universe-colours",
  "animals-01": "animals-aquatic-fauna",
  "animals-02": "animals-omnivores-herbivores-rodents",
  "animals-03": "animals-domestic",
  "animals-04": "animals-amphibians-reptiles",
  "animals-05": "animals-spiders-worms-insects",
  "animals-06": "animals-primates-marsupials",
  "animals-07": "animals-birds",
  "animals-08": "animals-predators-mammals",
  "natural_materials-01": "natural-materials-rocks",
  "natural_materials-02": "natural-materials-metals",
  "natural_materials-03": "natural-materials-minerals",
  "natural_materials-04": "natural-materials-non-metals",
  "natural_materials-05": "natural-materials-other",
  "plants-01": "plants-trees",
  "plants-02": "plants-nuts-grains-legumes",
  "plants-03": "plants-other",
  "plants-04": "plants-spices-herbs",
  "plants-05": "plants-fruit-vegetables",
  "plants-06": "plants-flowers",
  "plants-07": "plants-berries-shrubs",
});

export function permanentSectionId(dictionaryId, setId) {
  const dictionary = normalizeId(dictionaryId);
  const set = normalizeId(setId);
  const ordinal = setOrdinal(set);
  if (dictionary === "beginner") return ordinal > 0 && ordinal <= 15 ? "beginner-starter" : "beginner-elementary";
  if (dictionary === "intermediate") return ordinal > 0 && ordinal <= 6 ? "intermediate-intermediate" : "intermediate-upper-intermediate";
  if (dictionary === "advanced") return ordinal > 0 && ordinal <= 10 ? "advanced-advanced" : "advanced-proficiency";
  return THEMATIC_SECTION_BY_SET[set] || "";
}

const LEGACY_UNDERSTANDING_STORY_ID = "oblivion";
const UNDERSTANDING_STORY_ID = "understanding";
const UNDERSTANDING_STORY_CONTENT = Object.freeze({
  ru: Object.freeze({ name: "Начать понимать", intro: "Каждый раз, оказываясь в родных краях, не можешь отделаться от странного чувства. Будто между тобой и этими местами стоит невидимая преграда, не дающая почувствовать себя здесь по-настоящему дома.\n\nЯзык слышен повсюду — в разговорах, песнях, случайных фразах. Звучание кажется знакомым, но смысл почти всегда ускользает. Песни остаются мелодиями, а речь — потоком слов, за которыми трудно уловить настоящую мысль.\n\nНачать с основ — лучший способ избавиться от ощущения, что ты здесь всего лишь турист. С этого и начинается твой первый путь." }),
  en: Object.freeze({ name: "Begin to Understand", intro: "Whenever you find yourself back in your homeland, you can't shake a strange feeling. It's as if an invisible barrier stands between you and these places, keeping you from truly feeling at home here.\n\nThe language is everywhere — in conversations, songs, and passing phrases. It sounds familiar, yet the meaning almost always slips away. Songs remain melodies, while speech becomes a stream of words whose real meaning is difficult to grasp.\n\nStarting with the basics is the best way to leave behind the feeling that you're only a tourist here. This is where your first path begins." }),
  tr: Object.freeze({ name: "Anlamaya Başlamak", intro: "Her memlekete geldiğinde içinden atamadığın tuhaf bir duygu beliriyor. Sanki seninle bu yerler arasında, burada gerçekten evinde hissetmene engel olan görünmez bir perde var.\n\nDil her yerde duyuluyor — konuşmalarda, şarkılarda, arada söylenen cümlelerde. Tınısı tanıdık geliyor ama anlamı çoğu zaman kaçıp gidiyor. Şarkılar melodi olarak kalıyor, konuşmalar ise ardındaki gerçek anlamı yakalamanın zor olduğu bir kelime akışına dönüşüyor.\n\nTemelden başlamak, burada yalnızca bir turistmişsin gibi hissetmekten kurtulmanın en iyi yolu. İlk yolun da burada başlıyor." }),
});

function canonicalStoryId(value) {
  const storyId = normalizeId(value);
  return storyId === LEGACY_UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_ID : storyId;
}

export function storyIdForDictionary(dictionaryId) {
  const dictionary = normalizeId(dictionaryId);
  if (dictionary === "beginner") return UNDERSTANDING_STORY_ID;
  if (dictionary === "intermediate") return "roots";
  if (dictionary === "advanced") return "ascent";
  if (["universe", "animals", "natural_materials", "plants"].includes(dictionary)) return "pathways";
  return "";
}

const LEGACY_DICTIONARY_NAMES_RU = Object.freeze({
  beginner: "Начальный",
  intermediate: "Средний",
  advanced: "Продвинутый",
  universe: "Вселенная",
  animals: "Животные",
  natural_materials: "Природные материалы",
  plants: "Растения",
});

const LEGACY_SECTION_NAMES_RU = Object.freeze({
  "beginner-starter": "Starter",
  "beginner-elementary": "Elementary",
  "intermediate-intermediate": "Intermediate",
  "intermediate-upper-intermediate": "Upper-Intermediate",
  "advanced-advanced": "Advanced",
  "advanced-proficiency": "Proficiency",
  "universe-seasons": "Времена года",
  "universe-months": "Месяцы года",
  "universe-weekdays": "Дни недели",
  "universe-space": "Космос",
  "universe-colours": "Цвета",
  "animals-aquatic-fauna": "Водная фауна",
  "animals-omnivores-herbivores-rodents": "Всеядные, травоядные и грызуны",
  "animals-domestic": "Домашние животные",
  "animals-amphibians-reptiles": "Земноводные и рептилии",
  "animals-spiders-worms-insects": "Пауки, черви и насекомые",
  "animals-primates-marsupials": "Приматы и сумчатые",
  "animals-birds": "Птицы",
  "animals-predators-mammals": "Хищники и млекопитающие",
  "natural-materials-rocks": "Горные породы",
  "natural-materials-metals": "Металлы",
  "natural-materials-minerals": "Минералы",
  "natural-materials-non-metals": "Неметаллы",
  "natural-materials-other": "Другие материалы",
  "plants-trees": "Деревья",
  "plants-nuts-grains-legumes": "Орехи, злаки и бобовые",
  "plants-other": "Другие растения",
  "plants-spices-herbs": "Специи и зелень",
  "plants-fruit-vegetables": "Фрукты, овощи",
  "plants-flowers": "Цветы",
  "plants-berries-shrubs": "Ягоды и кустарники",
});

function commonRouteFields(row) {
  return {
    order_override: numberValue(row.order_override),
    background_segment: text(row.background_segment),
    position_x: nullableNumber(row.position_x),
    position_y: nullableNumber(row.position_y),
    required_accuracy: nullableNumber(row.required_accuracy),
    reward_id: text(row.reward_id),
    is_optional: ["1", "true", "yes"].includes(text(row.is_optional).toLowerCase()),
    review_schedule: text(row.review_schedule),
  };
}

function completeModel(model, row = {}) {
  const dictionaryId = normalizeId(model.dictionaryId);
  const sectionId = normalizeId(model.sectionId);
  const setId = normalizeId(model.setId);
  const storyId = normalizeId(model.storyId);
  const storyNameRu = text(model.storyNameRu);
  const dictionaryNameRu = text(model.dictionaryNameRu);
  const sectionNameRu = text(model.sectionNameRu);
  const setNameRu = text(model.setNameRu);

  const normalized = {
    ...model,
    id: normalizeId(model.id),
    word_id: normalizeId(model.id),
    global_order: numberValue(model.globalOrder),
    dict_order: numberValue(model.globalOrder),
    story_id: storyId,
    story_type: storyId,
    dictionary_id: dictionaryId,
    catalog_id: dictionaryId,
    section_id: sectionId,
    group_id: sectionId,
    set_id: setId,
    pos: text(model.pos),
    synonyms: parseSynonyms(model.synonyms),
    word: text(model.wordAlanCyrillic),
    trans: text(model.translationRu),
    example: text(model.legacyExample),
    story_name: storyNameRu,
    story_intro: text(model.storyIntroRu),
    dictionary_name: dictionaryNameRu,
    section_name: sectionNameRu,
    set_name: setNameRu,
    dict: dictionaryNameRu,
    section: sectionNameRu,
    set: setNameRu,
    usedInTest: typeof row.usedInTest === "boolean"
      ? row.usedInTest
      : parseUsedInTest(row.used_in_test, row.used_in_test !== undefined),
    ...commonRouteFields(row),
  };

  if (!normalized.id || !storyId || !dictionaryId || !sectionId || !setId || !normalized.wordAlanCyrillic || !normalized.translationRu) return null;
  return normalized;
}

function storyValue(story, row, key, fallbackKey = key) {
  return text(story?.[key] ?? row?.[fallbackKey]);
}

export function normalizeSupabaseWordEntry(row, story = null) {
  if (!row || typeof row !== "object") return null;
  const dictionaryId = normalizeId(row.dictionary_id);
  const sectionId = normalizeId(row.section_id);
  const setId = normalizeId(row.set_id);
  const storyId = canonicalStoryId(story?.story_id || row.story_id || storyIdForDictionary(dictionaryId));
  const model = {
    sourceType: "v_words_app",
    id: normalizeId(row.word_id),
    globalOrder: numberValue(row.global_order),
    storyId,
    dictionaryId,
    sectionId,
    setId,
    pos: text(row.pos),
    synonyms: row.synonyms,

    wordAlanCyrillic: text(row.word_alan_cyrillic),
    wordAlanTurkic: text(row.word_alan_turkic),
    translationRu: text(row.translation_ru),
    translationEn: text(row.translation_en),
    translationTr: text(row.translation_tr),
    phrasesAlanCyrillic: text(row.phrases_alan_cyrillic),
    phrasesAlanTurkic: text(row.phrases_alan_turkic),
    phrasesRu: text(row.phrases_ru),
    phrasesEn: text(row.phrases_en),
    phrasesTr: text(row.phrases_tr),

    storyNameRu: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.ru.name : storyValue(story, row, "name_ru", "story_name_ru"),
    storyNameEn: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.en.name : storyValue(story, row, "name_en", "story_name_en"),
    storyNameTr: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.tr.name : storyValue(story, row, "name_tr", "story_name_tr"),
    storyNameAlanCyrillic: storyValue(story, row, "name_alan_cyrillic", "story_name_alan_cyrillic"),
    storyNameAlanTurkic: storyValue(story, row, "name_alan_turkic", "story_name_alan_turkic"),
    storyIntroRu: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.ru.intro : storyValue(story, row, "intro_ru", "story_intro_ru"),
    storyIntroEn: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.en.intro : storyValue(story, row, "intro_en", "story_intro_en"),
    storyIntroTr: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.tr.intro : storyValue(story, row, "intro_tr", "story_intro_tr"),
    storyIntroAlanCyrillic: storyValue(story, row, "intro_alan_cyrillic", "story_intro_alan_cyrillic"),
    storyIntroAlanTurkic: storyValue(story, row, "intro_alan_turkic", "story_intro_alan_turkic"),
    dictionaryNameRu: text(row.dictionary_name_ru),
    dictionaryNameEn: text(row.dictionary_name_en),
    dictionaryNameTr: text(row.dictionary_name_tr),
    dictionaryNameAlanCyrillic: text(row.dictionary_name_alan_cyrillic),
    dictionaryNameAlanTurkic: text(row.dictionary_name_alan_turkic),
    sectionNameRu: text(row.section_name_ru),
    sectionNameEn: text(row.section_name_en),
    sectionNameTr: text(row.section_name_tr),
    sectionNameAlanCyrillic: text(row.section_name_alan_cyrillic),
    sectionNameAlanTurkic: text(row.section_name_alan_turkic),
    setNameRu: text(row.set_name_ru),
    setNameEn: text(row.set_name_en),
    setNameTr: text(row.set_name_tr),
    setNameAlanCyrillic: text(row.set_name_alan_cyrillic),
    setNameAlanTurkic: text(row.set_name_alan_turkic),
    legacyExample: "",
  };
  return completeModel(model, row);
}

function normalizeLegacyScope(row) {
  const legacySection = normalizeId(row.section_id || row.group_id || row.section || row.folder);
  let dictionaryId = normalizeId(row.dictionary_id || row.catalog_id || row.dict);
  let setId = normalizeId(row.set_id || row.set);
  const dictionaryBySection = {
    "1": "beginner",
    "2": "intermediate",
    "3": "advanced",
    "4": "universe",
    "5": "animals",
    "6": "natural_materials",
    "7": "plants",
  };
  if (dictionaryBySection[legacySection]) dictionaryId = dictionaryBySection[legacySection];
  if (!setId && dictionaryId) {
    const order = numberValue(row.global_order, row.dict_order);
    const starts = { beginner: 1, intermediate: 882, advanced: 1199 };
    if (starts[dictionaryId]) {
      setId = `${dictionaryId}-${String(Math.floor((order - starts[dictionaryId]) / 30) + 1).padStart(2, "0")}`;
    }
  } else if (/^\d+$/.test(setId) && dictionaryId) {
    const offsets = { universe: 0, animals: 5, natural_materials: 13, plants: 18 };
    const ordinal = Number(setId) - (offsets[dictionaryId] || 0);
    if (ordinal > 0) setId = `${dictionaryId}-${String(ordinal).padStart(2, "0")}`;
  }
  return { dictionaryId, sectionId: permanentSectionId(dictionaryId, setId), setId };
}

export function normalizeLegacyWordEntry(row) {
  if (!row || typeof row !== "object") return null;
  const id = normalizeId(row.id || row.word_id);
  const scope = normalizeLegacyScope(row);
  const storyId = storyIdForDictionary(scope.dictionaryId);
  const model = {
    sourceType: "legacy",
    id,
    globalOrder: numberValue(row.global_order, row.dict_order),
    storyId,
    dictionaryId: scope.dictionaryId,
    sectionId: scope.sectionId,
    setId: scope.setId,
    pos: text(row.pos),
    synonyms: row.synonyms,

    wordAlanCyrillic: text(row.word_alan_cyrillic || row.word),
    wordAlanTurkic: text(row.word_alan_turkic),
    translationRu: text(row.translation_ru || row.trans || row.translation),
    translationEn: text(row.translation_en),
    translationTr: text(row.translation_tr),
    phrasesAlanCyrillic: text(row.phrases_alan_cyrillic),
    phrasesAlanTurkic: text(row.phrases_alan_turkic),
    phrasesRu: text(row.phrases_ru),
    phrasesEn: text(row.phrases_en),
    phrasesTr: text(row.phrases_tr),

    storyNameRu: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.ru.name : text(row.story_name_ru || row.story_name),
    storyNameEn: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.en.name : text(row.story_name_en),
    storyNameTr: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.tr.name : text(row.story_name_tr),
    storyNameAlanCyrillic: text(row.story_name_alan_cyrillic),
    storyNameAlanTurkic: text(row.story_name_alan_turkic),
    storyIntroRu: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.ru.intro : "",
    storyIntroEn: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.en.intro : "",
    storyIntroTr: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.tr.intro : "",
    storyIntroAlanCyrillic: "",
    storyIntroAlanTurkic: "",
    dictionaryNameRu: LEGACY_DICTIONARY_NAMES_RU[scope.dictionaryId] || "",
    dictionaryNameEn: "",
    dictionaryNameTr: "",
    dictionaryNameAlanCyrillic: "",
    dictionaryNameAlanTurkic: "",
    sectionNameRu: LEGACY_SECTION_NAMES_RU[scope.sectionId] || "",
    sectionNameEn: "",
    sectionNameTr: "",
    sectionNameAlanCyrillic: "",
    sectionNameAlanTurkic: "",
    setNameRu: "",
    setNameEn: "",
    setNameTr: "",
    setNameAlanCyrillic: "",
    setNameAlanTurkic: "",
    legacyExample: text(row.example || row.phrases || row.phrases_ru_combined),
  };
  return completeModel(model, row);
}

function normalizeCachedWordEntry(row) {
  if (!row || typeof row !== "object") return null;
  const dictionaryId = normalizeId(row.dictionaryId || row.dictionary_id || row.catalog_id);
  const setId = normalizeId(row.setId || row.set_id);
  const sectionId = normalizeId(row.sectionId || row.section_id || row.group_id || permanentSectionId(dictionaryId, setId));
  const storyId = canonicalStoryId(row.storyId || row.story_id || row.story_type || storyIdForDictionary(dictionaryId));
  const model = {
    sourceType: text(row.sourceType) || "v_words_app",
    id: normalizeId(row.id || row.word_id),
    globalOrder: numberValue(row.globalOrder, row.global_order, row.dict_order),
    storyId,
    dictionaryId,
    sectionId,
    setId,
    pos: text(row.pos),
    synonyms: row.synonyms,

    wordAlanCyrillic: text(row.wordAlanCyrillic || row.word_alan_cyrillic || row.word),
    wordAlanTurkic: text(row.wordAlanTurkic || row.word_alan_turkic),
    translationRu: text(row.translationRu || row.translation_ru || row.trans),
    translationEn: text(row.translationEn || row.translation_en),
    translationTr: text(row.translationTr || row.translation_tr),
    phrasesAlanCyrillic: text(row.phrasesAlanCyrillic || row.phrases_alan_cyrillic),
    phrasesAlanTurkic: text(row.phrasesAlanTurkic || row.phrases_alan_turkic),
    phrasesRu: text(row.phrasesRu || row.phrases_ru),
    phrasesEn: text(row.phrasesEn || row.phrases_en),
    phrasesTr: text(row.phrasesTr || row.phrases_tr),

    storyNameRu: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.ru.name : text(row.storyNameRu || row.story_name_ru || row.story_name),
    storyNameEn: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.en.name : text(row.storyNameEn || row.story_name_en),
    storyNameTr: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.tr.name : text(row.storyNameTr || row.story_name_tr),
    storyNameAlanCyrillic: text(row.storyNameAlanCyrillic || row.story_name_alan_cyrillic),
    storyNameAlanTurkic: text(row.storyNameAlanTurkic || row.story_name_alan_turkic),
    storyIntroRu: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.ru.intro : text(row.storyIntroRu || row.story_intro_ru || row.story_intro),
    storyIntroEn: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.en.intro : text(row.storyIntroEn || row.story_intro_en),
    storyIntroTr: storyId === UNDERSTANDING_STORY_ID ? UNDERSTANDING_STORY_CONTENT.tr.intro : text(row.storyIntroTr || row.story_intro_tr),
    storyIntroAlanCyrillic: text(row.storyIntroAlanCyrillic || row.story_intro_alan_cyrillic),
    storyIntroAlanTurkic: text(row.storyIntroAlanTurkic || row.story_intro_alan_turkic),
    dictionaryNameRu: text(row.dictionaryNameRu || row.dictionary_name_ru || row.dictionary_name),
    dictionaryNameEn: text(row.dictionaryNameEn || row.dictionary_name_en),
    dictionaryNameTr: text(row.dictionaryNameTr || row.dictionary_name_tr),
    dictionaryNameAlanCyrillic: text(row.dictionaryNameAlanCyrillic || row.dictionary_name_alan_cyrillic),
    dictionaryNameAlanTurkic: text(row.dictionaryNameAlanTurkic || row.dictionary_name_alan_turkic),
    sectionNameRu: text(row.sectionNameRu || row.section_name_ru || row.section_name),
    sectionNameEn: text(row.sectionNameEn || row.section_name_en),
    sectionNameTr: text(row.sectionNameTr || row.section_name_tr),
    sectionNameAlanCyrillic: text(row.sectionNameAlanCyrillic || row.section_name_alan_cyrillic),
    sectionNameAlanTurkic: text(row.sectionNameAlanTurkic || row.section_name_alan_turkic),
    setNameRu: text(row.setNameRu || row.set_name_ru || row.set_name),
    setNameEn: text(row.setNameEn || row.set_name_en),
    setNameTr: text(row.setNameTr || row.set_name_tr),
    setNameAlanCyrillic: text(row.setNameAlanCyrillic || row.set_name_alan_cyrillic),
    setNameAlanTurkic: text(row.setNameAlanTurkic || row.set_name_alan_turkic),
    legacyExample: text(row.legacyExample || row.example),
  };
  const cachedRow = model.sourceType === "v_words_app" && row.used_in_test === undefined
    ? { ...row, usedInTest: undefined }
    : row;
  return completeModel(model, cachedRow);
}

export function normalizeWordEntry(row, { source = "auto", story = null } = {}) {
  if (source === "supabase") return normalizeSupabaseWordEntry(row, story);
  if (source === "legacy") return normalizeLegacyWordEntry(row);
  if (row?.wordAlanCyrillic !== undefined || row?.translationRu !== undefined) return normalizeCachedWordEntry(row);
  if (row?.word_alan_cyrillic !== undefined && row?.dictionary_id !== undefined && row?.set_id !== undefined) {
    return normalizeSupabaseWordEntry(row, story);
  }
  return normalizeLegacyWordEntry(row);
}
