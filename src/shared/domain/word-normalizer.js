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

function compatibilityFields({
  wordAlanCyrillic,
  translationRu,
  legacyExample,
  storyNameRu,
  dictionaryNameRu,
  sectionNameRu,
  setNameRu,
  dictionaryId,
  sectionId,
  setId,
}) {
  return {
    word: wordAlanCyrillic,
    trans: translationRu,
    example: legacyExample,
    story_name: storyNameRu,
    dictionary_name: dictionaryNameRu || dictionaryId,
    section_name: sectionNameRu || sectionId,
    set_name: setNameRu,
    // These aliases remain stable for the legacy learn URLs and local keys.
    dict: dictionaryNameRu || dictionaryId || "Словарь",
    section: sectionNameRu || sectionId || "Раздел",
    set: setNameRu || setId || "",
  };
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
  const compatibility = compatibilityFields(model);
  const normalized = {
    ...model,
    ...compatibility,
    id: model.id,
    word_id: model.id,
    global_order: numberValue(model.globalOrder),
    story_id: model.storyId,
    dictionary_id: model.dictionaryId,
    section_id: model.sectionId,
    set_id: model.setId,
    pos: text(model.pos),
    synonyms: parseSynonyms(model.synonyms),
    dict_order: numberValue(model.globalOrder),
    catalog_id: model.dictionaryId,
    group_id: model.sectionId,
    story_type: model.storyId,
    usedInTest: typeof row.usedInTest === "boolean"
      ? row.usedInTest
      : parseUsedInTest(row.used_in_test, row.used_in_test !== undefined),
    ...commonRouteFields(row),
  };

  if (!normalized.id || !normalized.wordAlanCyrillic || !normalized.translationRu) return null;
  return normalized;
}

export function normalizeSupabaseWordEntry(row) {
  if (!row || typeof row !== "object") return null;
  const model = {
    sourceType: "v_words_app",
    id: normalizeId(row.word_id),
    globalOrder: numberValue(row.global_order),
    storyId: normalizeId(row.story_id),
    dictionaryId: normalizeId(row.dictionary_id),
    sectionId: normalizeId(row.section_id),
    setId: normalizeId(row.set_id),
    pos: text(row.pos),
    synonyms: row.synonyms,

    wordAlanCyrillic: text(row.word_alan_cyrillic),
    wordAlanTurkic: text(row.word_alan_turkic),
    translationRu: text(row.translation_ru),
    phrasesAlanCyrillic: text(row.phrases_alan_cyrillic),
    phrasesAlanTurkic: text(row.phrases_alan_turkic),
    phrasesRu: text(row.phrases_ru),

    storyNameRu: text(row.story_name_ru),
    storyNameAlanCyrillic: text(row.story_name_alan_cyrillic),
    storyNameAlanTurkic: text(row.story_name_alan_turkic),
    dictionaryNameRu: text(row.dictionary_name_ru),
    dictionaryNameAlanCyrillic: text(row.dictionary_name_alan_cyrillic),
    dictionaryNameAlanTurkic: text(row.dictionary_name_alan_turkic),
    sectionNameRu: text(row.section_name_ru),
    sectionNameAlanCyrillic: text(row.section_name_alan_cyrillic),
    sectionNameAlanTurkic: text(row.section_name_alan_turkic),
    setNameRu: text(row.set_name_ru),
    setNameAlanCyrillic: text(row.set_name_alan_cyrillic),
    setNameAlanTurkic: text(row.set_name_alan_turkic),
    legacyExample: "",
  };
  return completeModel(model, row);
}

export function normalizeLegacyWordEntry(row) {
  if (!row || typeof row !== "object") return null;
  const id = normalizeId(row.id || row.word_id);
  const dictionaryId = normalizeId(row.dictionary_id || row.catalog_id || row.dict);
  const sectionId = normalizeId(row.section_id || row.group_id || row.section || row.folder);
  const setId = normalizeId(row.set_id);
  const model = {
    sourceType: "legacy",
    id,
    globalOrder: numberValue(row.global_order, row.dict_order),
    storyId: normalizeId(row.story_id || row.story_type),
    dictionaryId,
    sectionId,
    setId,
    pos: text(row.pos),
    synonyms: row.synonyms,

    wordAlanCyrillic: text(row.word),
    wordAlanTurkic: "",
    translationRu: text(row.trans || row.translation),
    phrasesAlanCyrillic: "",
    phrasesAlanTurkic: "",
    phrasesRu: "",

    storyNameRu: text(row.story_name),
    storyNameAlanCyrillic: "",
    storyNameAlanTurkic: "",
    dictionaryNameRu: text(row.dictionary_name || row.dict || dictionaryId || "Словарь"),
    dictionaryNameAlanCyrillic: "",
    dictionaryNameAlanTurkic: "",
    sectionNameRu: text(row.section_name || row.section || row.folder || sectionId || "Раздел"),
    sectionNameAlanCyrillic: "",
    sectionNameAlanTurkic: "",
    setNameRu: text(row.set_name || row.set),
    setNameAlanCyrillic: "",
    setNameAlanTurkic: "",
    legacyExample: text(row.example || row.phrases || row.phrases_ru_combined),
  };
  return completeModel(model, row);
}

function normalizeCachedWordEntry(row) {
  if (!row || typeof row !== "object") return null;
  const model = {
    sourceType: text(row.sourceType) || "v_words_app",
    id: normalizeId(row.id || row.word_id),
    globalOrder: numberValue(row.globalOrder, row.global_order, row.dict_order),
    storyId: normalizeId(row.storyId || row.story_id || row.story_type),
    dictionaryId: normalizeId(row.dictionaryId || row.dictionary_id || row.catalog_id),
    sectionId: normalizeId(row.sectionId || row.section_id || row.group_id),
    setId: normalizeId(row.setId || row.set_id),
    pos: text(row.pos),
    synonyms: row.synonyms,

    wordAlanCyrillic: text(row.wordAlanCyrillic),
    wordAlanTurkic: text(row.wordAlanTurkic),
    translationRu: text(row.translationRu),
    phrasesAlanCyrillic: text(row.phrasesAlanCyrillic),
    phrasesAlanTurkic: text(row.phrasesAlanTurkic),
    phrasesRu: text(row.phrasesRu),

    storyNameRu: text(row.storyNameRu),
    storyNameAlanCyrillic: text(row.storyNameAlanCyrillic),
    storyNameAlanTurkic: text(row.storyNameAlanTurkic),
    dictionaryNameRu: text(row.dictionaryNameRu),
    dictionaryNameAlanCyrillic: text(row.dictionaryNameAlanCyrillic),
    dictionaryNameAlanTurkic: text(row.dictionaryNameAlanTurkic),
    sectionNameRu: text(row.sectionNameRu),
    sectionNameAlanCyrillic: text(row.sectionNameAlanCyrillic),
    sectionNameAlanTurkic: text(row.sectionNameAlanTurkic),
    setNameRu: text(row.setNameRu),
    setNameAlanCyrillic: text(row.setNameAlanCyrillic),
    setNameAlanTurkic: text(row.setNameAlanTurkic),
    legacyExample: text(row.legacyExample),
  };
  return completeModel(model, row);
}

export function normalizeWordEntry(row, { source = "auto" } = {}) {
  if (source === "supabase") return normalizeSupabaseWordEntry(row);
  if (source === "legacy") return normalizeLegacyWordEntry(row);
  if (row?.wordAlanCyrillic !== undefined || row?.translationRu !== undefined) return normalizeCachedWordEntry(row);
  if (row?.word_alan_cyrillic !== undefined || row?.translation_ru !== undefined) return normalizeSupabaseWordEntry(row);
  return normalizeLegacyWordEntry(row);
}
