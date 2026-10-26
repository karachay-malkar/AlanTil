import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {createKunlumMapOverlay} from '../src/features/tower/kunlum-map-overlay.js';
import {kunlumRuinCrown,kunlumRuinFoot,createKunlumWallFootings}
 from '../src/features/tower/kunlum-wall-ground.js';

test('historic wall crowns vary by place with bounded broken-top erosion',()=>{
 const values=Array.from({length:30},(_,i)=>kunlumRuinCrown(1.6,i*.37,6.4));
 assert.ok(new Set(values.map(x=>x.toFixed(3))).size>17);
 assert.ok(values.every(h=>h>=1.23&&h<1.6));
 assert.equal(kunlumRuinCrown(1.6,2,4),kunlumRuinCrown(1.6,2,4));
 assert.throws(()=>kunlumRuinCrown(1.6,NaN,0));
});
test('foundation sits below all local terrain contacts on a slope',()=>{
 const terrain=(x,z)=>x*.42+z*.07;
 const foot=kunlumRuinFoot(2,4,.5,terrain,[1,0]);
 const contacts=[[2,4],[2+.5*.58,4],[2-.5*.58,4],[2,4+.30],[2,4-.30]];
 for(const [x,z] of contacts)assert.ok(foot<=terrain(x,z)-.17);
 assert.ok(foot<terrain(2,4));
});
test('wall footings generate 3D fragments and earth strips only along uncut intervals',()=>{
 const segments=[
  {a:[-4,0],b:[-.7,0],width:.5},
  {a:[.7,0],b:[4,0],width:.5}
 ];
 const terrain=(x,z)=>.12*x+.03*z;
 const view=createKunlumWallFootings(THREE,segments,terrain,{mobile:true});
 assert.ok(view.counts.stones>0);
 assert.ok(view.counts.soilTriangles>0);
 const fragment=view.root.children.find(x=>x.isInstancedMesh);
 assert.ok(fragment);
 assert.ok(fragment.count<=1300);
 const matrix=new THREE.Matrix4();
 for(let i=0;i<fragment.count;i++){
  fragment.getMatrixAt(i,matrix);
  const x=matrix.elements[12];
  assert.ok(x<-.5||x>.5,'fallen stones must not bridge the doorway gap');
 }
 view.dispose();
});
test('ground contacts share one profile for rubble-core and both facing LODs',()=>{
 const map=createKunlumMapOverlay(THREE,{
  confirmed_features:[{id:'1',type:'wall',origin:'manual',points:[[0,0],[3,0]]}],
  auto_candidates:[]
 },{toWorld:p=>p,heightAt:(x,z)=>.25*x+.02*z});
 const footing=map.root.children.find(x=>x.name==='Kunlum wall embedded sediment and fallen stones');
 assert.ok(footing,'every mapped wall uses the same embedded footings');
 const body=map.confirmed.children.find(x=>x.isMesh);
 assert.ok(body);
 const ys=body.geometry.getAttribute('position');
 let min=Infinity;for(let i=0;i<ys.count;i++)min=Math.min(min,ys.getY(i));
 assert.ok(min<-.14,'wall core must be embedded, not hovering above the terrain');
 map.dispose();
});
