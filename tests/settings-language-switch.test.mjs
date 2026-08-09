import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("all historical settings-store specifiers resolve to one 13.15 module instance", async () => {
  const index = await read("index.html");
  const versions = ["13.9.0", ...Array.from({ length: 13 }, (_, index) => `13.10.${index}`), "13.11", "13.12", "13.13", "13.14", "13.15"];
  assert.match(index, /\/src\/shared\/settings\/user-settings-store\.js/);
  assert.match(index, /const targetVersion = "13\.15"/);
  for (const version of versions) {
    assert.ok(index.includes(`"${version}"`), `missing supported singleton version ${version}`);
  }
});

test("settings save applies the selected language before rerender", async () => {
  const settings = await read("src/features/settings/feature.js");
  assert.match(settings, /import \{ msg, setInterfaceLanguage \}/);
  const applyAt = settings.indexOf("setInterfaceLanguage(persistedSettings.interface_language_code)");
  const refreshAt = settings.indexOf("await context.router.refresh()");
  assert.ok(applyAt >= 0, "language application call is missing");
  assert.ok(refreshAt > applyAt, "route refresh must happen after language application");
});

test("startup exposes the local shell immediately and restores authenticated state in background", async () => {
  const index = await read("index.html");
  const bootstrap = await read("src/app/bootstrap.js");
  assert.match(index, /data-i18n-ready="false"/);
  assert.match(index, /alantil_interface_language_v1/);
  assert.match(index, /data-scope-ready="true"/);
  const authStartAt = bootstrap.indexOf("const authInitialization = waitForAuthInitialization()");
  const progressAt = bootstrap.indexOf("await initializeProgressSystem()");
  const routerAt = bootstrap.indexOf("const router = createRouter");
  assert.ok(authStartAt >= 0 && progressAt > authStartAt && routerAt > progressAt);
  assert.match(bootstrap, /persistedAuth && !callbackVisit/);
  assert.match(bootstrap, /reason: "auth_ready"/);
});

test("selected word-content language never falls back to Russian", async () => {
  const display = await read("src/shared/domain/alan-display.js");
  assert.doesNotMatch(display, /keys\.english\]\) \|\| text\(entry\?\.\[keys\.russian/);
  assert.doesNotMatch(display, /keys\.turkish\]\) \|\| text\(entry\?\.\[keys\.russian/);
});
