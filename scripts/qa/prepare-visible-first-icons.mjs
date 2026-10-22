import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";

const file="src/features/path/feature.js";
let s=await readFile(file,"utf8");
const anchor='    const achievementLevel = masteryLevelForPercent(progress.percent);\n';
const images=[
  'loading="eager" decoding="async" fetchpriority="high"',
  'loading="eager" decoding="async"></span>'
];
for(const needle of [anchor,...images])assert.equal(s.split(needle).length,2,"Unexpected icon syntax: "+needle);
s=s.replace(anchor,anchor+
  '    // First four (lower-route) stations load eagerly; others when scrolled into view.\n'+
  '    const loading = index < 4 ? "eager" : "lazy";\n'+
  '    const priority = index < 4 ? "high" : "low";\n');
s=s.replace(images[0],'loading="${loading}" decoding="async" fetchpriority="${priority}"');
s=s.replace(images[1],'loading="${loading}" decoding="async"></span>');
assert.match(s,/const loading = index < 4/);
await writeFile(file,s);
console.log("Prepared disposable visible-first variant; 4 eager and 22 lazy stage icons.");
