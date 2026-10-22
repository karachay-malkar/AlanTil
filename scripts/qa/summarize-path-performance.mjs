import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.argv[2] || "compare-results";
const keys = ["before", "after"];
const median = values => [...values].sort((a,b) => a-b)[2];
const output = {};
for (const key of keys) {
  output[key] = [];
  for (let i=1; i<=5; i++) {
    const path = join(root, key, String(i).padStart(2, "0") + ".json");
    const r = JSON.parse(await readFile(path, "utf8"));
    if (r.runtimeError || r.categories?.performance?.score == null) throw Error("Invalid Lighthouse result: " + path);
    const requests = r.audits?.["network-requests"]?.details?.items || [];
    const icons = requests.filter(x => String(x.url).includes("/assets/icons/sets/") && String(x.url).includes(".webp"));
    const failed = requests.filter(x => Number(x.statusCode) >= 400);
    const errors = r.audits?.["errors-in-console"]?.details?.items || [];
    if (icons.length < 26 || failed.length || errors.length) {
      throw Error("Visual mismatch " + key + " run " + i + ": " +
        JSON.stringify({ icons:icons.length, http:failed.length, console:errors.length }));
    }
    const metric = name => Number(r.audits?.[name]?.numericValue || 0);
    output[key].push({
      run:i, score:Math.round(r.categories.performance.score*100),
      fcp:metric("first-contentful-paint"), lcp:metric("largest-contentful-paint"),
      tbt:metric("total-blocking-time"), cls:metric("cumulative-layout-shift"),
      requests:requests.length, icons:icons.length,
      lcpNode:r.audits?.["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.selector || ""
    });
  }
}
const fields=["score","fcp","lcp","tbt","cls","requests","icons"];
const record = key => fields.map(k=>Number(median(output[key].map(x=>x[k])).toFixed(k==="cls"?3:0)));
const lines=[
  "# AlanTil 17.2: five-run mobile performance comparison",
  "",
  "Lighthouse 12.8.2 on localhost with isolated seeded Chrome profiles; not production field data.",
  "",
  "| Commit | Score | FCP ms | LCP ms | TBT ms | CLS | Requests | Icon requests |",
  "|---|---:|---:|---:|---:|---:|---:|---:|",
  "| Before 184788115 | "+record("before").join(" | ")+" |",
  "| After fix | "+record("after").join(" | ")+" |",
  ""
];
for (const key of keys) {
  lines.push("## "+key,"| Run | Score | FCP ms | LCP ms | TBT ms | Requests | Icons | LCP selector |","|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const s of output[key]) {
    lines.push("| "+[s.run,s.score,Math.round(s.fcp),Math.round(s.lcp),Math.round(s.tbt),s.requests,s.icons,s.lcpNode].join(" | ")+" |");
  }
  lines.push("");
}
const report=lines.join("\n");
await writeFile(join(root,"SUMMARY.md"),report);
await writeFile(join(root,"samples.json"),JSON.stringify(output,null,2));
console.log(report);
