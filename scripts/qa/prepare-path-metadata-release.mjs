import assert from "node:assert/strict";
import {readFile,writeFile,copyFile} from "node:fs/promises";
import {resolve} from "node:path";

const root=resolve(process.argv[2]||"vetted");
const here=path=>readFile(resolve(root,path),"utf8");
const report=JSON.parse(await here("CONCLUSION.json"));
assert.ok(report.improvementMs>1500,"A-B experiment did not establish sufficient speedup");
const expected="17.2.1";
const next="17.2.2";
const releasePath=resolve("release.json");
const release=JSON.parse(await readFile(releasePath,"utf8"));
assert.equal(release.branch,"17.2");
assert.equal(release.version,expected);
assert.equal(release.android_version_code,44);
const original=await readFile("src/features/path/feature.js","utf8");
assert.ok(!original.includes("BEGINNER_SET_METADATA"),"Feature may have changed since A-B proof");
const code=await here("generated/feature.js");
const manifest=await here("generated/path-set-metadata.js");
assert.ok(code.includes('path-set-metadata.js?v='+next),"A-B patch missing bundled module import");
assert.ok(code.includes("return normalizeIntermediateMetadataRows(INTERMEDIATE_SET_METADATA)"),"A-B patch incomplete");
assert.ok(manifest.includes("export const BEGINNER_SET_METADATA ="));
assert.ok(manifest.includes("export const INTERMEDIATE_SET_METADATA ="));
await writeFile("src/features/path/feature.js",code);
await writeFile("src/data/path-set-metadata.js",manifest);
release.version=next;
release.android_version_code=45;
await writeFile(releasePath,JSON.stringify(release,null,2)+"\n");

function replaceSection(source,begin,finish,replacement){
 const a=source.indexOf(begin),b=source.indexOf(finish,a);
 if(a<0||b<=a||source.indexOf(begin,a+1)>=0)throw Error("Version generator structure changed near "+begin);
 return source.slice(0,a)+replacement+"\n"+source.slice(b);
}
const syncPath="scripts/release/sync-version.mjs";
let sync=await readFile(syncPath,"utf8");
const boot=[
"await set('src/app/bootstrap.js',original=>{",
"  let s=replaceOne(original,/(const ASSET_VERSION = \")[^\"]+/,'$1'+version,'src/app/bootstrap.js');",
"  s=replaceOne(s,/(alantil-core\\/release\\.js\\?v=)[0-9.]+/,'$1'+version,'src/app/bootstrap.js');",
"  return replaceOne(s,/(from \"\\.\\/router\\.js\\?v=)[0-9.]+/,'$1'+version,'src/app/bootstrap.js');",
"});"
].join("\n");
sync=replaceSection(sync,"await set('src/app/bootstrap.js',","await set('src/app/router.js',",boot);
const feature=[
"await set('src/features/path/feature.js',source=>{",
"  let s=replaceOne(source,/(path-route-index\\.json\\.gz\\?v=)[0-9.]+/,'$1'+version,'src/features/path/feature.js');",
"  s=replaceOne(s,/(path-route-index\\.json\\?v=)[0-9.]+/,'$1'+version,'src/features/path/feature.js');",
"  s=replaceOne(s,/(story-stele\\.js\\?v=)[0-9.]+/,'$1'+version,'src/features/path/feature.js');",
"  s=replaceOne(s,/(path-set-metadata\\.js\\?v=)[0-9.]+/,'$1'+version,'src/features/path/feature.js');",
"  return s;",
"});"
].join("\n");
sync=replaceSection(sync,"await set('src/features/path/feature.js',","await set('src/features/path/story-stele.js',",feature);
await writeFile(syncPath,sync);

const swPath="service-worker.js";
let sw=await readFile(swPath,"utf8");
const reference='  "/src/features/path/feature.js?v='+expected+'",';
assert.equal(sw.split(reference).length,2,"Service Worker asset entry changed");
sw=sw.replace(reference,reference+'\n  "/src/data/path-set-metadata.js?v='+next+'",\n  "/src/features/path/story-stele.js?v='+next+'",');
await writeFile(swPath,sw);

const testText=[
'import test from "node:test";',
'import assert from "node:assert/strict";',
'import {existsSync} from "node:fs";',
'import {readFile} from "node:fs/promises";',
'import {BEGINNER_SET_METADATA,INTERMEDIATE_SET_METADATA} from "../src/data/path-set-metadata.js";',
'const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");',
'test("bundled metadata lists all 56 public images and localized names",()=>{',
'  assert.equal(BEGINNER_SET_METADATA.length,30);',
'  assert.equal(INTERMEDIATE_SET_METADATA.length,26);',
'  for(const [type,rows] of [["beginner",BEGINNER_SET_METADATA],["intermediate",INTERMEDIATE_SET_METADATA]]){',
'    rows.forEach((entry,index)=>{',
'      assert.equal(entry.entity_id,type+"-"+String(index+1).padStart(2,"0"));',
'      assert.match(entry.icon_name,/^(0[1-9]|[12]\\d|30)_[a-z0-9_]+\\.webp$/);',
'      assert.ok(existsSync(new URL("../assets/icons/sets/"+entry.icon_name,import.meta.url)),entry.icon_name);',
'      if(type==="beginner")for(const field of ["name_ru","name_en","name_tr"])assert.ok(entry[field],entry.entity_id+" "+field);',
'      else for(const field of ["name_alan_cyrillic","name_alan_turkic"])assert.ok(entry[field],entry.entity_id+" "+field);',
'    });',
'  }',
'});',
'test("release version reaches real imports of router, story, metadata and Service Worker",async()=>{',
'  const version=JSON.parse(await read("release.json")).version;',
'  const [boot,path,sw,router]=await Promise.all(["src/app/bootstrap.js","src/features/path/feature.js","service-worker.js","src/app/router.js"].map(read));',
'  assert.ok(boot.includes("./router.js?v="+version),"router has outdated URL");',
'  assert.ok(path.includes("./story-stele.js?v="+version),"story module has outdated URL");',
'  assert.ok(path.includes("path-set-metadata.js?v="+version),"metadata module has outdated URL");',
'  assert.ok(sw.includes("/src/data/path-set-metadata.js?v="+version),"Service Worker lacks metadata");',
'  assert.ok(sw.includes("/src/features/path/feature.js?v="+version),"Service Worker has outdated feature");',
'  assert.ok(router.includes("const ASSET_VERSION = \\""+version+"\\""));',
'});',
''
].join("\n");
await writeFile("tests/path-bundled-set-metadata-17-2.test.mjs",testText);
console.log("Prepared complete 17.2.2 release source from validated A-B artifact:",report);
