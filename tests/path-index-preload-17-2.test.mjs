import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Path-only preload starts gzip index early without preloading it on practice or profile',async()=>{
 const index=await read('index.html');
 assert.match(index,/location\.pathname === "\/"/);
 assert.match(index,/location\.pathname\.startsWith\("\/path\/"\)/);
 assert.match(index,/indexPreload\.rel = "preload"/);
 assert.match(index,/indexPreload\.as = "fetch"/);
 assert.match(index,/indexPreload\.href = "\/src\/data\/path-route-index\.json\.gz\?v=" \+ targetVersion/);
 const sw=await read('service-worker.js');
 assert.match(sw,/src\/data\/path-route-index\.json\.gz/);
});
