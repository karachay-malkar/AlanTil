import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { UI_TOKENS } from "../packages/alantil-ui/tokens.js";
import { BRACKET_NAVIGATION_TEXT_ROLE, bracketNavigationTextStyle, resolveTypography } from "../packages/alantil-ui/typography.js";
import { normalizeTextSizeCode, DEFAULT_USER_SETTINGS } from "../packages/alantil-core/settings.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("four text-size modes expose exactly four semantic roles", () => {
  const expected = {
    small: { technical: 10, body: 12, accent: 16, result: 48 },
    medium: { technical: 10, body: 14, accent: 20, result: 48 },
    large: { technical: 12, body: 16, accent: 24, result: 48 },
    huge: { technical: 14, body: 18, accent: 28, result: 48 },
  };
  for (const [mode, roles] of Object.entries(expected)) {
    const scale = UI_TOKENS.typeScale[mode];
    assert.deepEqual(scale, roles);
    const resolved = resolveTypography(mode, 320);
    assert.deepEqual(Object.keys(resolved), ["technical", "body", "accent", "result"]);
    assert.equal(resolved.result, 48);
    assert.equal(resolveTypography(mode, 1440).accent, roles.accent);
  }
  assert.equal(DEFAULT_USER_SETTINGS.text_size_code, "medium");
  assert.equal(normalizeTextSizeCode("huge"), "huge");
  assert.equal(normalizeTextSizeCode("invalid"), "medium");
});

test("generated Web tokens and theme expose the four-role typography contract", async () => {
  const theme = await read("src/shared/styles/theme.css");
  const shared = await read("src/shared/styles/shared-visual-tokens.css");
  for (const [mode, technical, body, accent] of [
    ["small", 10, 12, 16],
    ["medium", 10, 14, 20],
    ["large", 12, 16, 24],
    ["huge", 14, 18, 28],
  ]) {
    assert.match(shared, new RegExp(`--ui-text-${mode}-technical:${technical}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-body:${body}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-accent:${accent}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-result:48px;`));
    assert.match(theme, new RegExp(`html\\[data-text-size="${mode}"\\]`));
  }
  assert.doesNotMatch(shared, /--ui-text-(?:small|medium|large|huge)-(?:micro|caption|emphasis|title|display):/);
  assert.match(theme, /--text-technical:var\(--ui-text-medium-technical\)/);
  assert.match(theme, /--text-accent:var\(--ui-text-medium-accent\)/);
  assert.match(theme, /--text-result:var\(--ui-text-medium-result\)/);
});

test("final typography layer assigns roles by object meaning", async () => {
  const appStyles = await read("src/shared/styles/app.css");
  const typography = await read("src/shared/styles/typography.css");
  const listTable = await read("packages/alantil-ui/list-table.js");
  assert.match(appStyles, /typography\.css\?v=16\.8\.0\.16/);
  assert.doesNotMatch(typography, /var\(--text-(?:micro|caption|emphasis|title|display)\)/);
  for (const selector of [
    ".stationLabel",
    ".stationWordRow .contentListPrimary",
    ".stationWordRow .contentListSecondary",
    ".settingsSectionTitle",
    ".settingsRowLabel",
    ".settingsLink",
    ".settingsChoiceBody",
    ".learnCard .trans",
    ".gTrans",
    ".gEx",
  ]) assert.ok(typography.includes(selector), selector);
  assert.match(typography, /font-family:var\(--font-body\);font-size:var\(--text-body\)/);
  assert.match(typography, /\.groupNum/);
  assert.match(typography, /font-family:var\(--font-terminal\);font-size:var\(--text-technical\)/);
  assert.match(typography, /ashykQuestionPrompt/);
  assert.match(typography, /ashykFinalScore strong\)\{font-family:var\(--font-terminal\);font-size:var\(--text-result\)\}/);
  assert.match(listTable, /medium:F\(\{primary:14,secondary:14,service:10\}\)/);
});

test("segmented choices, scope checkboxes and direction controls use the shared Body contract", async () => {
  const segmented = await read("src/shared/styles/segmented-control.css");
  const settings = await read("src/features/settings/settings.css");
  const testCss = await read("src/features/test/test.css");
  const pathCss = await read("src/features/path/path.css");
  const testView = await read("src/features/test/view.js");
  const matchView = await read("src/features/match/view.js");
  const game = await read("packages/ashyk-game/web/Game.jsx");

  assert.match(segmented, /\.settingsSegments\{[^}]*width:100%[^}]*min-width:0/s);
  assert.match(segmented, /\.settingsChoiceBody,\.settingsChoice>span\{[^}]*font-family:var\(--font-body\)[^}]*font-size:var\(--text-body\)/s);
  assert.doesNotMatch(segmented, /min-width:142px|font:750 10px\/1 var\(--font-terminal\)|font-size:9px/);
  assert.match(settings, /\.settingsRow\{[^}]*grid-template-columns:minmax\(0,\.9fr\) minmax\(0,1\.1fr\)/s);

  for (const css of [testCss, pathCss]) {
    assert.match(css, /DirectionControl>span\{[^}]*var\(--text-body\)[^}]*var\(--font-body\)/s);
    assert.match(css, /DirectionToggle\{[^}]*width:100%[^}]*min-width:0/s);
    assert.match(css, /DirectionToggle button\{[^}]*var\(--text-body\)[^}]*var\(--font-body\)/s);
  }
  assert.match(testCss, /\.radioOpt span\{[^}]*var\(--text-body\)[^}]*var\(--font-body\)/s);
  assert.match(pathCss, /\.stationLegendRow\{[^}]*font-size:var\(--text-body\)/s);
  assert.match(pathCss, /\.stationHistoryRow\{[^}]*font-size:var\(--text-body\)/s);
  assert.doesNotMatch(pathCss, /var\(--text-caption\)/);

  for (const source of [testView, matchView]) {
    assert.match(source, /bracketCheckbox scopeCheckboxControl/);
    assert.match(source, /bracketCheckboxMark/);
    assert.match(source, /sectionName = String\(section\.name \|\| ""\)\.trim\(\)/);
    assert.match(source, /scopeSectionHidden/);
  }
  assert.match(game, /bracketCheckbox scopeCheckboxControl/);
  assert.match(game, /ashykQuestionScopeName/);
});

test("settings and both onboarding surfaces expose the huge option", async () => {
  const settings = await read("src/features/settings/feature.js");
  const webSetup = await read("src/shared/settings/learning-setup.js");
  const webOnboarding = await read("src/features/onboarding/index.js");
  const mobileSetup = await read("mobile/screens/onboarding.js");
  const mobileProfile = await read("mobile/screens/profile-main.js");
  assert.match(settings, /\["huge", msg\("settings\.razmer_teksta_ogromnyy"\)\]/);
  assert.match(webSetup, /\["huge",/);
  assert.match(webOnboarding, /\["small", "medium", "large", "huge"\]\.includes/);
  assert.match(mobileSetup, /\['huge',copy\.huge\]/);
  assert.match(mobileProfile, /\["huge","XL"\]/);
  assert.match(mobileProfile, /semanticTypography\(draft\.text_size_code\|\|'medium'\)/);
  assert.match(mobileProfile, /previewType\.wordCard/);
});

test("all bracket navigation controls use one shared semantic contract", async () => {
  assert.equal(BRACKET_NAVIGATION_TEXT_ROLE, "body");
  const normal = bracketNavigationTextStyle({ body: { fontSize: 14 } });
  const active = bracketNavigationTextStyle({ body: { fontSize: 14 } }, true);
  assert.equal(normal.fontSize, 14);
  assert.equal(normal.lineHeight, 14 * 1.35);
  assert.equal(normal.fontWeight, "750");
  assert.equal(active.fontWeight, "900");

  const typography = await read("src/shared/styles/typography.css");
  const pathCss = await read("src/features/path/path.css");
  assert.match(typography, /\.bracketNavigation\{[^}]*font-size:var\(--text-body\)[^}]*font-weight:750[^}]*line-height:1\.35/s);
  assert.match(typography, /\.bracketNavigation\.active\{[^}]*font-weight:900/);
  assert.doesNotMatch(typography, /\.profilePrimaryTab,\.storyTab,\.stationViewTab,\.ashykModeButton/);
  assert.doesNotMatch(pathCss, /\.stationViewTab\{[^}]*font:/s);

  for (const [path, pattern] of [
    ["src/shared/ui/profile-navigation.js", /class="tabAction bracketNavigation profilePrimaryTab/],
    ["src/features/path/feature.js", /class="tabAction bracketNavigation storyTab/],
    ["src/features/path/station-view.js", /class="tabAction bracketNavigation stationViewTab/],
    ["src/features/path/station-statistics.js", /class="bracketNavigation profilePrimaryTab/],
    ["packages/ashyk-game/web/Game.jsx", /bracketNavigation ashykModeButton/],
    ["src/features/ashyk/runtime.js", /bracketNavigation ashykModeButton/],
  ]) assert.match(await read(path), pattern, path);

  for (const path of ["mobile/ui/profile-tabs.js", "mobile/screens/path.js", "mobile/screens/station.js", "mobile/screens/ashyk.js"]) {
    assert.match(await read(path), /bracketNavigationTextStyle/, path);
  }
  assert.doesNotMatch(await read("mobile/screens/path.js"), /storyTabText:\{[^}]*fontWeight/);
  assert.doesNotMatch(await read("mobile/screens/station.js"), /stationTabText:\{[^}]*fontWeight/);
  assert.doesNotMatch(await read("mobile/screens/ashyk.js"), /modeButtonText:\{[^}]*fontWeight/);
  assert.doesNotMatch(await read("mobile/ui/profile-tabs.js"), /profileTabText:\{[^}]*fontWeight/);
});
