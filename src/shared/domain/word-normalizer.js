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

function normalizePhrases(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => {
      if (typeof entry === "string") return entry.trim();
      const alan = String(entry?.alan || entry?.source || entry?.text || "").trim();
      const ru = String(entry?.ru || entry?.translation || "").trim();
      return [alan, ru].filter(Boolean).join(" ✦ ");
    }).filter(Boolean).join("; ");
  }
  if (value && typeof value === "object") {
    return normalizePhrases(Object.values(value));
  }
  return String(value || "").trim();
}


function numberedPhraseRows(value) {
  const text = (Array.isArray(value) ? value.join("\n") : String(value || "")).trim();
  if (!text) return [];
  return text.split(/\r?\n|\s*;\s*/).map((line, index) => {
    const clean = String(line || "").trim();
    const match = clean.match(/^(\d+\.\d+)\s+(.+)$/u);
    return match ? { key: match[1], text: match[2].trim() } : { key: `line-${index + 1}`, text: clean };
  }).filter((entry) => entry.text);
}

function combineLocalizedPhrases(alanValue, translationValue) {
  const alan = numberedPhraseRows(alanValue);
  const translations = numberedPhraseRows(translationValue);
  if (!alan.length && !translations.length) return "";
  const byKey = new Map(translations.map((entry) => [entry.key, entry.text]));
  return alan.map((entry, index) => {
    const translation = byKey.get(entry.key) || translations[index]?.text || "";
    return [entry.text, translation].filter(Boolean).join(" ✦ ");
  }).join("; ");
}

function numericValue(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

export function normalizeWordEntry(row) {
  if (!row || typeof row !== "object") return null;

  const id = normalizeId(row.word_id || row.id);
  const word = String(row.word || row.word_alan_cyrillic || "").trim();
  const trans = String(row.translation || row.translation_ru || row.trans || "").trim();
  const storyId = normalizeId(row.story_id || row.story_type);
  const dictionaryId = normalizeId(row.dictionary_id || row.catalog_id || row.dict);
  const sectionId = normalizeId(row.section_id || row.group_id || row.section || row.folder);
  const setId = normalizeId(row.set_id);
  const setName = String(row.set_name || row.set || "").trim();
  const dictionaryName = String(row.dictionary_name || row.dict || dictionaryId || "Словарь").trim();
  const sectionName = String(row.section_name || row.section || row.folder || sectionId || "Раздел").trim();
  const storyName = String(row.story_name || "").trim();
  const example = normalizePhrases(row.phrases || row.example || row.phrases_ru_combined)
    || combineLocalizedPhrases(row.phrases_alan_cyrillic, row.phrases_ru);

  const normalized = {
    id,
    word_id: id,
    global_order: numericValue(row.global_order, row.dict_order),
    story_id: storyId,
    story_name: storyName,
    dictionary_id: dictionaryId,
    dictionary_name: dictionaryName,
    section_id: sectionId,
    section_name: sectionName,
    set_id: setId,
    set_name: setName,

    // Compatibility fields used by the existing modes.
    dict: dictionaryName,
    section: sectionName,
    set: setName || setId || "",
    word,
    trans,
    pos: String(row.pos || "").trim(),
    example,
    dict_order: numericValue(row.global_order, row.dict_order),
    catalog_id: dictionaryId,
    group_id: sectionId,
    story_type: storyId,
    order_override: numericValue(row.order_override),
    background_segment: String(row.background_segment || "").trim(),
    position_x: row.position_x === "" || row.position_x === undefined ? null : Number(row.position_x),
    position_y: row.position_y === "" || row.position_y === undefined ? null : Number(row.position_y),
    required_accuracy: row.required_accuracy === "" || row.required_accuracy === undefined ? null : Number(row.required_accuracy),
    reward_id: String(row.reward_id || "").trim(),
    is_optional: ["1", "true", "yes"].includes(String(row.is_optional || "").trim().toLowerCase()),
    review_schedule: String(row.review_schedule || "").trim(),
    synonyms: parseSynonyms(row.synonyms),
    usedInTest: typeof row.usedInTest === "boolean"
      ? row.usedInTest
      : parseUsedInTest(row.used_in_test, row.used_in_test !== undefined),
  };

  if (!normalized.id || !normalized.word || !normalized.trans) return null;
  return normalized;
}
