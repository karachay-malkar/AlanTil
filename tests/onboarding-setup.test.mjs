import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("first-launch setup is rendered before router startup", async () => {
  const bootstrap = await source("src/app/bootstrap.js");
  assert.match(bootstrap, /await runLearningSetup\(\{ shell \}\)/);
  assert.ok(bootstrap.indexOf("await runLearningSetup") < bootstrap.indexOf("const router = createRouter"));
  assert.match(bootstrap, /\/profile\/account/);
});

test("preview uses the approved ciger example and diamond separator", async () => {
  const data = await source("src/shared/settings/learning-preview-data.js");
  const setup = await source("src/shared/settings/learning-setup.js");
  assert.match(data, /җигер урунуу/);
  assert.match(data, /ciger urunuw/);
  assert.match(data, /доблестный труд/);
  assert.match(data, /valiant work/);
  assert.match(data, /yiğitçe emek/);
  assert.match(setup, /✦/);
  assert.match(setup, /learningPreviewCard/);
});

test("preview content is deterministic for every supported language, script and dialect", async () => {
  const moduleUrl = pathToFileURL(path.join(root, "src/shared/settings/learning-preview-data.js")).href;
  const { previewContent } = await import(moduleUrl);
  const translations = {
    ru: ["деятельный, активный, проворный", "доблестный труд"],
    en: ["energetic, active, agile", "valiant work"],
    tr: ["gayretli, aktif, çevik", "yiğitçe emek"],
  };
  const cyrillic = {
    canonical: ["җигер", "җигер урунуу"],
    karachay: ["джигер", "джигер урунуу"],
    balkar: ["жигер", "жигер урунуу"],
  };

  for (const language of Object.keys(translations)) {
    for (const dialect of Object.keys(cyrillic)) {
      const preview = previewContent({
        interface_language_code: language,
        alan_script_code: "cyrillic",
        alan_dialect_code: dialect,
      });
      assert.deepEqual(
        [preview.word, preview.example, preview.translation, preview.exampleTranslation],
        [...cyrillic[dialect], ...translations[language]],
      );
    }

    for (const dialect of Object.keys(cyrillic)) {
      const preview = previewContent({
        interface_language_code: language,
        alan_script_code: "turkic",
        alan_dialect_code: dialect,
      });
      assert.deepEqual(
        [preview.word, preview.example, preview.translation, preview.exampleTranslation],
        ["ciger", "ciger urunuw", ...translations[language]],
      );
    }
  }
});

test("no option is preselected in an empty draft", async () => {
  const moduleUrl = pathToFileURL(path.join(root, "packages/alantil-core/settings.js")).href;
  const { emptyLearningSetupDraft } = await import(moduleUrl);
  assert.deepEqual(emptyLearningSetupDraft(), {
    interface_language_code: "",
    translation_language_code: "",
    alan_script_code: "",
    alan_dialect_code: "",
  });
});

test("ordinary settings reuse shared preview render and sync contracts", async () => {
  for (const file of ["src/features/settings/index.js", "src/features/settings/feature.js"]) {
    const settings = await source(file);
    assert.match(settings, /renderLearningPreview/);
    assert.match(settings, /syncLearningPreview/);
    assert.doesNotMatch(settings, /current\.replaceWith\(next\)/);
    assert.match(settings, /\["canonical", "Җ"\]/);
    assert.match(settings, /\["karachay", "Дж"\]/);
    assert.match(settings, /\["balkar", "Ж"\]/);
    assert.doesNotMatch(settings, /karachaevskiy_variant|balkarskiy_variant/);
  }
});

test("setup sync only animates preview when requested and keeps errors out of the stable slots", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  assert.match(setup, /animatePreview = false/);
  assert.match(setup, /syncLearningPreview\(preview, draft, \{ animate: animatePreview \}\)/);
  const continueIndex = setup.indexOf("data-learning-setup-continue");
  const statusIndex = setup.indexOf("data-learning-setup-status");
  assert.ok(continueIndex >= 0 && statusIndex > continueIndex);
});
