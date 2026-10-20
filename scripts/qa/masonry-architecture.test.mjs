/** Gate/architecture editor regression checks; run with Node 22. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGateWings,WING_WIDTH,WING_HEIGHT,WING_DEPTH} from '../../src/features/masonry/gate-wings.mjs';

const source=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const pure=code=>new Function(code.replace(/^import .+?;\s*$/gm,'').replace(/^export /gm,'')+
 ';return {makeRecipe,validateRecipe,RECIPE_VERSION,LEGACY_RECIPE_VERSION};')();
const {makeRecipe,validateRecipe,RECIPE_VERSION,LEGACY_RECIPE_VERSION}=pure(source('src/features/masonry/library.js'));
const manifest=JSON.parse(source('assets/tower/prefabs/common100/common-100.json'));
const transform=()=>({position:[0,0,0],quaternion:[0,0,0,1],scale:[1,1,1]});
function recipe(){const r=makeRecipe([24,10,2]);r.libraryVersion=manifest.version;r.librarySha256=manifest.glbSHA256;return r;}

test('new format saves the original gate plus editable named parts',()=>{
 const r=recipe();
 r.architectures.push({id:'gate-1',asset:'gate',...transform(),parts:{'2':{...transform(),position:[.1,.2,.3]}},hiddenParts:[17]});
 assert.equal(validateRecipe(r,manifest),r);
 assert.equal(JSON.parse(JSON.stringify(r)).architectures[0].parts[2].position[0],.1);
 assert.equal(r.version,RECIPE_VERSION);
});
test('legacy stone-only recipes remain unchanged and valid',()=>{
 const r=recipe();r.version=LEGACY_RECIPE_VERSION;delete r.architectures;
 r.stones.push({id:'rock-1',name:manifest.models[0].name,...transform()});
 const before=JSON.stringify(r);
 assert.equal(validateRecipe(r,manifest),r);
 assert.equal(JSON.stringify(r),before);
});
test('mixed recipe blocks unknown asset, duplicated ID and corrupt part transform',()=>{
 const r=recipe();r.architectures.push({id:'a',asset:'gate',...transform(),parts:{}});
 r.architectures[0].asset='untrusted';assert.throws(()=>validateRecipe(r,manifest),/архитектурный/);
 r.architectures[0].asset='gate';r.architectures.push({id:'a',asset:'door',...transform()});
 assert.throws(()=>validateRecipe(r,manifest),/ID/);r.architectures.pop();
 r.architectures[0].parts['4']={...transform(),scale:[0,1,1]};
 assert.throws(()=>validateRecipe(r,manifest),/детали/);
 r.architectures[0].parts={};r.architectures[0].hiddenParts=[1,1];
 assert.throws(()=>validateRecipe(r,manifest),/деталей/);
});
test('all architectural variants reference existing original repo GLB files',()=>{
 const assets=source('src/features/masonry/architecture-assets.js');
 for(const name of ['gate-18x10x2-v7.glb','door-7x9x2-stone-v1.glb','door-wood-v1.glb','window-4x5x2-v2.glb','window-wood-v3.glb','timber-parts.glb']){
  assert.match(assets,new RegExp(name.replaceAll('.','\\.')));
 }
 assert.match(assets,/applyGateSurfaces/);
 assert.match(assets,/applyRockSurface/);
});
test('gate wings use true Common 100 main meshes, sit outside opening, and bear on courses',()=>{
 const sizeFor=name=>manifest.models.find(m=>m.name===name)?.sizeMeters;
 const result=buildGateWings({manifest,dimensionsFor:sizeFor,gateWidth:4.5});
 assert.equal(result.stones.length,80);
 assert.equal(result.fullWidth,4.5+2*WING_WIDTH);
 const sides={left:0,right:0};
 for(const rock of result.stones){
  assert.ok(manifest.models.some(m=>m.name===rock.name&&m.category==='main'));
  const d=sizeFor(rock.name).map((v,i)=>v*rock.scale[i]);
  const [x,y,z]=rock.position;
  assert.ok(Math.abs(x)-d[0]/2>=2.25-1e-4,'stone must not reach existing gate');
  assert.ok(y-d[1]/2>=-1e-4&&y+d[1]/2<=WING_HEIGHT+1e-4);
  assert.ok(Math.abs(z)+d[2]/2<=WING_DEPTH/2+1e-4);
  if(x<0)sides.left++;else sides.right++;
 }
 assert.deepEqual(sides,{left:40,right:40});
 assert.throws(()=>buildGateWings({manifest,dimensionsFor:sizeFor,gateWidth:4.5,existing:result.stones}),/уже добавлена/);
});
test('scene supports part selection, transforms and persisting disabled parts',()=>{
 const scene=source('src/features/masonry/scene.js');
 const editor=source('src/features/masonry/index.js');
 for(const token of ['ensureAssets','setPartMode','getTransform','masonryPart','getSelectionName','hiddenParts']){
  assert.ok(scene.includes(token)||editor.includes(token),token);
 }
 for(const token of ["case 'parts'","case 'parent'","case 'gate-template'","case 'wings'","data-add-architecture","await setRecipe"]){
  assert.ok(editor.includes(token),token);
 }
 assert.match(editor,/state\.scene\.cameraFitOnStones\(cells\)/);
 assert.match(editor,/buildGateWings/);
});
