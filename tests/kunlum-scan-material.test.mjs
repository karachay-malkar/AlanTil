import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createKunlumNativeTerrainPBR} from '../src/features/tower/kunlum-game-landscape.js';

const root=new URL('../assets/tower/materials/kunlum-landscape/',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
test('scan-derived maps are real Poly Haven CC0 assets and obey transfer budget',()=>{
 assert.equal(manifest.license,'CC0 1.0');
 assert.deepEqual(Object.keys(manifest.materials).sort(),['grass','rock','soil']);
 assert.equal(manifest.resolution,512);
 for(const [name,asset] of Object.entries(manifest.files)){
  const data=readFileSync(new URL(name,root));
  assert.equal(data.toString('ascii',0,4),'RIFF');
  assert.equal(data.toString('ascii',8,12),'WEBP');
  assert.equal(data.byteLength,asset.bytes);
  assert.equal(createHash('sha256').update(data).digest('hex'),asset.sha256);
  assert.ok(data.byteLength<600000,'image budget '+name);
 }
});
class DataTexture{
 constructor(data,width,height){this.image={data,width,height};}
 dispose(){this.disposed=true}
}
class Material{
 constructor(config){Object.assign(this,config)}
 dispose(){this.disposed=true}
}
class Vector2{constructor(x,y){this.x=x;this.y=y}}
class Texture{
 constructor(url){this.url=url}
 dispose(){this.disposed=true}
}
function fakeTHREE(fail=false){
 class TextureLoader{
  async loadAsync(url){if(fail)throw Error('asset unavailable');return new Texture(url)}
 }
 return {DataTexture,MeshStandardMaterial:Material,Vector2,TextureLoader,
  RGBAFormat:1,RepeatWrapping:2,LinearMipmapLinearFilter:3,LinearFilter:4,
  SRGBColorSpace:'srgb',NoColorSpace:'linear',DoubleSide:6};
}
test('scan surface replaces only render maps while preserving one material and image fallback',async()=>{
 const pbr=createKunlumNativeTerrainPBR(fakeTHREE(),{mobile:true});
 const sameMaterial=pbr.material,oldMap=pbr.material.map,oldNormal=pbr.material.normalMap;
 const result=await pbr.loadScannedDetail();
 assert.equal(result,true);
 assert.equal(pbr.material,sameMaterial);
 assert.match(pbr.material.map.url,/KunlumScan_Neutral_512\.webp/);
 assert.match(pbr.material.normalMap.url,/KunlumScan_NormalGL_512\.webp/);
 assert.equal(oldMap.disposed,true);
 assert.equal(oldNormal.disposed,true);
 assert.equal(pbr.material.normalMap.colorSpace,'linear');
 pbr.dispose();
 assert.equal(pbr.material.map.disposed,true);
 assert.equal(pbr.material.normalMap.disposed,true);
});
test('texture network failure leaves playable original terrain material intact',async()=>{
 const pbr=createKunlumNativeTerrainPBR(fakeTHREE(true),{mobile:false});
 const fallback=pbr.material.map;
 assert.equal(await pbr.loadScannedDetail(),false);
 assert.equal(pbr.material.map,fallback);
 assert.equal(fallback.disposed,undefined);
 pbr.dispose();
});
