import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const source = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("authenticated account URLs remain valid direct routes", async () => {
  const index = await source("index.html");
  const router = await source("src/app/router.js");
  assert.doesNotMatch(index, /location\.pathname === "\/profile\/account"[\s\S]*?history\.replaceState\(null, "", "\/profile"\)/);
  assert.match(router, /second === "account"\) return \{ route: "account\.home"/);
  assert.match(router, /routeName === "account\.home"\) return "\/profile\/account"/);
});

test("GitHub Pages deep links are restored without requiring sessionStorage", async () => {
  const fallback = await source("404.html");
  const bootstrap = await source("src/app/bootstrap.js");
  assert.match(fallback, /__alantil_route/);
  assert.match(fallback, /searchParams\.set\("__alantil_route", target\)/);
  assert.doesNotMatch(fallback, /sessionStorage/);
  assert.match(bootstrap, /restoreFallbackRoute\(\)/);
  assert.ok(bootstrap.indexOf("restoreFallbackRoute();") < bootstrap.indexOf("normalizeInitialLearningPath();"));
});

test("OAuth callback detection remains independent from deep-link recovery", async () => {
  const bootstrap = await source("src/app/bootstrap.js");
  assert.match(bootstrap, /hasAuthCallback\(\)/);
  assert.match(bootstrap, /window\.location\.pathname === "\/auth\/callback"/);
  assert.match(bootstrap, /if \(callbackVisit\) await authInitialization/);
});
