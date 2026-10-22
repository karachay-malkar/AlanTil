import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');
const release=JSON.parse(await read('release.json'));

test('Path home does not load study/result/test JS before a session',async()=>{
 const source=await read('src/features/path/feature.js');
 assert.doesNotMatch(source,/^import .*from "\.\.\/learn\/study\.js/m);
 assert.doesNotMatch(source,/^import .*from "\.\.\/learn\/results\.js/m);
 assert.doesNotMatch(source,/^import .*from "\.\/station-test\.js/m);
 assert.match(source,/function loadStudyDependencies/);
 assert.match(source,/function loadTestDependencies/);
 assert.match(source,/await loadStudyDependencies\(\)/);
 assert.match(source,/await loadTestDependencies\(\)/);
 assert.match(source,/studyDependencies\?\.finalizeLearnSession/);
 assert.match(source,/if\(controller\.signal\.aborted\)return/);
});

test('Approved stele keeps original artwork but transfers a lightweight responsive derivative',async()=>{
 const source=await read('src/features/path/story-stele.js');
 assert.ok(source.includes('story-stele-640.webp?v='+release.version));
 assert.ok(source.includes('story-stele-932.webp?v='+release.version));
 assert.match(source,/artwork\.srcset=artwork\.dataset\.srcset/);
 const [original,mobile,full]=await Promise.all(
  ['assets/path/story-stele.webp','assets/path/story-stele-640.webp','assets/path/story-stele-932.webp'].map(p=>stat(new URL('../'+p,import.meta.url))));
 assert.ok(original.size>2_000_000);
 assert.ok(mobile.size<=500*1024);
 assert.ok(full.size<original.size);
});

test('Only the route map uses compact path data; stations and tests load complete words',async()=>{
 const source=await read('src/features/path/feature.js');
 const repo=await read('src/shared/data/word-repository.js');
 const index=JSON.parse(await read('src/data/path-route-index.json'));
 const snapshot=JSON.parse(await read('src/data/dictionary-snapshot.json'));
 const worker=await read('service-worker.js');
 assert.equal(index.version,snapshot.version);
 assert.equal(index.word_count,snapshot.words.length);
 assert.equal(index.words.length,snapshot.words.length);
 assert.match(source,/screen==="home"\?getHomeRouteWords\((?:controller\.signal|signal)\):getCompleteDictionaryWords/);
 assert.match(source,/getPersistedDictionaryVersion\(\)/);
 assert.match(source,/getDisplayedWordCollection\(index\.words\)/);
 assert.match(repo,/export function getPersistedDictionaryVersion/);
 assert.match(worker,/src\/data\/path-route-index\.json/);
 assert.match(worker,/src\/data\/dictionary-snapshot\.json/);
 assert.match(worker,/versionedCode \? cacheFirst\(request\) : networkFirst\(request/);
 const ids=new Set(index.words.map(row=>String(row.id)));
 assert.equal(ids.size,index.words.length);
});

test('Path route index transfers as a compact gzip, with uncompressed fallback',async()=>{
 const source=await read('src/features/path/feature.js');
 const worker=await read('service-worker.js');
 const compressed=await readFile(new URL('../src/data/path-route-index.json.gz',import.meta.url));
 const raw=await read('src/data/path-route-index.json');
 assert.ok(compressed.byteLength<100*1024,'compressed route index too large');
 assert.equal(gunzipSync(compressed).toString('utf8'),raw);
 assert.ok(source.includes('path-route-index.json.gz?v='+release.version));
 assert.match(source,/PATH_ROUTE_INDEX_FALLBACK_URL/);
 assert.match(source,/DecompressionStream/);
 assert.match(worker,/path-route-index\.json\.gz/);
});
