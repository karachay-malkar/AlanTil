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
    synonyms: parseSynonyms(row.synonyms),
    usedInTest: typeof row.usedInTest === "boolean"
      ? row.usedInTest
      : parseUsedInTest(row.used_in_test, row.used_in_test !== undefined),
  };

  if (!normalized.id || !normalized.set || !normalized.word || !normalized.trans) return null;
  return normalized;
}
