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

test("onboarding reuses shared segmented controls without duplicating selected-state styles", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  const sharedCss = await source("src/shared/styles/segmented-control.css");
  const onboardingCss = await source("src/features/onboarding/onboarding.css");
  assert.match(setup, /segmentControl settingsSegments/);
  assert.match(setup, /settingsChoiceBody/);
  assert.match(sharedCss, /\.settingsSegments/);
  assert.doesNotMatch(onboardingCss, /input:checked|background:color-mix\(in srgb,var\(--accent\)/);
});

test("progressive controls reserve layout slots instead of changing document height", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  const css = await source("src/features/onboarding/onboarding.css");
  assert.match(setup, /data-setup-step="script"/);
  assert.match(setup, /data-setup-step="dialect"/);
  assert.match(setup, /aria-hidden=/);
  assert.match(setup, /toggleAttribute\("inert", !visible\)/);
  assert.match(setup, /control\.disabled = !visible/);
  assert.match(css, /\.learningSetupStep\{[\s\S]*visibility:hidden/);
  assert.match(css, /\.learningSetupStep\.isVisible\{[\s\S]*visibility:visible/);
  assert.doesNotMatch(css, /(?:^|[;{])\s*max-height\s*:/m);
  assert.doesNotMatch(css, /\.learningSetupStep[^{]*\{[^}]*display\s*:\s*none/);
});

test("preview is an independent shared component rather than a learn-session card", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  const previewCss = await source("src/shared/styles/learning-preview.css");
  const appCss = await source("src/shared/styles/app.css");
  assert.match(setup, /learningPreviewCard/);
  assert.match(setup, /data-preview-word/);
  assert.match(setup, /data-preview-translation/);
  assert.match(setup, /data-preview-example/);
  assert.match(setup, /data-preview-example-translation/);
  assert.doesNotMatch(setup, /\blearnCard\b|cardInner|cardFace cardFront/);
  assert.match(previewCss, /\.learningPreviewSurface/);
  assert.match(appCss, /learning-preview\.css/);
});

test("preview is compact and content-driven on onboarding", async () => {
  const onboardingCss = await source("src/features/onboarding/onboarding.css");
  const previewCss = await source("src/shared/styles/learning-preview.css");
  assert.match(onboardingCss, /\[data-feature="onboarding"\] \.learningSetupCard\{width:100%\}/);
  assert.doesNotMatch(onboardingCss, /learningSetupCard\{[^}]*height\s*:/);
  assert.doesNotMatch(onboardingCss, /learningSetupCard\{[^}]*min-height\s*:/);
  assert.doesNotMatch(onboardingCss, /learningSetupCard\{[^}]*max-height\s*:/);
  assert.match(previewCss, /padding:17px 20px 16px/);
});

test("onboarding updates state in place and never re-renders the root after a choice", async () => {
  const feature = await source("src/features/onboarding/index.js");
  const setup = await source("src/shared/settings/learning-setup.js");
  const assignments = feature.match(/shell\.root\.innerHTML\s*=/g) || [];
  assert.equal(assignments.length, 1);
  assert.match(feature, /syncLearningSetupView\(shell\.root, draft/);
  assert.match(setup, /export function syncLearningSetupView/);
  assert.doesNotMatch(feature, /const render = \(\) =>|render\(\);\s*\n\s*}/);
});

test("preview reveal is cancelable and respects reduced motion", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  const previewCss = await source("src/shared/styles/learning-preview.css");
  assert.match(setup, /previewAnimations\.get\(element\)\?\.cancel\(\)/);
  assert.match(setup, /prefers-reduced-motion: reduce/);
  assert.match(setup, /element\.animate\(/);
  assert.match(previewCss, /@media\(prefers-reduced-motion:reduce\)/);
});

test("continue button uses the standard application button", async () => {
  const setup = await source("src/shared/settings/learning-setup.js");
  const css = await source("src/features/onboarding/onboarding.css");
  assert.match(setup, /class="btn actionPrimary learningSetupContinue"/);
  assert.match(css, /\.learningSetupContinue\{width:100%\}/);
  assert.doesNotMatch(css, /\.learningSetupContinue[^\n]*background|\.learningSetupContinue[^\n]*border-radius|\.learningSetupContinue[^\n]*box-shadow/);
});

test("content starts below top chrome and scrolls instead of overlapping on short screens", async () => {
  const css = await source("src/features/onboarding/onboarding.css");
  assert.match(css, /padding:calc\(var\(--safe-top\) \+ var\(--header-h\) \+ var\(--content-rest-gap\)\)/);
  assert.match(css, /\.learningSetupPane\{[^}]*margin:auto/);
  assert.match(css, /@media\(max-height:700px\)/);
  assert.match(css, /\.learningSetupPane\{margin-top:0;margin-bottom:0\}/);
});
