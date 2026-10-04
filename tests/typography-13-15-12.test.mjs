import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { UI_TOKENS } from "../packages/alantil-ui/tokens.js";
import { BUTTON_FAMILIES, BUTTON_ROLES } from "../packages/alantil-ui/buttons.js";
import { BRACKET_NAVIGATION_TEXT_ROLE, bracketNavigationTextStyle, resolveTypography } from "../packages/alantil-ui/typography.js";
import { normalizeTextSizeCode, DEFAULT_USER_SETTINGS } from "../packages/alantil-core/settings.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("four text-size modes expose five semantic roles including Button", () => {
  const expected = {
    small: { technical: 10, body: 12, button: 11, accent: 16, result: 48 },
    medium: { technical: 10, body: 14, button: 12, accent: 20, result: 48 },
    large: { technical: 12, body: 16, button: 14, accent: 24, result: 48 },
    huge: { technical: 14, body: 18, button: 16, accent: 28, result: 48 },
  };
  for (const [mode, roles] of Object.entries(expected)) {
    const scale = UI_TOKENS.typeScale[mode];
    assert.deepEqual(scale, roles);
    const resolved = resolveTypography(mode, 320);
    assert.deepEqual(Object.keys(resolved), ["technical", "body", "button", "accent", "result"]);
    assert.equal(resolved.button, roles.button);
    assert.equal(resolved.result, 48);
    assert.equal(resolveTypography(mode, 1440).accent, roles.accent);
  }
  assert.equal(DEFAULT_USER_SETTINGS.text_size_code, "medium");
  assert.equal(normalizeTextSizeCode("huge"), "huge");
  assert.equal(normalizeTextSizeCode("invalid"), "medium");
});

test("button system exposes exactly five visual families", () => {
  assert.deepEqual(Object.keys(BUTTON_FAMILIES), ["action", "segment", "bracket", "choice", "icon"]);
  assert.deepEqual(new Set(Object.values(BUTTON_ROLES).map((role) => role.family)), new Set(Object.keys(BUTTON_FAMILIES)));
  assert.equal(BUTTON_ROLES["generic.primary"].family, "action");
  assert.equal(BUTTON_ROLES["direction.choice"].family, "segment");
  assert.equal(BUTTON_ROLES["path.storyTab"].family, "bracket");
  assert.equal(BUTTON_ROLES["test.answer"].family, "choice");
  assert.equal(BUTTON_ROLES["favorite.toggle"].family, "icon");
});

test("generated Web tokens and theme expose the five-role typography contract", async () => {
  const theme = await read("src/shared/styles/theme.css");
  const shared = await read("src/shared/styles/shared-visual-tokens.css");
  for (const [mode, technical, body, button, accent] of [
    ["small", 10, 12, 11, 16],
    ["medium", 10, 14, 12, 20],
    ["large", 12, 16, 14, 24],
    ["huge", 14, 18, 16, 28],
  ]) {
    assert.match(shared, new RegExp(`--ui-text-${mode}-technical:${technical}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-body:${body}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-button:${button}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-accent:${accent}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-result:48px;`));
    assert.match(theme, new RegExp(`html\\[data-text-size="${mode}"\\]`));
  }
  assert.match(theme, /--text-technical:var\(--ui-text-medium-technical\)/);
  assert.match(theme, /--text-body:var\(--ui-text-medium-body\)/);
  assert.match(theme, /--text-button:var\(--ui-text-medium-button\)/);
  assert.match(theme, /--text-accent:var\(--ui-text-medium-accent\)/);
  assert.match(theme, /--text-result:var\(--ui-text-medium-result\)/);
});

test("final typography layer assigns Button to text controls without changing ordinary rows", async () => {
  const typography = await read("src/shared/styles/typography.css");
  const mobileTheme = await read("mobile/ui/theme.js");
  const mobileComponents = await read("mobile/ui/components.js");

  assert.match(typography, /\.btn/);
  assert.match(typography, /\.settingsChoiceBody/);
  assert.match(typography, /\.radioOpt span/);
  assert.match(typography, /\.modeDirectionToggle button/);
  assert.match(typography, /\.stationDirectionToggle button/);
  assert.match(typography, /\.optionBtn/);
  assert.match(typography, /\.matchCard/);
  assert.match(typography, /\.bracketNavigation/);
  assert.match(typography, /font-family:var\(--font-body\);font-size:var\(--text-button\)/);
  assert.match(typography, /\.settingsLink/);
  assert.match(typography, /font-family:var\(--font-body\);font-size:var\(--text-body\)/);

  assert.match(mobileTheme, /button:\{fontSize:t\.button/);
  assert.match(mobileComponents, /textType\.button\.fontSize/);
});

test("segmented controls share one geometry and Button typography", async () => {
  const appStyles = await read("src/shared/styles/app.css");
  const segmented = await read("src/shared/styles/segmented-control.css");
  const settings = await read("src/features/settings/settings.css");

  const featuresIndex = appStyles.indexOf('layer(features)');
  const segmentedIndex = appStyles.indexOf('segmented-control.css');
  assert.ok(featuresIndex >= 0 && segmentedIndex > featuresIndex, "segmented-control.css must load after feature styles");

  assert.match(segmented, /\.segmentControl\{[^}]*width:100%[^}]*min-width:0[^}]*padding:2px[^}]*border:1px solid var\(--line\)[^}]*border-radius:999px/s);
  assert.match(segmented, /\.settingsChoiceBody,\.settingsChoice>span,[^\{]*\.radioOpt span,[^\{]*\.modeDirectionToggle button,[^\{]*\.stationDirectionToggle button[^\{]*\{[^}]*font-family:var\(--font-body\)[^}]*font-size:var\(--text-button\)[^}]*font-weight:750/s);
  assert.match(segmented, /:checked[^\{]*\{[^}]*font-weight:850/s);
  assert.match(segmented, /\.modeDirectionToggle button\.active[^\{]*\{[^}]*font-weight:850/s);
  assert.match(segmented, /\.stationDirectionToggle button\.active[^\{]*\{[^}]*font-weight:850/s);
  assert.doesNotMatch(segmented, /font-size:(?:8|8\.5|9|10|11|12|13|14|15|16)px/);
  assert.match(settings, /\.settingsRow\{[^}]*grid-template-columns:minmax\(0,\.9fr\) minmax\(0,1\.1fr\)/s);
});

test("bracket checkbox renders each state as one complete glyph string", async () => {
  const components = await read("src/shared/styles/components.css");
  const typography = await read("src/shared/styles/typography.css");
  assert.match(components, /\.bracketCheckboxMark::before\{[^}]*content:"\[ \]"/s);
  assert.match(components, /input:checked\+\.bracketCheckboxMark::before\{content:"\[✓\]"\}/);
  assert.match(components, /input:indeterminate\+\.bracketCheckboxMark::before\{content:"\[-\]"\}/);
  assert.doesNotMatch(components, /\.bracketCheckboxMark::after/);
  assert.doesNotMatch(typography, /\.bracketCheckboxMark/);
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

test("all bracket navigation controls use the shared Button role", async () => {
  assert.equal(BRACKET_NAVIGATION_TEXT_ROLE, "button");
  const normal = bracketNavigationTextStyle({ button: { fontSize: 12 }, body: { fontSize: 14 } });
  const active = bracketNavigationTextStyle({ button: { fontSize: 12 }, body: { fontSize: 14 } }, true);
  assert.equal(normal.fontSize, 12);
  assert.equal(normal.lineHeight, 12 * 1.35);
  assert.equal(normal.fontWeight, "750");
  assert.equal(active.fontWeight, "900");

  const typography = await read("src/shared/styles/typography.css");
  assert.match(typography, /\.bracketNavigation[^\{]*\{[^}]*font-family:var\(--font-body\)[^}]*font-size:var\(--text-button\)/s);

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
});
