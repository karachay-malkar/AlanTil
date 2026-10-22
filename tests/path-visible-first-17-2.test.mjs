import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
test("only the nearest four illustrated stages are eager",async()=>{
  const s=await readFile(new URL("../src/features/path/feature.js",import.meta.url),"utf8");
  assert.match(s,/const loading = eagerCachedRouteImages \|\| index < 4 \? "eager" : "lazy"/);
  assert.match(s,/const priority = index < 4 \? "high" : "low"/);
  assert.ok(s.includes("fetchpriority="));
});
