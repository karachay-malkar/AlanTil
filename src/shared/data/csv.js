import { normalizeWordEntry } from "../domain/word-normalizer.js";

export function normalizeToCsvUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.includes("output=csv") || value.includes("out:csv") || value.includes("format=csv")) return value;
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return value;
  return `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv`;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
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
      rows.push(row);
      row = [];
      current = "";
    } else if (char !== "\r") {
      current += char;
    }
  }

  if (current.length || row.length) {
    row.push(current);
    rows.push(row);
  }
  if (!rows.length) return [];

  const headers = rows[0].map((header) => String(header || "").trim().toLowerCase());
  const column = (name) => headers.findIndex((header) => header === name);
  const idIndex = column("id");
  const dictIndex = column("dict");
  const sectionIndex = column("section");
  const folderIndex = column("folder");
  const setIndex = column("set");
  const wordIndex = column("word");
  const transIndex = column("trans");
  const exampleIndex = column("example");
  const posIndex = column("pos");
  const synonymsIndex = column("synonyms");
  const usedInTestIndex = column("used_in_test");
  const dictOrderIndex = column("dict_order");

  if (idIndex === -1 || setIndex === -1 || wordIndex === -1 || transIndex === -1) return [];

  const output = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const columns = rows[rowIndex];
    if (!columns || columns.every((cell) => !String(cell || "").trim())) continue;

    const normalized = normalizeWordEntry({
      id: columns[idIndex],
      dict: dictIndex !== -1 ? columns[dictIndex] : "Словарь",
      section: sectionIndex !== -1 ? columns[sectionIndex] : (folderIndex !== -1 ? columns[folderIndex] : "Раздел"),
      set: columns[setIndex],
      word: columns[wordIndex],
      trans: columns[transIndex],
      example: exampleIndex !== -1 ? columns[exampleIndex] : "",
      pos: posIndex !== -1 ? columns[posIndex] : "",
      synonyms: synonymsIndex !== -1 ? columns[synonymsIndex] : "",
      used_in_test: usedInTestIndex !== -1 ? columns[usedInTestIndex] : undefined,
      dict_order: dictOrderIndex !== -1 ? columns[dictOrderIndex] : 0,
    });
    if (normalized) output.push(normalized);
  }

  return output;
}
