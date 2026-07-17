import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const storage = new Map();
globalThis.localStorage = {
  getItem(key) { return storage.has(key) ? storage.get(key) : null; },
  setItem(key, value) { storage.set(key, String(value)); },
  removeItem(key) { storage.delete(key); },
};
globalThis.window = {
  dispatchEvent() {},
  addEventListener() {},
};
const staticTextNode = { dataset: { i18n: "common.put" }, textContent: "" };
const staticAriaNode = {
  dataset: { i18nAriaLabel: "common.osnovnaya_navigatsiya" },
  attributes: {},
  setAttribute(name, value) { this.attributes[name] = value; },
};
globalThis.document = {
  documentElement: { lang: "ru" },
  querySelectorAll(selector) {
    if (selector === "[data-i18n]") return [staticTextNode];
    if (selector === "[data-i18n-aria-label]") return [staticAriaNode];
    return [];
  },
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

const { INTERFACE_MESSAGES } = await import("../src/shared/i18n/messages.js?v=13.9.0");
const { RELEASE_MESSAGES_13_10 } = await import("../src/shared/i18n/messages-13-10.js?v=13.10.0");
const ALL_INTERFACE_MESSAGES = Object.freeze({
  ...INTERFACE_MESSAGES,
  ...RELEASE_MESSAGES_13_10,
});
const {
  hasCompleteTranslations,
  messageForLanguage,
  setInterfaceLanguage,
} = await import("../src/shared/i18n/index.js?v=13.10.0");

async function javascriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await javascriptFiles(path));
    else if (entry.name.endsWith(".js")) files.push(path);
  }
  return files;
}

test("the interface catalogue contains complete RU, EN and TR entries", () => {
  assert.ok(Object.keys(ALL_INTERFACE_MESSAGES).length >= 406);
  assert.equal(hasCompleteTranslations("ru"), true);
  assert.equal(hasCompleteTranslations("en"), true);
  assert.equal(hasCompleteTranslations("tr"), true);
  const placeholders = (value) => [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)]
    .map((match) => match[1])
    .sort();
  Object.values(ALL_INTERFACE_MESSAGES).forEach((entry) => {
    assert.deepEqual(placeholders(entry.en), placeholders(entry.ru));
    assert.deepEqual(placeholders(entry.tr), placeholders(entry.ru));
  });
});

test("all literal msg keys used by the application exist in the catalogue", async () => {
  const usedKeys = new Set();
  for (const path of await javascriptFiles(fileURLToPath(new URL("../src/", import.meta.url)))) {
    const source = await readFile(path, "utf8");
    for (const match of source.matchAll(/\bmsg\(\s*["']([^"']+)["']/g)) usedKeys.add(match[1]);
  }
  const missing = [...usedKeys].filter((key) => !ALL_INTERFACE_MESSAGES[key]);
  assert.deepEqual(missing, []);
});

test("placeholders and Russian fallback remain deterministic", () => {
  assert.equal(
    messageForLanguage("en", "path.nuzhno_ne_menee", { required: 80 }),
    "At least 80% is required",
  );
  assert.equal(messageForLanguage("de", "common.nazad"), "Назад");
});

test("switching the interface language updates the document immediately", () => {
  setInterfaceLanguage("tr");
  assert.equal(document.documentElement.lang, "tr");
  assert.equal(staticTextNode.textContent, "Yol");
  assert.equal(staticAriaNode.attributes["aria-label"], "Ana gezinme");
  setInterfaceLanguage("en");
  assert.equal(document.documentElement.lang, "en");
});
