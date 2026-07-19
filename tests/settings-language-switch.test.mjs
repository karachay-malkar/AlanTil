import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all historical settings-store specifiers resolve to one module instance", async () => {
  const index = await read("index.html");
  const versions = ["13.9.0", ...Array.from({ length: 12 }, (_, index) => `13.10.${index}`)];
  for (const version of versions) {
    assert.ok(index.includes(`"/src/shared/settings/user-settings-store.js?v=${version}": "/src/shared/settings/user-settings-store.js?v=13.10.12"`), `missing settings-store alias for ${version}`);
  }
});

test("settings save applies the selected language before rerender", async () => {
  const settings = await read("src/features/settings/index.js");
  assert.match(settings, /import \{ msg, setInterfaceLanguage \}/);
  const applyAt = settings.indexOf("setInterfaceLanguage(persistedSettings.interface_language_code)");
  const refreshAt = settings.indexOf("await context.router.refresh()");
  assert.ok(applyAt >= 0, "language application call is missing");
  assert.ok(refreshAt > applyAt, "route refresh must happen after language application");
});

test("startup hides unlocalized content and resolves account settings before routing", async () => {
  const index = await read("index.html");
  const bootstrap = await read("src/app/bootstrap.js");
  assert.match(index, /data-i18n-ready="false"/);
  assert.match(index, /alantil_interface_language_v1/);
  assert.match(index, /data-scope-ready="false"/);
  const authAt = bootstrap.indexOf("await waitForAuthInitialization()");
  const progressAt = bootstrap.indexOf("await initializeProgressSystem()");
  const routerAt = bootstrap.indexOf("const router = createRouter");
  assert.ok(authAt >= 0 && progressAt > authAt && routerAt > progressAt);
});

test("selected word-content language never falls back to Russian", async () => {
  const display = await read("src/shared/domain/alan-display.js");
  assert.doesNotMatch(display, /keys\.english\]\) \|\| text\(entry\?\.\[keys\.russian/);
  assert.doesNotMatch(display, /keys\.turkish\]\) \|\| text\(entry\?\.\[keys\.russian/);
});
