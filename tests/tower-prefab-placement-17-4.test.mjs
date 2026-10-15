import test from 'node:test';import assert from 'node:assert/strict';
import {PREFAB_TYPES,validatePrefabPlacement,prefabBounds,positionAgainst,touchingPrefabPairs,worldToGrid,gridToWorld,snapPrefabPosition,hasPrefabSupport} from '../packages/tower-game/prefab-layout.mjs';
const make=(id,x=0,y=0,z=0,sectionId='2x2x2')=>({id,type:'masonry_section',sectionId,x,y,z,rotation:0,variant:0});
test('five catalog sizes, integer 25cm placement and all quarter turns',()=>{
 assert.equal(PREFAB_TYPES.length,6);
 for(const t of PREFAB_TYPES)for(let rotation=0;rotation<4;rotation++){
  const dims=prefabBounds({...make('a',0,0,0,t.id),rotation}).size;
  assert.deepEqual(dims,rotation%2?[t.size[2],t.size[1],t.size[0]]:t.size);
 }
 assert.equal(worldToGrid(.36),1);assert.equal(gridToWorld(4),1);
 assert.deepEqual(snapPrefabPosition({x:3.7,y:2.2,z:0.4}),{x:4,y:2,z:0});
 assert.equal(validatePrefabPlacement([],{...make('fractional'),x:.25}).ok,false);
});
test('placement uses clicked grid cell on the chosen face, not neighbouring center magnet',()=>{
 const a=make('a');const b=make('b');
 const hit={block:a,normal:{x:1,y:0,z:0},position:[.5,.12,.27]};
 const out=positionAgainst(b,hit);
 assert.deepEqual([out.x,out.y,out.z],[2,0,0]);
 assert.deepEqual(validatePrefabPlacement([a],out),{ok:true,reason:''});
 assert.equal(touchingPrefabPairs([a,out])[0].axis,'x');
 assert.equal(a.x,0);
 assert.equal(validatePrefabPlacement([a],make('no',1,0,0)).ok,false);
});
test('upper section requires 100% support including joins between several foundation stones',()=>{
 const upper=make('upper',0,2,0);
 assert.equal(validatePrefabPlacement([make('base')],upper).ok,true);
 assert.equal(validatePrefabPlacement([],upper).ok,false);
 assert.equal(hasPrefabSupport([make('half',0,0,0,'1x1x1')],make('upper',0,1,0)),false);
 assert.equal(validatePrefabPlacement([make('left',0,0,0,'1x1x1'),make('right',1,0,0,'1x1x1')],make('top',0,1,0)).ok,false);
 const four=[make('a',0,0,0,'1x1x1'),make('b',1,0,0,'1x1x1'),make('c',0,0,1,'1x1x1'),make('d',1,0,1,'1x1x1')];
 assert.equal(validatePrefabPlacement(four,make('top',0,1,0)).ok,true);
 assert.equal(touchingPrefabPairs([make('a'),upper])[0].axis,'y');
});
test('reject malformed and nonexistent objects and prevent out-of-bounds',()=>{
 assert.equal(validatePrefabPlacement([],{...make('a'),sectionId:'unknown'}).ok,false);
 assert.equal(validatePrefabPlacement([],{...make('a'),x:-1}).ok,false);
 assert.equal(validatePrefabPlacement([],{...make('a'),variant:99}).ok,false);
 assert.equal(validatePrefabPlacement([],{...make('a'),rotation:4}).ok,false);
});