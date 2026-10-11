import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMasonry, MASONRY_VERSION} from '../packages/tower-game/masonry.mjs';
const b = (id,x,y,z,sx=1,sy=1,sz=1,type='stone',rotation=0)=>({id,x,y,z,sx,sy,sz,type,rotation});

test('masonry is deterministic, order independent and does not mutate saved elements',()=>{
 const blocks=[b('a',0,0,0,2,2,2),b('b',2,0,0,2,2,2),b('c',0,2,0,2,2,2)];
 const before=JSON.stringify(blocks);const first=generateMasonry(blocks);
 assert.ok(first.length>0);assert.equal(JSON.stringify(blocks),before);
 assert.deepEqual(generateMasonry([...blocks].reverse()),first);
 assert.equal(MASONRY_VERSION,1);
});
test('isolated, diagonal and non-stone joints never produce decorative stones',()=>{
 assert.deepEqual(generateMasonry([b('a',0,0,0)]),[]);
 assert.deepEqual(generateMasonry([b('a',0,0,0),b('b',1,1,0)]),[]);
 assert.deepEqual(generateMasonry([b('a',0,0,0),b('w',1,0,0,1,1,1,'window')]),[]);
});
test('infill does not cross declared door/window openings or exceed budget',()=>{
 const blocks=[b('a',0,0,0,2,4,2),b('c',2,0,0,2,4,2)];
 const original=generateMasonry(blocks);
 assert.ok(original.length>0);
 const opening=b('window',1,0,0,2,4,2,'window');
 assert.deepEqual(generateMasonry([...blocks,opening]),[]);
 assert.ok(generateMasonry(blocks,{maxStones:3}).length<=3);
 assert.deepEqual(generateMasonry(blocks,{maxStones:0}),[]);
});
test('cutaway filters stones by height and rotated blocks use actual bounding boxes',()=>{
 const blocks=[b('a',0,3,0,2,2,1),b('b',2,3,0,2,2,1)];
 assert.ok(generateMasonry(blocks).length>0);
 assert.deepEqual(generateMasonry(blocks,{layer:0}),[]);
 const rotated=[b('x',0,0,0,3,2,1,'long',1),b('y',1,0,0,3,2,1,'long',1)];
 assert.ok(generateMasonry(rotated).length>0);
});