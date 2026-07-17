import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname } from "node:path";

const projectRoot = new URL("../", import.meta.url);
const srcRoot = new URL("../src/", import.meta.url);
const analyticsSource = await readFile(new URL("../src/config/analytics.js", import.meta.url), "utf8");
const appVersion = analyticsSource.match(/appVersion\s*=\s*"([^"]+)"/)?.[1];

async function javascriptFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directoryUrl);
    if (entry.isDirectory()) files.push(...await javascriptFiles(child));
    else if (extname(entry.name) === ".js") files.push(child);
  }
  return files;
}

test("every literal local JavaScript dependency uses the release version", async () => {
  assert.equal(appVersion, "13.8");
  const failures = [];
  const importPattern = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)(["'`])([^"'`]+\.js(?:\?[^"'`]*)?)/g;
  for (const file of await javascriptFiles(srcRoot)) {
    const source = await readFile(file, "utf8");
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[2];
      if (!specifier.startsWith(".")) continue;
      if (!specifier.includes(`?v=${appVersion}`)) {
        failures.push(`${file.pathname.replace(projectRoot.pathname, "")}: ${specifier}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});
