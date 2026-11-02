import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three/three.module.js';
import {makeKunlumRuinShell} from '../src/features/tower/kunlum-ruin-shell.js';
import {layoutKunlumRuinStones} from '../src/features/tower/kunlum-ruin-layout.js';

test('distant ruin shell combines stone faces while keeping jagged crown and zero solid core',()=>{
 const segments=[{a:[0,0],b:[12,0],width:.5,height:1.6,heightAt:()=>0}];
 const geometry=makeKunlumRuinShell(THREE,segments);
 assert.ok(geometry);
 const a=geometry.getAttribute('position');
 assert.ok(a.count>0&&a.count%3===0);
 assert.ok(a.count<2200,'combined shell must be considerably smaller than individual rocky volumes');
 const ys=[];for(let i=0;i<a.count;i++)ys.push(a.getY(i));
 assert.ok(Math.max(...ys)-Math.min(...ys)>1);
 assert.ok(new Set(ys.map(x=>x.toFixed(2))).size>10,'broken top and stone faces must remain irregular');
 assert.ok(geometry.getAttribute('uv'),'PBR surface UVs must exist');
 geometry.dispose();
});

test('shell generator preserves empty openings rather than sealing them',()=>{
 const separate=[{a:[0,0],b:[3,0],width:.5,height:1.6,heightAt:()=>0},
 {a:[5,0],b:[8,0],width:.5,height:1.6,heightAt:()=>0}];
 const g=makeKunlumRuinShell(THREE,separate);
 const p=g.getAttribute('position');
 for(let i=0;i<p.count;i++)assert.ok(p.getX(i)<3.4||p.getX(i)>4.6,'no triangles across doorway');
 g.dispose();
});

test('merged distant masonry preserves actual highest broken stone crown',()=>{
 const seg={a:[0,0],b:[12,0],width:.5,height:1.6,heightAt:()=>0};
 const highest=Math.max(...layoutKunlumRuinStones(seg).map(v=>v.y+v.height*.5));
 const g=makeKunlumRuinShell(THREE,[seg]);
 const p=g.getAttribute('position');
 const apex=Math.max(...Array.from({length:p.count},(_,i)=>p.getY(i)));
 assert.ok(apex>=highest-.01,'far geometry retains real peaks rather than smoothing to flat cap');
 g.dispose();
});
