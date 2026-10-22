import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {resolve} from "node:path";

const data=JSON.parse(await readFile(resolve(process.argv[2]||""),"utf8"));
assert.equal(data.beginner?.length,30,"Expected 30 beginner metadata rows");
assert.equal(data.intermediate?.length,26,"Expected 26 intermediate metadata rows");
for(const [type,rows] of Object.entries(data)){
  for(let i=0;i<rows.length;i++){
    assert.equal(rows[i].entity_id,type+"-"+String(i+1).padStart(2,"0"),"Unexpected set ID");
    assert.match(rows[i].icon_name,/^(0[1-9]|[12]\d|30)_[a-z0-9_]+\.webp$/);
  }
}
const manifest='// Shipped fallback snapshot of public content_structure set metadata.\n'+
  '// Live Supabase responses still refresh the cache and update the UI.\n'+
  'export const BEGINNER_SET_METADATA = '+JSON.stringify(data.beginner,null,2)+';\n'+
  'export const INTERMEDIATE_SET_METADATA = '+JSON.stringify(data.intermediate,null,2)+';\n';
const manifestPath=resolve("src/data/path-set-metadata.js");
const path=resolve("src/features/path/feature.js");
let source=await readFile(path,"utf8");
const before=source.length;
const importLine='import { BEGINNER_SET_METADATA, INTERMEDIATE_SET_METADATA } from "../../data/path-set-metadata.js?v=17.2.2";\n';
if(!source.includes(importLine))source=importLine+source;
function replaceFunction(text,startMarker,endMarker,newFunction){
  const start=text.indexOf(startMarker),end=text.indexOf(endMarker,start);
  if(start<0||end<=start||text.indexOf(startMarker,start+1)!==-1)throw Error("Unexpected feature module structure for "+startMarker);
  return text.slice(0,start)+newFunction+"\n\n"+text.slice(end);
}
const beginner=[
  'function readBeginnerMetadataCache() {',
  '  try {',
  '    const cached = normalizeBeginnerMetadataRows(JSON.parse(localStorage.getItem(BEGINNER_METADATA_CACHE_KEY) || "[]"));',
  '    if (hasCompleteBeginnerMetadata(cached)) return cached;',
  '  } catch {}',
  '  return normalizeBeginnerMetadataRows(BEGINNER_SET_METADATA);',
  '}'
].join("\n");
const intermediate=[
  'function readIntermediateMetadataCache() {',
  '  try {',
  '    const cached = normalizeIntermediateMetadataRows(JSON.parse(localStorage.getItem(INTERMEDIATE_METADATA_CACHE_KEY) || "[]"));',
  '    if (hasCompleteIntermediateMetadata(cached)) return cached;',
  '  } catch {}',
  '  return normalizeIntermediateMetadataRows(INTERMEDIATE_SET_METADATA);',
  '}'
].join("\n");
source=replaceFunction(source,"function readBeginnerMetadataCache() {","function writeBeginnerMetadataCache(",beginner);
source=replaceFunction(source,"function readIntermediateMetadataCache() {","function writeIntermediateMetadataCache(",intermediate);
await writeFile(manifestPath,manifest);
await writeFile(path,source);
console.log("Prepared isolated metadata fallback: 30 beginner and 26 intermediate rows; feature bytes",before,"->",source.length,"manifest bytes",manifest.length);
