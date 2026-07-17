import { getDisplayedWordEntry } from "../domain/alan-display.js?v=13.8.1";
import { normalizeLegacyWordEntry } from "../domain/word-normalizer.js?v=13.8.1";

export function normalizeToCsvUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.includes("output=csv") || value.includes("out:csv") || value.includes("format=csv")) return value;
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return value;
  const gid = value.match(/[?&#]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ""}`;
}

export function parseCsvRows(text) {
  const matrix = [];
  let row = [];
  let current = "";
  let inQuotes = false;
  const source = String(text || "");

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(current);
      current = "";
    } else if (char === "\n") {
      row.push(current);
      matrix.push(row);
      row = [];
      current = "";
    } else if (char !== "\r") {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    matrix.push(row);
  }
  if (!matrix.length) return { headers: [], rows: [] };

  const headers = matrix[0].map((header, index) => {
    const value = String(header || "").trim().toLowerCase();
    return index === 0 ? value.replace(/^\uFEFF/, "") : value;
  });
  const rows = matrix.slice(1)
    .filter((columns) => columns && !columns.every((cell) => !String(cell || "").trim()))
    .map((columns) => {
      const object = {};
      headers.forEach((header, index) => {
        if (header) object[header] = columns[index] ?? "";
      });
      return object;
    });

  return { headers, rows };
}

export function parseCsv(text) {
  const { headers, rows } = parseCsvRows(text);
  if (!headers.length) return [];
  const has = (name) => headers.includes(name);
  if (!has("id") || !has("set") || !has("word") || !has("trans")) return [];

  const output = [];
  for (const row of rows) {
    const normalized = normalizeLegacyWordEntry({
      id: row.id,
      dict: has("dict") ? row.dict : "Словарь",
      section: has("section") ? row.section : (has("folder") ? row.folder : "Раздел"),
      set: row.set,
      word: row.word,
      trans: row.trans,
      example: has("example") ? row.example : "",
      pos: has("pos") ? row.pos : "",
      synonyms: has("synonyms") ? row.synonyms : "",
      used_in_test: has("used_in_test") ? row.used_in_test : undefined,
      dict_order: has("dict_order") ? row.dict_order : 0,
      catalog_id: has("catalog_id") ? row.catalog_id : "",
      group_id: has("group_id") ? row.group_id : "",
      set_id: has("set_id") ? row.set_id : "",
      story_type: has("story_type") ? row.story_type : (has("story") ? row.story : (has("ветка") ? row["ветка"] : (has("история") ? row["история"] : ""))),
      order_override: has("order_override") ? row.order_override : 0,
      background_segment: has("background_segment") ? row.background_segment : "",
      position_x: has("position_x") ? row.position_x : "",
      position_y: has("position_y") ? row.position_y : "",
      required_accuracy: has("required_accuracy") ? row.required_accuracy : "",
      reward_id: has("reward_id") ? row.reward_id : "",
      is_optional: has("is_optional") ? row.is_optional : "",
      review_schedule: has("review_schedule") ? row.review_schedule : "",
    });
    if (normalized) output.push(getDisplayedWordEntry(normalized));
  }
  return output;
}
