import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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
});

test("no option is preselected in an empty draft", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  assert.match(setup, /interface_language_code: ""/);
  assert.match(setup, /alan_script_code: ""/);
  assert.match(setup, /alan_dialect_code: ""/);
});


test("ordinary settings reuse the learning-card preview and neutral Cyrillic labels", async () => {
  const settings = await source("src/features/settings/index.js");
  assert.match(settings, /renderLearningPreview/);
  assert.match(settings, /\["canonical", "Җ"\]/);
  assert.match(settings, /\["karachay", "Дж"\]/);
  assert.match(settings, /\["balkar", "Ж"\]/);
  assert.doesNotMatch(settings, /karachaevskiy_variant|balkarskiy_variant/);
});
