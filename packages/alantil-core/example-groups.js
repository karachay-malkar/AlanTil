function text(value) {
  return String(value || "").trim();
}

export function numberedPhraseRows(value) {
  const source = text(value);
  if (!source) return [];
  return source
    .split(/\r?\n|\s*;\s*/)
    .map((line, index) => {
      const clean = text(line);
      const match = clean.match(/^(\d+\.\d+)\s+(.+)$/u);
      return match
        ? { key: match[1], text: match[2].trim() }
        : { key: `line-${index + 1}`, text: clean };
    })
    .filter((entry) => entry.text);
}

export function combineNumberedExamples(alanValue, translatedValue) {
  const alanRows = numberedPhraseRows(alanValue);
  const translatedRows = numberedPhraseRows(translatedValue);
  if (!alanRows.length && !translatedRows.length) return "";
  const translatedByKey = new Map(translatedRows.map((row) => [row.key, row.text]));
  return alanRows.map((row, index) => {
    const translation = translatedByKey.get(row.key) || translatedRows[index]?.text || "";
    const combined = [row.text, translation].filter(Boolean).join(" ✦ ");
    const prefix = /^\d+\.\d+$/u.test(row.key) ? `${row.key} ` : "";
    return `${prefix}${combined}`.trim();
  }).join("; ");
}

export function parseExampleGroups(value) {
  const source = text(value);
  if (!source) return [];
  const parts = source
    .replace(/\r?\n+/g, ";")
    .split(/\s*[;；]\s*/u)
    .map((part) => part.trim())
    .filter(Boolean);
  const groups = [];
  const byIndex = new Map();
  let currentIndex = 0;

  for (const part of parts) {
    const match = part.match(/^\s*(\d+)(?:\.(\d+))?\s*(?:[.)]|[-–—])?\s*(.*)$/u);
    let index = currentIndex;
    let line = part;
    if (match && match[3]) {
      index = Math.max(0, Number(match[1]) - 1);
      currentIndex = index;
      line = match[3].trim();
    }
    if (!line) continue;
    if (!byIndex.has(index)) {
      const group = { index, lines: [] };
      byIndex.set(index, group);
      groups.push(group);
    }
    byIndex.get(index).lines.push(line);
  }
  return groups;
}
