/** Manual Common100 staging and compact mobile editor regression tests.
 * Run: node --test scripts/qa/manual-masonry-stage.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {worldHalfExtents,stagingPosition,STAGING_CLEARANCE,STAGING_GAP} from '../../src/features/masonry/staging-position.mjs';

const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const dimensions={a:[.32,.24,.4],b:[.5,.16,.21],c:[.19,.18,.24]};
const getSize=name=>dimensions[name];
const aStone=(name,position,quaternion=[0,0,0,1],scale=[1,1,1])=>({name,position,quaternion,scale});
const intersects=(a,b,gap=0)=>{
 const ah=worldHalfExtents(getSize(a.name),a.quaternion,a.scale);
 const bh=worldHalfExtents(getSize(b.name),b.quaternion,b.scale);
 return [0,1,2].every(i=>Math.abs(a.position[i]-b.position[i])<ah[i]+bh[i]+gap-1e-5);
};
test('rotated bounding boxes account for real GLB dimensions and transforms',()=>{
 assert.deepEqual(worldHalfExtents([.5,.2,.3]),[.25,.1,.15]);
 const rotation=[0,Math.SQRT1_2,0,Math.SQRT1_2];
 const half=worldHalfExtents([.5,.2,.3],rotation,[1,2,1]);
 assert.ok(Math.abs(half[0]-.15)<1e-7);
 assert.ok(Math.abs(half[1]-.2)<1e-7);
 assert.ok(Math.abs(half[2]-.25)<1e-7);
});
test('new stones are always >10 cm outside the correct cube face',()=>{
 for(const cells of [[1,1,1],[2,2,2],[2,2,3],[3,3,3],[2,3,4],[4,4,4],[1,8,2]]){
  for(const name of ['a','b','c']){
   const position=stagingPosition({cells,dimensions:getSize(name),stones:[],dimensionsFor:getSize});
   const half=worldHalfExtents(getSize(name));
   assert.ok(position[0]-half[0] - cells[0]*.25*.5 >= .1,JSON.stringify({cells,name,position}));
   assert.ok(Math.abs(position[1]-half[1])<1e-6);
   assert.equal(position[2],0);
  }
 }
 assert.ok(STAGING_CLEARANCE>.1);
});
test('staging lane prevents intersections between sequential stones',()=>{
 const stones=[];
 for(let i=0;i<100;i++){
  const name=['a','b','c'][i%3];
  const position=stagingPosition({cells:[3,3,3],dimensions:getSize(name),stones,dimensionsFor:getSize});
  const next=aStone(name,position);
  for(const old of stones)assert.equal(intersects(old,next,.001),false);
  stones.push(next);
 }
 assert.equal(stones.length,100);
 assert.ok(stones.every(s=>Number.isFinite(s.position[2])));
 assert.ok(STAGING_GAP>.02);
});
test('duplicate respects the selected stone scale and rotation',()=>{
 const q=[0,Math.SQRT1_2,0,Math.SQRT1_2],scale=[1.7,.8,1.25];
 const original=aStone('b',[-.05,.27,.12],q,scale);
 const other=aStone('a',[.5,.12,0]);
 const pos=stagingPosition({cells:[2,2,2],dimensions:getSize('b'),stones:[original,other],dimensionsFor:getSize,quaternion:q,scale});
 const dupe=aStone('b',pos,q,scale);
 assert.ok(pos[0]-worldHalfExtents(getSize('b'),q,scale)[0]>.25+.1);
 assert.equal(intersects(dupe,other),false);
 assert.equal(intersects(dupe,original),false);
});
test('existing hand-built stones keep coordinates and are not rewritten on staging',()=>{
 const stones=[aStone('a',[-.119873,.175477,.079163]),aStone('b',[.92,.234,.004],[0,0,0,1],[1.3,.8,1])];
 const original=JSON.stringify(stones);
 const next=stagingPosition({cells:[3,3,3],dimensions:getSize('c'),stones,dimensionsFor:getSize});
 assert.deepEqual(JSON.stringify(stones),original);
 assert.ok(next[0]>.375);
 assert.equal(stones.length,2);
});
test('top panel contains editing actions; lower panel remains compact; no search',()=>{
 const editor=source('src/features/masonry/index.js');
 const markup=editor.slice(editor.indexOf('root.innerHTML=`'),editor.indexOf('const $=sel=>root.querySelector(sel);'));
 const top=markup.split('<div class="masonryTop">')[1].split('<div class="masonryFloating">')[0];
 const bottom=markup.split('<div class="masonryEditorPanel">')[1];
 for(const action of ['undo','redo','export','save','ready','camera','bounds']){
  assert.match(top,new RegExp('data-action="'+action+'"'));
  assert.doesNotMatch(bottom,new RegExp('data-action="'+action+'"'));
 }
 for(const action of ['duplicate','delete','catalog'])assert.match(bottom,new RegExp('data-action="'+action+'"'));
 assert.doesNotMatch(editor,/data-search|state\.search|data-page-count/);
 assert.match(editor,/masonryStoneControls/);
 assert.match(editor,/stagedPosition\(cloned\.name,cloned\.quaternion,cloned\.scale\)/);
 assert.match(editor,/cameraFitOnStones\(state\.recipe\.cells\)/);
});
test('scene camera fits wide staging and original saved recipe path is intact',()=>{
 const scene=source('src/features/masonry/scene.js');
 const editor=source('src/features/masonry/index.js');
 const css=source('src/features/masonry/masonry.css');
 assert.match(scene,/const halfHorizontal=Math\.atan\(Math\.tan\(halfVertical\)\*camera\.aspect\)/);
 assert.match(scene,/new THREE\.Vector3\(-width\/2,0,-depth\/2\)/);
 assert.match(editor,/state\.recipe=copy\(recipe\)/);
 assert.match(editor,/validateRecipe\(recipe,state\.library\.manifest\)/);
 assert.match(css,/\.masonryTopActions/);
 assert.match(css,/\.masonryToolsToggle/);
 assert.doesNotMatch(css,/\.masonryCatalogTools/);
});
