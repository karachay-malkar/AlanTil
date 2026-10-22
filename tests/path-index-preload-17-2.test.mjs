import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('No speculative path preloading on guest onboarding or unrelated features',async()=>{
 const index=await read('index.html');
 const source=await read('src/features/path/feature.js');
 const worker=await read('service-worker.js');
 assert.doesNotMatch(index,/indexPreload|rel="preload"[^>]*path-route-index/);
 assert.match(source,/PATH_ROUTE_INDEX_URL = "\/src\/data\/path-route-index\.json\.gz\?v=/);
 assert.match(worker,/path-route-index\.json\.gz/);
});
