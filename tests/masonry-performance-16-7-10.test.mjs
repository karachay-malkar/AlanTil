import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Common100 is loaded and normalized once per SPA session, retryable on failure',async()=>{
 const source=await read('src/features/masonry/library.js');
 assert.match(source,/let common100Promise=null/);
 assert.match(source,/common100Promise=readCommon100\(\)\.catch/);
 assert.match(source,/common100Promise=null;throw error/);
 assert.match(source,/signal\.removeEventListener\('abort',onAbort\)/);
 assert.doesNotMatch(source,/fetch\(MANIFEST_URL,\{signal/);
});

test('3D scene renders when changed and skips hidden or unchanged frames',async()=>{
 const source=await read('src/features/masonry/scene.js');
 assert.match(source,/controls\.addEventListener\('change',invalidate\)/);
 assert.match(source,/if\(disposed\|\|document\.hidden\)return/);
 assert.match(source,/if\(needsRender\)/);
 assert.match(source,/document\.removeEventListener\('visibilitychange',onVisibilityChange\)/);
});

test('Stone thumbnails generate lazily and stop when editor closes',async()=>{
 const source=await read('src/features/masonry/index.js');
 assert.match(source,/IntersectionObserver/);
 assert.match(source,/queueThumbnail\(entry\.target,generation\)/);
 assert.match(source,/if\(!state\.disposed&&generation===thumbnailGeneration&&img\.isConnected\)/);
 assert.match(source,/state\.thumbnailObserver\?\.disconnect\(\)/);
});
