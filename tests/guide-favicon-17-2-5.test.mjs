import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=(path)=>readFile(new URL("../"+path,import.meta.url));
test("guide spark animation preserves overlapping diorama image positioning",async()=>{
  const guide=(await read("src/features/onboarding/guide.js")).toString();
  const path=(await read("src/features/path/path.css")).toString();
  assert.match(guide,/\.alantilGuideSparkHost>\.beginnerDioramaImage\{position:absolute;z-index:1\}/);
  assert.match(guide,/\.alantilGuideSparkHost>\.millstoneFace\{position:relative;z-index:1\}/);
  assert.doesNotMatch(guide,/\.alantilGuideSparkHost>\.beginnerDioramaImage,\.alantilGuideSparkHost>\.millstoneFace\{position:relative/);
  assert.match(path,/\.beginnerDioramaImage\{position:absolute/);
});
test("browser favicon sizes, version keys, original icon and Service Worker",async()=>{
  const html=(await read("index.html")).toString();
  const sw=(await read("service-worker.js")).toString();
  const boot=(await read("src/app/bootstrap.js")).toString();
  const release=JSON.parse((await read("release.json")).toString());
  assert.equal(release.version,"17.2.5");
  for(const size of [32,192,512]){
    const filename="assets/icons/ui/favicon-"+size+".png";
    const img=await read(filename);
    assert.equal(img.subarray(0,8).toString("hex"),"89504e470d0a1a0a",filename+" PNG signature");
    assert.equal(img.readUInt32BE(16),size,filename+" width");
    assert.equal(img.readUInt32BE(20),size,filename+" height");
    assert.ok(img.length<100000,filename+" must be lightweight");
    assert.ok(html.includes('sizes="'+size+'x'+size+'" href="/'+filename+'?v=17.2.5"'));
    assert.ok(sw.includes('"/'+filename+'?v=17.2.5"'));
  }
  assert.match(boot,/onboarding\/guide\.js\?v=17\.2\.5/);
  assert.ok((await read("assets/icons/ui/path-elbrus-white.png")).length>4000,"Original path nav icon remains untouched");
});
