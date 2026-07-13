const TRANSLITERATION = Object.freeze({
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ӕ: "ae", ғ: "g", қ: "q", ң: "ng", ө: "o", ү: "u", һ: "h", җ: "zh", ә: "a",
});

function transliterate(value) {
  return Array.from(String(value || "").normalize("NFC").toLowerCase())
    .map((character) => TRANSLITERATION[character] ?? character)
    .join("");
}

export function toSlug(value, fallback = "item") {
  const normalized = transliterate(value)
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return normalized || fallback;
}

export function createSlugMap(values, { reserved = [] } = {}) {
  const valueToSlug = new Map();
  const slugToValue = new Map();
  const occupied = new Set(reserved.map((value) => String(value || "").toLowerCase()).filter(Boolean));

  Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value ?? "")).filter(Boolean)))
    .forEach((value) => {
      const base = toSlug(value);
      let candidate = base;
      let suffix = 2;
      while (occupied.has(candidate)) {
        candidate = `${base}-${suffix}`;
        suffix += 1;
      }
      occupied.add(candidate);
      valueToSlug.set(value, candidate);
      slugToValue.set(candidate, value);
    });

  return {
    slugFor(value) {
      return valueToSlug.get(String(value ?? "")) || toSlug(value);
    },
    valueFor(slug) {
      return slugToValue.get(String(slug || "").toLowerCase()) || null;
    },
  };
}
