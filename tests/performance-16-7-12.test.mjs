import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("onboarding and its CSS only load when initial guest setup is needed", async () => {
  const bootstrap = await read("src/app/bootstrap.js");
  const appCss = await read("src/shared/styles/app.css");
  const onboardingCss = await read("src/shared/styles/feature/onboarding.css");
  assert.match(bootstrap, /!persistedAuth && !hasCompletedLearningSetup\(\)/);
  assert.match(bootstrap, /import\("\.\.\/features\/onboarding\/index\.js\?v=13\.10\.12"\)/);
  assert.match(bootstrap, /ensureOnboardingStyle\(\)/);
  assert.doesNotMatch(bootstrap, /import \{ runLearningSetup \}/);
  assert.doesNotMatch(appCss, /features\/onboarding\/onboarding\.css/);
  assert.match(onboardingCss, /layer\(features\)/);
});

test("guide installation is deferred until first route paints, but remains available", async () => {
  const bootstrap = await read("src/app/bootstrap.js");
  const onboarding = await read("src/features/onboarding/index.js");
  const guide = await read("src/features/onboarding/guide.js");
  assert.doesNotMatch(onboarding, /import ["']\.\/guide\.js/);
  assert.match(bootstrap, /await router\.start\(\);\s*installGuideAfterFirstPaint\(\);/);
  assert.match(bootstrap, /requestIdleCallback/);
  assert.match(bootstrap, /features\/onboarding\/guide\.js\?v=13\.15\.10\.12/);
  assert.match(guide, /export function installGuidedHelp/);
});

test("progress scope initializes before router navigation; feature styles stay route-scoped", async () => {
  const bootstrap = await read("src/app/bootstrap.js");
  const router = await read("src/app/router.js");
  const css = await read("src/shared/styles/app.css");
  assert.ok(bootstrap.indexOf("await initializeProgressSystem();") < bootstrap.indexOf("await router.start();"));
  assert.match(router, /ensureFeatureStyle\(feature\)/);
  assert.match(router, /FEATURE_STYLE_PATHS/);
  assert.match(css, /features\/path\/path\.css/);
  assert.doesNotMatch(css, /features\/(?:profile|admin|masonry|ashyk)\//);
});

test("HTML defines a local favicon to prevent automatic /favicon.ico 404s", async () => {
  const html = await read("index.html");
  const icon = await read("assets/icons/ui/path.svg");
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/assets\/icons\/ui\/path\.svg\?v=16\.7\.12"/);
  assert.match(icon, /<svg/);
});
