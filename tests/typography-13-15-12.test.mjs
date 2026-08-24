import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("semantic typography exposes only the approved five fixed tiers", async () => {
  const theme = await read("src/shared/styles/theme.css");
  assert.match(theme, /--text-micro:10px;/);
  assert.match(theme, /--text-caption:12px;/);
  assert.match(theme, /--text-body:14px;/);
  assert.match(theme, /--text-emphasis:16px;/);
  assert.match(theme, /--text-title:20px;/);
  assert.match(theme, /html\[data-text-size="small"\]/);
  assert.match(theme, /html\[data-text-size="medium"\]/);
  assert.match(theme, /html\[data-text-size="large"\]/);
});

test("display and result sizes are unified for all three text-size modes", async () => {
  const theme = await read("src/shared/styles/theme.css");
  assert.match(theme, /--text-display:clamp\(24px,7vw,40px\)/);
  assert.match(theme, /--text-display:clamp\(28px,8vw,48px\)/);
  assert.match(theme, /--text-display:clamp\(32px,9vw,56px\)/);
  assert.match(theme, /--text-result:clamp\(36px,12vw,54px\)/);
  assert.match(theme, /--text-result:clamp\(40px,14vw,64px\)/);
  assert.match(theme, /--text-result:clamp\(44px,15vw,72px\)/);
});

test("the final typography layer routes application text through semantic tokens", async () => {
  const appStyles = await read("src/shared/styles/app.css");
  const typography = await read("src/shared/styles/typography.css");
  assert.match(appStyles, /typography\.css\?v=13\.15\.12/);
  assert.match(typography, /body \*::after\)\{font-size:var\(--text-body\)\}/);
  assert.match(typography, /\.stationLabel\{font-size:var\(--text-caption\)\}/);
  assert.match(typography, /\.stationWordCount\{font-size:var\(--text-micro\)\}/);
  assert.match(typography, /\.learnCard \.word,.modeQuestion,.stationTestQuestion/);
  assert.match(typography, /\.stationResultScore,.modeResultSummary strong/);
});

test("text size is a scoped user setting with small, medium and large values", async () => {
  const store = await read("src/shared/settings/user-settings-store.js");
  const settings = await read("src/features/settings/feature.js");
  assert.match(store, /text_size_code: "medium"/);
  assert.match(store, /\["small", "medium", "large"\]\.includes\(value\)/);
  assert.match(store, /document\.documentElement\.dataset\.textSize = normalized/);
  assert.match(settings, /name: "textSize"/);
  assert.match(settings, /text_size_code: radio\.value/);
});
