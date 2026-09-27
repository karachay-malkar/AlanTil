import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("practice test keeps completed results and avoids re-entrant mount navigation", async () => {
  const source = await read("src/features/test/index.js");
  assert.match(source, /let skipAutoResumeOnce=false;/);
  assert.match(source, /screen="session";context\.router\.canonicalize\?\.\("test\.session",\{\}\)/);
  assert.match(source, /screen="menu";context\.router\.canonicalize\?\.\("test\.menu",\{\}\)/);
  assert.match(source, /reason==="back"\)skipAutoResumeOnce=true/);
  assert.match(source, /currentScreen==="session"&&!testState\.session\.completed\)clearTestSession/);
  assert.doesNotMatch(source, /await context\.router\.replace\("test\.(?:session|menu)"/);
});

test("word match keeps completed results and avoids re-entrant mount navigation", async () => {
  const source = await read("src/features/match/index.js");
  assert.match(source, /let skipAutoResumeOnce=false;/);
  assert.match(source, /screen="game";context\.router\.canonicalize\?\.\("match\.game",\{\}\)/);
  assert.match(source, /screen="menu";context\.router\.canonicalize\?\.\("match\.menu",\{\}\)/);
  assert.match(source, /reason==="back"\)skipAutoResumeOnce=true/);
  assert.match(source, /currentScreen==="game"&&!matchState\.session\.completed\)clearMatchSession/);
  assert.doesNotMatch(source, /await context\.router\.replace\("match\.(?:game|menu)"/);
});
