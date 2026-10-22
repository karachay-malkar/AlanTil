import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const read = path => readFile(new URL('../'+path,import.meta.url),'utf8');

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
 assert.match(source,/story-stele-640\.webp\?v=17\.2\.1/);
 assert.match(source,/story-stele-932\.webp\?v=17\.2\.1/);
 assert.match(source,/artwork\.srcset=artwork\.dataset\.srcset/);
 const [original,mobile,full]=await Promise.all(
  ['assets/path/story-stele.webp','assets/path/story-stele-640.webp','assets/path/story-stele-932.webp'].map(p=>stat(new URL('../'+p,import.meta.url))));
 assert.ok(original.size>2_000_000);
 assert.ok(mobile.size<=500*1024);
 assert.ok(full.size<original.size);
});
