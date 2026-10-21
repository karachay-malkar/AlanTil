import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");

function setup(fetcher) {
  const captured = [];
  const stored = new Map();
  const listeners = {};
  const ctx = vm.createContext({
    self: { location: { origin: "https://alantil.ru" }, addEventListener: (type, fn) => { listeners[type] = fn; } },
    caches: {
      open: async () => ({ put: async (key, value) => { stored.set(typeof key === "string" ? key : key.url, value); } }),
      match: async (key) => stored.get(typeof key === "string" ? key : key.url) || null,
    },
    fetch: async (request, options) => {
      captured.push({ target: typeof request === "string" ? request : request.url, options });
      return fetcher(request, options);
    },
    URL, Response, Promise, Set, console,
  });
  vm.runInContext(source, ctx);
  return { ctx, captured, stored, listeners };
}

test("known SPA deep links do not trigger a redundant network 404", async () => {
  const env = setup(async (url) => {
    assert.equal(url, "/index.html");
    return new Response("<!doctype html><html></html>", { status: 200 });
  });
  const request = { url: "https://alantil.ru/path/oblivion", mode: "navigate", method: "GET" };
  env.ctx.requestToTest = request;
  const response = await vm.runInContext("navigationResponse(requestToTest)", env.ctx);
  assert.equal(response.status, 200);
  assert.equal(env.captured.length, 1);
  assert.equal(env.captured[0].target, "/index.html");
  assert.ok(env.stored.has("/index.html"));
  assert.ok(!env.stored.has(request.url));
});

test("the independent tower preview bypasses SPA rewrite", async () => {
  const env = setup(async (request) => new Response("preview", { status: 200 }));
  let respond;
  const req = { url: "https://alantil.ru/tower-masonry-test", method: "GET", mode: "navigate" };
  env.listeners.fetch({ request: req, respondWith: (promise) => { respond = promise; } });
  const response = await respond;
  assert.equal(await response.text(), "preview");
  assert.equal(env.captured[0].target, req.url);
});

test("SPA fallback serves cached shell without a network connection", async () => {
  const env = setup(async () => { throw new Error("Offline"); });
  env.stored.set("/index.html", new Response("cached", { status: 200 }));
  env.ctx.requestToTest = { url: "https://alantil.ru/profile/settings", mode: "navigate", method: "GET" };
  const response = await vm.runInContext("navigationResponse(requestToTest)", env.ctx);
  assert.equal(await response.text(), "cached");
  assert.equal(env.captured.length, 1);
});
