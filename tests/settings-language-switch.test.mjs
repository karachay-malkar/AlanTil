import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all historical settings-store specifiers resolve to one module instance", async () => {
  const index = await read("index.html");
  for (const version of ["13.9.0", "13.10.0", "13.10.1", "13.10.2", "13.10.3", "13.10.4", "13.10.5", "13.10.6", "13.10.7", "13.10.8", "13.10.9"]) {
    assert.ok(index.includes(`\"/src/shared/settings/user-settings-store.js?v=${version}\": \"/src/shared/settings/user-settings-store.js?v=13.10.10\"`), `missing settings-store alias for ${version}`);
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
