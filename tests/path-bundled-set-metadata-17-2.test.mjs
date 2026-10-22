import test from "node:test";
import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {readFile} from "node:fs/promises";
import {BEGINNER_SET_METADATA,INTERMEDIATE_SET_METADATA} from "../src/data/path-set-metadata.js";
const read=path=>readFile(new URL("../"+path,import.meta.url),"utf8");
test("bundled metadata lists all 56 public images and localized names",()=>{
  assert.equal(BEGINNER_SET_METADATA.length,30);
  assert.equal(INTERMEDIATE_SET_METADATA.length,26);
  for(const [type,rows] of [["beginner",BEGINNER_SET_METADATA],["intermediate",INTERMEDIATE_SET_METADATA]]){
    rows.forEach((entry,index)=>{
      assert.equal(entry.entity_id,type+"-"+String(index+1).padStart(2,"0"));
      assert.match(entry.icon_name,/^(0[1-9]|[12]\d|30)_[a-z0-9_]+\.webp$/);
      assert.ok(existsSync(new URL("../assets/icons/sets/"+entry.icon_name,import.meta.url)),entry.icon_name);
      if(type==="beginner")for(const field of ["name_ru","name_en","name_tr"])assert.ok(entry[field],entry.entity_id+" "+field);
      else for(const field of ["name_alan_cyrillic","name_alan_turkic"])assert.ok(entry[field],entry.entity_id+" "+field);
    });
  }
});
test("release version reaches real imports of router, story, metadata and Service Worker",async()=>{
  const version=JSON.parse(await read("release.json")).version;
  const [boot,path,sw,router]=await Promise.all(["src/app/bootstrap.js","src/features/path/feature.js","service-worker.js","src/app/router.js"].map(read));
  assert.ok(boot.includes("./router.js?v="+version),"router has outdated URL");
  assert.ok(path.includes("./story-stele.js?v="+version),"story module has outdated URL");
  assert.ok(path.includes("path-set-metadata.js?v="+version),"metadata module has outdated URL");
  assert.ok(sw.includes("/src/data/path-set-metadata.js?v="+version),"Service Worker lacks metadata");
  assert.ok(sw.includes("/src/features/path/feature.js?v="+version),"Service Worker has outdated feature");
  assert.ok(router.includes("const ASSET_VERSION = \""+version+"\""));
});
