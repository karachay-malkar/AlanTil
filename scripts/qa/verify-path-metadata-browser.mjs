import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const chromePath = process.env.CHROME_PATH || "google-chrome";
const profile = await mkdtemp(join(tmpdir(), "alantil-path-e2e-"));
const seeded = spawnSync(process.execPath, ["scripts/qa/seed-lighthouse-profile.mjs", profile], {
  encoding: "utf8", timeout: 30000, env: process.env
});
assert.equal(seeded.status, 0, (seeded.stderr || "") + (seeded.stdout || ""));
await rm(join(profile, "DevToolsActivePort"), { force: true });

const chrome = spawn(chromePath, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
  "--user-data-dir=" + profile, "http://127.0.0.1:4173/path/oblivion"
], { stdio: "ignore" });

let ws;
const pending = new Map();
let nextId = 1;
let traceResolve;
const tracePromise = new Promise(resolve => { traceResolve = resolve; });
try {
  let port = 0;
  for (let attempt = 0; attempt < 150; attempt++) {
    if (chrome.exitCode !== null) throw new Error("Chrome exited: " + chrome.exitCode);
    try {
      port = Number((await readFile(join(profile, "DevToolsActivePort"), "utf8")).split("\n")[0]);
      if (port) break;
    } catch {}
    await sleep(100);
  }
  assert.ok(port, "Chrome CDP port unavailable");
  let target;
  for (let attempt = 0; attempt < 100; attempt++) {
    const tabs = await (await fetch("http://127.0.0.1:" + port + "/json/list")).json();
    target = tabs.find(t => t.type === "page" && t.webSocketDebuggerUrl);
    if (target) break;
    await sleep(100);
  }
  assert.ok(target, "CDP page target unavailable");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", event => {
    const msg = JSON.parse(event.data);
    if (msg.id) {
      const entry = pending.get(msg.id);
      if (!entry) return;
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      msg.error ? entry.reject(Error(JSON.stringify(msg.error))) : entry.resolve(msg.result || {});
    } else if (msg.method === "Tracing.tracingComplete") {
      traceResolve(msg.params?.stream);
    }
  });
  function cmd(method, params = {}) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(Error("CDP timeout: " + method)); }, 12000);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await cmd("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true
    });
    if (result.exceptionDetails) throw Error("Browser JS exception: " + JSON.stringify(result.exceptionDetails));
    return result.result?.value;
  }
  async function until(check, description, timeout = 40000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await check()) return;
      await sleep(250);
    }
    throw Error("Timed out waiting for " + description);
  }
  const statsExpr = '(() => { const buttons=[...document.querySelectorAll(".pathView button[data-station-key]")]; const pictures=buttons.filter(b=>b.classList.contains("beginnerDioramaNode")); const loaded=pictures.filter(b=>b.querySelector("img[data-beginner-diorama-image]")?.naturalWidth>0); const labeled=pictures.filter(b=>b.querySelector(".stationLabel")?.textContent.trim()); return { total:buttons.length, illustrated:pictures.length, loaded:loaded.length, labeled:labeled.length, missing:pictures.filter(b=>!b.querySelector("img.beginnerDioramaImage")).length }; })()';
  await until(async () => (await evaluate(statsExpr))?.total >= 20, "Path map");
  const initial = await evaluate(statsExpr);
  // Native lazy icons are loaded as their stations enter the scroll viewport.
  await until(async () => { const s=await evaluate(statsExpr); return s?.illustrated === 26 && s?.labeled === 26 && s?.loaded >= 1; }, "illustrated labeled map");
  for (let i=0;i<26;i++){
    const item = await evaluate('(() => { const b=document.querySelectorAll(".pathView button[data-station-key]")['+i+']; if(!b)return false; b.scrollIntoView({block:"center",behavior:"instant"}); return true; })()');
    assert.ok(item, "Missing station "+i);
    await until(async () => await evaluate('(() => { const b=document.querySelectorAll(".pathView button[data-station-key]")['+i+'];const img=b?.querySelector("img[data-beginner-diorama-image]");return Boolean(img?.complete && img?.naturalWidth>0); })()'), "station image "+i, 25000);
  }
  const hydrated = await evaluate(statsExpr);
  assert.equal(hydrated.loaded, 26, "Every stage image must load after visiting it");
  assert.equal(hydrated.missing, 0);
  await evaluate('document.querySelector(".beginnerDioramaNode")?.focus()');
  const focused = await evaluate('document.activeElement?.getAttribute("data-station-key")');
  assert.ok(focused, "Could not focus illustrated station");
  await evaluate("document.activeElement.click()");
  await until(async () => await evaluate('Boolean(document.querySelector(".stationView"))'), "station navigation");
  await evaluate("history.back()");
  await until(async () => {const s=await evaluate(statsExpr);return s?.illustrated===26 && s?.labeled===26 && s?.loaded>=1;}, "return from station to map");
  const afterNavigation = await evaluate(statsExpr);
  const worker = await evaluate('(async () => { const ready=await Promise.race([navigator.serviceWorker.ready,new Promise(resolve=>setTimeout(()=>resolve(null),8000))]); if(!ready)return {active:false}; await ready.update(); return {active:Boolean(ready.active),scriptURL:ready.active?.scriptURL||"",cacheKeys:await caches.keys()}; })()');
  assert.ok(worker?.active, "Service Worker did not activate");
  assert.match(worker.scriptURL, /service-worker\.js/);
  await cmd("Page.enable");
  await cmd("Tracing.start", {
    categories: "devtools.timeline,blink.user_timing,v8,disabled-by-default-devtools.timeline",
    transferMode: "ReturnAsStream"
  });
  await cmd("Page.reload", { ignoreCache: false });
  await until(async () => {
    try {
      const reloaded=await evaluate('performance.getEntriesByType("navigation").at(-1)?.type === "reload"');
      const s=await evaluate(statsExpr);return reloaded && s?.illustrated===26 && s?.labeled===26 && s?.loaded>=1;
    } catch { return false; }
  }, "completed warm Service Worker reload");
  await cmd("Tracing.end");
  const stream = await Promise.race([tracePromise, sleep(25000).then(() => null)]);
  assert.ok(stream, "Performance trace was not produced");
  let trace = "";
  while (true) {
    const part = await cmd("IO.read", { handle: stream, size: 1048576 });
    trace += part.data || "";
    if (part.eof) break;
  }
  await cmd("IO.close", { handle: stream });
  await mkdir("perf-results", { recursive: true });
  await writeFile("perf-results/path-browser-trace.json", trace);
  await writeFile("perf-results/path-browser-e2e.json", JSON.stringify({
    initial, hydrated, afterNavigation, worker, traceBytes:Buffer.byteLength(trace)
  }, null, 2));
  console.log("Path browser E2E OK:", JSON.stringify({ initial, hydrated, afterNavigation, worker, traceBytes:Buffer.byteLength(trace) }));
} finally {
  try { ws?.close(); } catch {}
  chrome.kill("SIGTERM");
  await sleep(400);
  if (chrome.exitCode === null) chrome.kill("SIGKILL");
  await rm(profile, { recursive: true, force: true, maxRetries: 3 });
}
