import { STORY_TYPES } from "../../config/path.js";

export const DEFAULT_STORY_TYPE = STORY_TYPES.ASCENT;

const STORY_ALIASES = new Map([
  [STORY_TYPES.ASCENT, STORY_TYPES.ASCENT],
  ["восхождение", STORY_TYPES.ASCENT],
  ["подъём", STORY_TYPES.ASCENT],
  ["подъем", STORY_TYPES.ASCENT],
  [STORY_TYPES.SUMMIT, STORY_TYPES.SUMMIT],
  ["на вершине", STORY_TYPES.SUMMIT],
  ["вершина", STORY_TYPES.SUMMIT],
  [STORY_TYPES.TRAILS, STORY_TYPES.TRAILS],
  ["тропы", STORY_TYPES.TRAILS],
  ["тропа", STORY_TYPES.TRAILS],
]);

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .toLowerCase()
    .replace(/[ё]/g, "е")
    .replace(/[\s_-]+/g, " ");
}

export function normalizeStoryType(value) {
  const normalized = normalizeText(value);
  return STORY_ALIASES.get(normalized) || "";
}

export function resolveStoryType(row) {
  return normalizeStoryType(row?.story_type) || DEFAULT_STORY_TYPE;
}

export function validateStationStoryTypes(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const valid = new Set();
  const invalid = new Set();

  source.forEach((row) => {
    const raw = String(row?.story_type ?? "").trim();
    if (!raw) return;
    const normalized = normalizeStoryType(raw);
    if (normalized) valid.add(normalized);
    else invalid.add(raw);
  });

  const conflict = valid.size > 1 || invalid.size > 0;
  return {
    storyType: conflict ? DEFAULT_STORY_TYPE : (Array.from(valid)[0] || DEFAULT_STORY_TYPE),
    conflict,
    explicit: valid.size > 0,
    values: Array.from(valid),
    invalidValues: Array.from(invalid),
  };
}
