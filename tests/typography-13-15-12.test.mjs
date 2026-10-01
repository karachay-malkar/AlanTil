import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { UI_TOKENS } from "../packages/alantil-ui/tokens.js";
import { resolveTypography } from "../packages/alantil-ui/typography.js";
import { normalizeTextSizeCode, DEFAULT_USER_SETTINGS } from "../packages/alantil-core/settings.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("four text-size modes expose exactly technical, body and accent sizes", () => {
  const expected = {
    small: [10, 12, 16],
    medium: [10, 14, 20],
    large: [12, 16, 24],
    huge: [14, 18, 28],
  };
  for (const [mode, sizes] of Object.entries(expected)) {
    const scale = UI_TOKENS.typeScale[mode];
    assert.deepEqual([...new Set([scale.micro, scale.caption, scale.body, scale.emphasis, scale.title, scale.display])], sizes);
    assert.equal(scale.result, 48);
    assert.equal(resolveTypography(mode, 320).result, 48);
    assert.equal(resolveTypography(mode, 1440).display, sizes[2]);
  }
  assert.equal(DEFAULT_USER_SETTINGS.text_size_code, "medium");
  assert.equal(normalizeTextSizeCode("huge"), "huge");
  assert.equal(normalizeTextSizeCode("invalid"), "medium");
});

test("generated Web tokens and theme expose all four modes with a fixed 48px result", async () => {
  const theme = await read("src/shared/styles/theme.css");
  const shared = await read("src/shared/styles/shared-visual-tokens.css");
  for (const [mode, technical, body, accent] of [
    ["small", 10, 12, 16],
    ["medium", 10, 14, 20],
    ["large", 12, 16, 24],
    ["huge", 14, 18, 28],
  ]) {
    assert.match(shared, new RegExp(`--ui-text-${mode}-micro:${technical}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-body:${body}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-title:${accent}px;`));
    assert.match(shared, new RegExp(`--ui-text-${mode}-result:48px;`));
    assert.match(theme, new RegExp(`html\\[data-text-size="${mode}"\\]`));
  }
  assert.match(theme, /--text-result:var\(--ui-text-medium-result\)/);
});

test("final typography layer maps Ashyk technical, body, accent and result roles", async () => {
  const appStyles = await read("src/shared/styles/app.css");
  const typography = await read("src/shared/styles/typography.css");
  assert.match(appStyles, /typography\.css\?v=16\.8\.0\.11/);
  assert.match(typography, /ashykDifficultyHint/);
  assert.match(typography, /ashykModeButton/);
  assert.match(typography, /ashykQuestionPrompt/);
  assert.match(typography, /ashykFinalScore strong\)\{font-size:var\(--text-result\)\}/);
});

test("settings and both onboarding surfaces expose the huge option", async () => {
  const settings = await read("src/features/settings/feature.js");
  const webSetup = await read("src/shared/settings/learning-setup.js");
  const mobileSetup = await read("mobile/screens/onboarding.js");
  assert.match(settings, /\["huge", msg\("settings\.razmer_teksta_ogromnyy"\)\]/);
  assert.match(webSetup, /\["huge",/);
  assert.match(mobileSetup, /\['huge',copy\.huge\]/);
});
