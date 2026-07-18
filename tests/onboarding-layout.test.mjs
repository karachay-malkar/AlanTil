import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

test("onboarding starts with only the multilingual language heading", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  assert.match(setup, /<h1>Язык · Language · Dil<\/h1>/);
  assert.doesNotMatch(setup, /learningSetupHead|learningSetupKicker/);
  assert.doesNotMatch(setup, /Set up learning for yourself/);
});

test("onboarding reuses the shared settings segmented controls", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  const sharedCss = await source("src/shared/styles/segmented-control.css");
  const onboardingCss = await source("src/features/onboarding/onboarding.css");
  assert.match(setup, /segmentControl settingsSegments/);
  assert.match(setup, /settingsChoiceBody/);
  assert.match(sharedCss, /\.settingsSegments/);
  assert.doesNotMatch(onboardingCss, /input:checked|background:color-mix\(in srgb,var\(--accent\)/);
});

test("script controls contain labels only and stay progressively disclosed", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  assert.match(setup, /\["cyrillic", copy\.cyrillic\]/);
  assert.match(setup, /\["turkic", "Latin"\]/);
  assert.doesNotMatch(setup, /detail: "җигер"|detail: "ciger"/);
  assert.match(setup, /draft\.alan_script_code === "cyrillic" \? "isVisible"/);
});

test("preview card is always rendered with real learn-card classes", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  assert.match(setup, /\["learnCard", "learningSetupCard"/);
  assert.match(setup, /cardInner/);
  assert.match(setup, /cardFace cardFront/);
  assert.match(setup, /renderLearningPreview\(draft\)/);
  assert.doesNotMatch(setup, /const ready =|preview \?/);
});

test("continue button uses the standard application button", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  const css = await source("src/features/onboarding/onboarding.css");
  assert.match(setup, /class="btn actionPrimary learningSetupContinue"/);
  assert.match(css, /\.learningSetupContinue\{width:100%\}/);
  assert.doesNotMatch(css, /\.learningSetupContinue[^\n]*background|\.learningSetupContinue[^\n]*border-radius|\.learningSetupContinue[^\n]*box-shadow/);
});

test("content starts below the top chrome and centers when space is available", async () => {
  const css = await source("src/features/onboarding/onboarding.css");
  assert.match(css, /padding:calc\(var\(--safe-top\) \+ var\(--header-h\) \+ var\(--content-rest-gap\)\)/);
  assert.match(css, /\.learningSetupPane\{[^}]*margin:auto/);
});
