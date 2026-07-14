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

export function normalizeWordEntry(row) {
  if (!row || typeof row !== "object") return null;

  const id = normalizeId(row.id);
  const word = String(row.word || "").trim();
  const trans = String(row.trans || "").trim();
  const rawSet = String(row.set ?? "").trim();
  const numericSet = Number(rawSet);

  const normalized = {
    id,
    dict: String(row.dict || "").trim() || "Словарь",
    section: String(row.section || row.folder || "").trim() || "Раздел",
    set: Number.isNaN(numericSet) ? rawSet : numericSet,
    word,
    trans,
    pos: String(row.pos || "").trim(),
    example: String(row.example || "").trim(),
    dict_order: Number(row.dict_order || 0),
    catalog_id: String(row.catalog_id || "").trim(),
    group_id: String(row.group_id || "").trim(),
    set_id: String(row.set_id || "").trim(),
    story_type: String(row.story_type || "").trim(),
    order_override: Number(row.order_override || 0),
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

  if (!normalized.id || !normalized.set || !normalized.word || !normalized.trans) return null;
  return normalized;
}
