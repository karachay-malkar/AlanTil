import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";

async function update(path,transform) {
  const oldText=await readFile(path,"utf8");
  const newText=transform(oldText);
  assert.notEqual(oldText,newText,"No edit generated: "+path);
  await writeFile(path,newText,"utf8");
  console.log("Prepared "+path+": "+oldText.length+" -> "+newText.length);
}
function replaceExactly(source,before,after,label) {
  const count=source.split(before).length-1;
  assert.equal(count,1,"Expected one "+label+"; got "+count);
  return source.replace(before,after);
}

await update("src/features/onboarding/guide.js",text=>replaceExactly(text,
  ".alantilGuideSparkHost>.beginnerDioramaImage,.alantilGuideSparkHost>.millstoneFace{position:relative;z-index:1}",
  "// The diorama uses two precisely superimposed images; never move them into normal flow.\n.alantilGuideSparkHost>.beginnerDioramaImage{position:absolute;z-index:1}\n.alantilGuideSparkHost>.millstoneFace{position:relative;z-index:1}",
  "guided diorama layering"
));

await update("index.html",text=>replaceExactly(text,
  '  <link rel="icon" type="image/png" href="/assets/icons/ui/path-elbrus-white.png?v=16.8.0.16" />',
  '  <link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/ui/favicon-32.png?v=17.2.5" />\n'+
  '  <link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/ui/favicon-192.png?v=17.2.5" />\n'+
  '  <link rel="icon" type="image/png" sizes="512x512" href="/assets/icons/ui/favicon-512.png?v=17.2.5" />\n'+
  '  <link rel="apple-touch-icon" sizes="192x192" href="/assets/icons/ui/favicon-192.png?v=17.2.5" />',
  "old tab favicon"
));

await update("src/app/bootstrap.js",text=>replaceExactly(text,
  '../features/onboarding/guide.js?v=16.8.0.30',
  '../features/onboarding/guide.js?v=17.2.5',
  "guide import invalidation"
));

await update("service-worker.js",text=>replaceExactly(text,
  '  "/assets/icons/ui/path-elbrus-white.png?v=16.8.0.16"\n];',
  '  "/assets/icons/ui/path-elbrus-white.png?v=16.8.0.16",\n'+
  '  "/assets/icons/ui/favicon-32.png?v=17.2.5",\n'+
  '  "/assets/icons/ui/favicon-192.png?v=17.2.5",\n'+
  '  "/assets/icons/ui/favicon-512.png?v=17.2.5"\n];',
  "core assets favicon"
));

await update("scripts/release/sync-version.mjs",original=>{
  let text=original;
  text=replaceExactly(text,
    '  s=replaceOne(s,/(src="\\/src\\/app\\/bootstrap\\.js\\?v=)[^"]+/,\'$1\'+version,\'index.html\');',
    '  s=replaceOne(s,/(src="\\/src\\/app\\/bootstrap\\.js\\?v=)[^"]+/,\'$1\'+version,\'index.html\');\n'+
    '  for(const size of [32,192,512]){\n'+
    '    const favicon=new RegExp(\'(\\/assets\\/icons\\/ui\\/favicon-\'+size+\'\\\\.png\\\\?v=)[0-9.]+\',\'g\');\n'+
    '    s=s.replace(favicon,\'$1\'+version);\n'+
    '  }',
    "favicon version index sync"
  );
  text=replaceExactly(text,
    '  return replaceOne(s,/(from "\\.\\/router\\.js\\?v=)[0-9.]+/,\'$1\'+version,\'src/app/bootstrap.js\');',
    '  s=replaceOne(s,/(from "\\.\\/router\\.js\\?v=)[0-9.]+/,\'$1\'+version,\'src/app/bootstrap.js\');\n'+
    '  return replaceOne(s,/(onboarding\\/guide\\.js\\?v=)[0-9.]+/,\'$1\'+version,\'src/app/bootstrap.js\');',
    "guide version bootstrap sync"
  );
  text=replaceExactly(text,
    "'/src/features/path/story-stele.js']){",
    "'/src/features/path/story-stele.js','/assets/icons/ui/favicon-32.png','/assets/icons/ui/favicon-192.png','/assets/icons/ui/favicon-512.png']){",
    "favicons in service worker sync"
  );
  return text;
});

await update("scripts/qa/verify-path-metadata-browser.mjs",text=>{
  const needle='  const hydrated = await evaluate(statsExpr);';
  const browserCheck=[
'  // Reproduce the exact guide animation class stack in Chrome (not just CSS inspection).',
'  await until(async () => Boolean(await evaluate(\'document.getElementById("alantil-guided-help-style")\')), "guide stylesheet");',
'  const guideGeometry = await evaluate(`(() => {',
'    const station=document.querySelector(".beginnerDioramaNode");',
'    const frame=station?.querySelector(".beginnerDioramaFrame");',
'    const imgs=frame?[...frame.querySelectorAll(":scope > .beginnerDioramaImage")]:[];',
'    if(imgs.length!==2)return {images:imgs.length};',
'    const priorHeight=station.getBoundingClientRect().height;',
'    const priorLabelY=station.querySelector(".stationLabel")?.getBoundingClientRect().top;',
'    const priorFrameHeight=frame.getBoundingClientRect().height;',
'    document.body.classList.add("alantilGuideProgressDemo");',
'    frame.classList.add("alantilGuideSparkHost");',
'    try {',
'      const a=imgs[0].getBoundingClientRect(),b=imgs[1].getBoundingClientRect();',
'      return { images:imgs.length, positions:imgs.map(i=>getComputedStyle(i).position),',
'        sameX:Math.abs(a.left-b.left)<1,sameY:Math.abs(a.top-b.top)<1,',
'        unchangedHeight:Math.abs(priorHeight-station.getBoundingClientRect().height)<1,',
'        unchangedFrame:Math.abs(priorFrameHeight-frame.getBoundingClientRect().height)<1,',
'        unchangedLabel:Math.abs(priorLabelY-station.querySelector(".stationLabel").getBoundingClientRect().top)<1',
'      };',
'    } finally {',
'      frame.classList.remove("alantilGuideSparkHost");',
'      document.body.classList.remove("alantilGuideProgressDemo");',
'    }',
'  })()`);',
'  assert.deepEqual(guideGeometry.positions, ["absolute","absolute"], "Guide must keep diorama layers absolute");',
'  for(const key of ["sameX","sameY","unchangedHeight","unchangedFrame","unchangedLabel"])',
'    assert.equal(guideGeometry[key],true,"Guide shifted duplicate images or labels: "+key);',
'  console.log("Guide diorama geometry OK:", JSON.stringify(guideGeometry));',
'  const hydrated = await evaluate(statsExpr);'
  ].join("\n");
  return replaceExactly(text,needle,browserCheck,"browser guide geometry");
});

const tests=String.raw`import test from "node:test";
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
`;
await writeFile("tests/guide-favicon-17-2-5.test.mjs",tests,"utf8");
console.log("Prepared standalone regression suite.");

const config=JSON.parse(await readFile("release.json","utf8"));
assert.equal(config.branch,"17.2");
assert.equal(config.version,"17.2.4");
assert.equal(config.android_version_code,47);
config.version="17.2.5";
config.android_version_code=48;
await writeFile("release.json",JSON.stringify(config,null,2)+"\n","utf8");
console.log("Prepared 17.2.5 release metadata.");
