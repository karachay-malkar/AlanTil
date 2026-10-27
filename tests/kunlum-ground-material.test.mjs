import test from 'node:test';
import assert from 'node:assert/strict';
import {createKunlumNativeTerrainPBR} from '../src/features/tower/kunlum-game-landscape.js';

class DataTexture {
 constructor(data,width,height){this.image={data,width,height};}
 dispose(){this.disposed=true;}
}
class MeshStandardMaterial{
 constructor(options){Object.assign(this,options);}
 dispose(){this.disposed=true;}
}
class Vector2{constructor(x,y){this.x=x;this.y=y;}}
const THREE={DataTexture,MeshStandardMaterial,Vector2,RGBAFormat:1,
 RepeatWrapping:2,LinearMipmapLinearFilter:3,LinearFilter:4,SRGBColorSpace:5,DoubleSide:6};

test('native mobile terrain uses metre-scale diffuse and bump detail at modest map cost',()=>{
 const pbr=createKunlumNativeTerrainPBR(THREE,{mobile:true});
 assert.ok(pbr.texScale>=.2&&pbr.texScale<=.35,'ground pattern should repeat every 3–5m, not every 10m');
 assert.ok(pbr.material.normalScale.x>=.45,'surface bump should be visible close to the camera');
 assert.equal(pbr.material.map.image.width,128,'keep the mobile texture budget');
 assert.equal(pbr.material.normalMap.image.width,128);
 const albedo=pbr.material.map.image.data;
 const values=[];for(let i=0;i<albedo.length;i+=4)values.push(albedo[i]);
 assert.ok(Math.max(...values)-Math.min(...values)>25,'soil grain should have sufficient variation');
 pbr.dispose();assert.equal(pbr.material.disposed,true);
});
test('desktop reuses the same terrain system with a higher-detail texture budget',()=>{
 const pbr=createKunlumNativeTerrainPBR(THREE,{mobile:false});
 assert.equal(pbr.material.map.image.width,256);
 assert.ok(pbr.material.normalScale.x>=.45);
 for(const [x,z] of [[0,0],[15,35],[60,-20]]){
  const rgb=pbr.terrainColor(1600,.35,x,z);
  assert.ok(rgb.every(v=>v>=0&&v<=1&&Number.isFinite(v)));
 }
 pbr.dispose();
});
