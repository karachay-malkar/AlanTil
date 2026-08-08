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
  const setId = normalizeId(model.setId);
  const storyId = normalizeId(model.storyId);
  const storyNameRu = text(model.storyNameRu);
  const dictionaryName = text(model.dictionaryNameRu) || dictionaryId;
  const setName = text(model.setNameRu) || setId;

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
    // The physical content model no longer has sections. These compatibility
    // aliases keep older menus stable while pointing at the real dictionary.
    section_id: dictionaryId,
    group_id: dictionaryId,
    set_id: setId,
    pos: text(model.pos),
    synonyms: parseSynonyms(model.synonyms),
    word: text(model.wordAlanCyrillic),
    trans: text(model.translationRu),
    example: text(model.legacyExample),
    story_name: storyNameRu || storyId,
    dictionary_name: dictionaryName,
    section_name: dictionaryName,
    set_name: setName,
    dict: dictionaryName,
    section: dictionaryName,
    set: setName,
    usedInTest: typeof row.usedInTest === "boolean"
      ? row.usedInTest
      : parseUsedInTest(row.used_in_test, row.used_in_test !== undefined),
    ...commonRouteFields(row),
  };

  if (!normalized.id || !dictionaryId || !setId || !normalized.wordAlanCyrillic || !normalized.translationRu) return null;
  return normalized;
}

function storyValue(story, row, key, fallbackKey = key) {
  return text(story?.[key] ?? row?.[fallbackKey]);
}

export function normalizeSupabaseWordEntry(row, story = null) {
  if (!row || typeof row !== "object") return null;
  const dictionaryId = normalizeId(row.dictionary_id);
  const setId = normalizeId(row.set_id);
  const model = {
    sourceType: "content_words",
    id: normalizeId(row.word_id),
    globalOrder: numberValue(row.global_order),
    storyId: normalizeId(story?.story_id || row.story_id),
    dictionaryId,
    sectionId: dictionaryId,
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

    storyNameRu: storyValue(story, row, "name_ru", "story_name_ru"),
    storyNameEn: storyValue(story, row, "name_en", "story_name_en"),
    storyNameTr: storyValue(story, row, "name_tr", "story_name_tr"),
    storyNameAlanCyrillic: storyValue(story, row, "name_alan_cyrillic", "story_name_alan_cyrillic"),
    storyNameAlanTurkic: storyValue(story, row, "name_alan_turkic", "story_name_alan_turkic"),
    dictionaryNameRu: dictionaryId,
    dictionaryNameEn: dictionaryId,
    dictionaryNameTr: dictionaryId,
    dictionaryNameAlanCyrillic: dictionaryId,
    dictionaryNameAlanTurkic: dictionaryId,
    sectionNameRu: dictionaryId,
    sectionNameEn: dictionaryId,
    sectionNameTr: dictionaryId,
    sectionNameAlanCyrillic: dictionaryId,
    sectionNameAlanTurkic: dictionaryId,
    setNameRu: setId,
    setNameEn: setId,
    setNameTr: setId,
    setNameAlanCyrillic: setId,
    setNameAlanTurkic: setId,
    legacyExample: "",
  };
  return completeModel(model, row);
}

export function normalizeLegacyWordEntry(row) {
  if (!row || typeof row !== "object") return null;
  const id = normalizeId(row.id || row.word_id);
  const legacySection = normalizeId(row.section_id || row.group_id || row.section || row.folder);
  let dictionaryId = normalizeId(row.dictionary_id || row.catalog_id || row.dict);
  let setId = normalizeId(row.set_id || row.set);

  // Starter data from releases before 13.12 used numeric section IDs. Map it
  // into the permanent flat dictionary/set model without touching lexical text.
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

  const storyId = normalizeId(row.story_id || row.story_type);
  const model = {
    sourceType: "legacy",
    id,
    globalOrder: numberValue(row.global_order, row.dict_order),
    storyId: storyId === "1" ? "roots" : storyId === "2" ? "ascent" : storyId === "3" ? "pathways" : storyId,
    dictionaryId,
    sectionId: dictionaryId,
    setId,
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

    storyNameRu: text(row.story_name_ru || row.story_name),
    storyNameEn: text(row.story_name_en),
    storyNameTr: text(row.story_name_tr),
    storyNameAlanCyrillic: text(row.story_name_alan_cyrillic),
    storyNameAlanTurkic: text(row.story_name_alan_turkic),
    dictionaryNameRu: dictionaryId,
    dictionaryNameEn: dictionaryId,
    dictionaryNameTr: dictionaryId,
    dictionaryNameAlanCyrillic: dictionaryId,
    dictionaryNameAlanTurkic: dictionaryId,
    sectionNameRu: dictionaryId,
    sectionNameEn: dictionaryId,
    sectionNameTr: dictionaryId,
    sectionNameAlanCyrillic: dictionaryId,
    sectionNameAlanTurkic: dictionaryId,
    setNameRu: setId,
    setNameEn: setId,
    setNameTr: setId,
    setNameAlanCyrillic: setId,
    setNameAlanTurkic: setId,
    legacyExample: text(row.example || row.phrases || row.phrases_ru_combined),
  };
  return completeModel(model, row);
}

function normalizeCachedWordEntry(row) {
  if (!row || typeof row !== "object") return null;
  const model = {
    sourceType: text(row.sourceType) || "content_words",
    id: normalizeId(row.id || row.word_id),
    globalOrder: numberValue(row.globalOrder, row.global_order, row.dict_order),
    storyId: normalizeId(row.storyId || row.story_id || row.story_type),
    dictionaryId: normalizeId(row.dictionaryId || row.dictionary_id || row.catalog_id || row.dict),
    sectionId: normalizeId(row.dictionaryId || row.dictionary_id || row.catalog_id || row.dict),
    setId: normalizeId(row.setId || row.set_id || row.set),
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

    storyNameRu: text(row.storyNameRu || row.story_name_ru || row.story_name),
    storyNameEn: text(row.storyNameEn || row.story_name_en),
    storyNameTr: text(row.storyNameTr || row.story_name_tr),
    storyNameAlanCyrillic: text(row.storyNameAlanCyrillic || row.story_name_alan_cyrillic),
    storyNameAlanTurkic: text(row.storyNameAlanTurkic || row.story_name_alan_turkic),
    dictionaryNameRu: text(row.dictionaryNameRu || row.dictionary_name_ru || row.dictionary_id),
    dictionaryNameEn: text(row.dictionaryNameEn || row.dictionary_name_en || row.dictionary_id),
    dictionaryNameTr: text(row.dictionaryNameTr || row.dictionary_name_tr || row.dictionary_id),
    dictionaryNameAlanCyrillic: text(row.dictionaryNameAlanCyrillic || row.dictionary_name_alan_cyrillic || row.dictionary_id),
    dictionaryNameAlanTurkic: text(row.dictionaryNameAlanTurkic || row.dictionary_name_alan_turkic || row.dictionary_id),
    sectionNameRu: text(row.dictionaryNameRu || row.dictionary_name_ru || row.dictionary_id),
    sectionNameEn: text(row.dictionaryNameEn || row.dictionary_name_en || row.dictionary_id),
    sectionNameTr: text(row.dictionaryNameTr || row.dictionary_name_tr || row.dictionary_id),
    sectionNameAlanCyrillic: text(row.dictionaryNameAlanCyrillic || row.dictionary_name_alan_cyrillic || row.dictionary_id),
    sectionNameAlanTurkic: text(row.dictionaryNameAlanTurkic || row.dictionary_name_alan_turkic || row.dictionary_id),
    setNameRu: text(row.setNameRu || row.set_name_ru || row.set_id),
    setNameEn: text(row.setNameEn || row.set_name_en || row.set_id),
    setNameTr: text(row.setNameTr || row.set_name_tr || row.set_id),
    setNameAlanCyrillic: text(row.setNameAlanCyrillic || row.set_name_alan_cyrillic || row.set_id),
    setNameAlanTurkic: text(row.setNameAlanTurkic || row.set_name_alan_turkic || row.set_id),
    legacyExample: text(row.legacyExample || row.example),
  };
  return completeModel(model, row);
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
