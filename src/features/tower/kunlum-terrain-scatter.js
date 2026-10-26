import {KUNLUM_AUTUMN} from './kunlum-autumn-palette.js';
import {carveKunlumRiverHeight} from './kunlum-river-layer.js';
import {createKunlumVegetation,createKunlumShrubGeometry} from './kunlum-vegetation.js';
/**
 * Deterministic 3D stones, grass tufts and low mountain shrubs for Kunlum.
 * Visual decoration only. These positions are artistic and not mapped vegetation.
 * Avoid confirmed archaeological traces, the tower core and approximate river.
 */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function kunlumRng(seed=214731){let v=seed>>>0;return ()=>{v=(1664525*v+1013904223)>>>0;return v/4294967296}};
export function createKunlumAvoidance(features=[],toWorld=p=>p,{cell=12}={}){
 const blocked=new Set(),key=(x,z)=>Math.floor(x/cell)+','+Math.floor(z/cell);
 const mark=(x,z)=>{blocked.add(key(x,z))};
 for(const f of features){
  if(!['wall','house','retaining','passage'].includes(f.type)||!Array.isArray(f.points))continue;
  const p=f.points.map(toWorld);
  if(f.type==='house'&&p.length>=3)p.push(p[0]);
  for(let i=1;i<p.length;i++){
   const a=p[i-1],b=p[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
   const n=Math.max(1,Math.ceil(length/(cell*.35)));
   for(let k=0;k<=n;k++){const t=k/n;mark(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t)}
  }
 }
 return (x,z)=>{
  const ix=Math.floor(x/cell),iz=Math.floor(z/cell);
  for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++)
   if(blocked.has((ix+dx)+','+(iz+dz)))return true;
  return false;
 };
}
export function createKunlumTerrainScatter(THREE,heightAt,{
 mobile=false,features=[],toWorld=p=>p,riverXAt=()=>Infinity,riverDistanceAt=null,
 range=1000,seed=87131,excludedBounds=null
}={}){
 const root=new THREE.Group();root.name='Kunlum stone scatter and native 3D vegetation';
 const rng=kunlumRng(seed),avoid=createKunlumAvoidance(features,toWorld),owned=[];
 const stoneGeo=new THREE.IcosahedronGeometry(1,0);
 const rockMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,metalness:0,flatShading:true});
 owned.push(stoneGeo,rockMat);
 const budget=mobile?1150:3400;
 const stones=new THREE.InstancedMesh(stoneGeo,rockMat,budget);
 stones.name='Mountain stones (artistic 3D instances)';
 stones.frustumCulled=false;
 const dummy=new THREE.Object3D(),color=new THREE.Color();
 let placed=0,attempts=0;
 const nearWater=(x,z)=>riverDistanceAt?riverDistanceAt(x,z)<30:Math.abs(x-riverXAt(z))<27;
 while(placed<budget&&attempts<budget*10){
  attempts++;
  const spread=rng()<.68?Math.min(range,560):range;
  const x=(rng()*2-1)*spread,z=(rng()*2-1)*spread;
  if(x*x+z*z<750||nearWater(x,z)||avoid(x,z)||
   (excludedBounds&&x>=excludedBounds.minX&&x<=excludedBounds.maxX&&
    z>=excludedBounds.minZ&&z<=excludedBounds.maxZ))continue;
  const y=heightAt(x,z);
  const slope=Math.hypot((heightAt(x+4,z)-heightAt(x-4,z))/8,
   (heightAt(x,z+4)-heightAt(x,z-4))/8);
  if(!Number.isFinite(y)||!Number.isFinite(slope)||slope>3.5)continue;
  if(slope<.12&&rng()<.65)continue;
  const r=rng(),scale=.5+Math.pow(r,3)*(slope>.8?4.7:2.2);
  dummy.position.set(x,y+scale*.12,z);
  dummy.scale.set(scale*(1+rng()*.65),scale*(.58+rng()*.36),scale*(.8+rng()*.65));
  dummy.rotation.set((rng()-.5)*.45,rng()*Math.PI*2,(rng()-.5)*.55);
  dummy.updateMatrix();
  stones.setMatrixAt(placed,dummy.matrix);
  color.set(KUNLUM_AUTUMN.rock).multiplyScalar(.82+rng()*.33);
  stones.setColorAt(placed,color);
  placed++;
 }
 stones.count=placed;stones.instanceMatrix.needsUpdate=true;
 if(stones.instanceColor)stones.instanceColor.needsUpdate=true;
 root.add(stones);owned.push(stones);

 // Flowering shrubs, meadow grasses and willows use true 3D geometry.
 // Keep construction and mapped archaeological walls clear.
 const vegetation=createKunlumVegetation(THREE,heightAt,{
  mobile,rng,avoid,riverDistanceAt:riverDistanceAt||
   ((x,z)=>Math.abs(x-riverXAt(z))),
  range,excludedBounds,colors:{dryGrass:KUNLUM_AUTUMN.dryGrass}
 });
 root.add(vegetation.root);
 return {root,counts:{rock:placed,...vegetation.counts},
  update(seconds,camera){vegetation.update(seconds,camera)},
  dispose(){vegetation.dispose();for(const o of owned)o.dispose?.()}};
}

/**
 * Angular rock outcrops formed from actual instanced 3D meshes, not an image.
 * Decorative, not historically surveyed. Sample all footprint edges to bury
 * the rock into the DEM rather than levitating above the downhill face.
 * Culled from a bounded region for mobile browser performance.
 */
export function createKunlumRockOutcrops(THREE,heightAt,{
 mobile=false,features=[],toWorld=p=>p,riverXAt=()=>Infinity,riverDistanceAt=null,
 bounds={minX:-1600,maxX:1600,minZ:-1600,maxZ:1600},
 seed=285199
}={}){
 if(typeof heightAt!=='function')throw Error('Height sampler is required');
 const root=new THREE.Group();
 root.name='Unsourced sculptural cliff outcrops (3D, artistic)';
 const rng=kunlumRng(seed);
 const avoid=createKunlumAvoidance(features,toWorld,{cell:24});
 const geometry=new THREE.DodecahedronGeometry(1,0);
 const material=new THREE.MeshStandardMaterial({
  color:0xffffff,roughness:.93,metalness:0,flatShading:true
 });
 const target=mobile?155:420;
 const mesh=new THREE.InstancedMesh(geometry,material,target);
 mesh.name='Irregular angular mountain outcrops';
 mesh.castShadow=!mobile;
 mesh.receiveShadow=true;
 // Shared instanced cloud spans kilometres; disabling single-bounds culling
 // avoids erroneous disappearance when orbiting around the tower.
 mesh.frustumCulled=false;
 const dummy=new THREE.Object3D(),color=new THREE.Color();
 let placed=0,trials=0;
 const within=(x,z)=>x>bounds.minX+65&&x<bounds.maxX-65
  &&z>bounds.minZ+65&&z<bounds.maxZ-65;
 while(placed<target&&trials<target*70){
  trials++;
  // Half the rocks form visible near-field crags, others punctuate ridgelines.
  const near=rng()<.48,spread=near?800:3200;
  const x=(rng()*2-1)*spread,z=(rng()*2-1)*spread;
  if(!within(x,z)||x*x+z*z<110*110||avoid(x,z)||(riverDistanceAt?riverDistanceAt(x,z)<52:Math.abs(x-riverXAt(z))<48))continue;
  const y=heightAt(x,z);
  const east=heightAt(x+12,z)-heightAt(x-12,z);
  const north=heightAt(x,z+12)-heightAt(x,z-12);
  const slope=Math.hypot(east,north)/24;
  if(!Number.isFinite(y)||!Number.isFinite(slope)||slope<.24||slope>2.7)continue;
  const span=3.5+Math.pow(rng(),1.4)*(near?10:21);
  const w=span*(.72+rng()*.67),d=span*(.55+rng()*.6);
  const height=span*(.5+rng()*.8);
  const foot=Math.min(
   y,heightAt(x+w*.5,z),heightAt(x-w*.5,z),
   heightAt(x,z+d*.5),heightAt(x,z-d*.5)
  );
  if(!Number.isFinite(foot))continue;
  // A positive part of the mesh always intersects actual terrain samples.
  // No artificial plateau is added; terrain remains physically unchanged.
  dummy.position.set(x,foot-height*.30,z);
  dummy.scale.set(w,height,d);
  dummy.rotation.set((rng()-.5)*.25,rng()*Math.PI*2,(rng()-.5)*.3);
  dummy.updateMatrix();
  mesh.setMatrixAt(placed,dummy.matrix);
  const t=rng();
  color.set(KUNLUM_AUTUMN.rock).multiplyScalar(.82+.36*t);
  mesh.setColorAt(placed,color);
  placed++;
 }
 mesh.count=placed;mesh.instanceMatrix.needsUpdate=true;
 if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 root.add(mesh);
 return {root,count:placed,dispose(){
  geometry.dispose();material.dispose();mesh.dispose?.();
 }};
}


/**
 * Deterministic 3D cobbles, weathered boulders and sparse riparian shrubs.
 * Local OSM centreline provides placement, not surveyed bank/vegetation data.
 * All groups are instanced; no draw call per stone, and no source DEM edits.
 */
export function createKunlumRiverbankScatter(THREE,heightAt,{
 points=[],mobile=false,features=[],toWorld=p=>p,seed=351767
}={}){
 const root=new THREE.Group();root.name='Cherek 3D pebble, wet boulder and sparse shrubs';
 const counts={pebble:0,boulder:0,shrub:0};
 if(!Array.isArray(points)||points.length<2)return {root,counts,dispose(){}};
 const rng=kunlumRng(seed),avoid=createKunlumAvoidance(features,toWorld,{cell:9});
 const owned=[],dummy=new THREE.Object3D(),color=new THREE.Color();
 const specs=[
  ['pebble',mobile?210:790,new THREE.IcosahedronGeometry(1,0),0xaaaaaa],
  ['boulder',mobile?85:245,new THREE.DodecahedronGeometry(1,0),0x97958d],
  ['shrub',mobile?26:95,createKunlumShrubGeometry(THREE,'seabuckthorn',1),0xffffff]
 ];
 for(const [kind,target,geometry,tint] of specs){
  const material=new THREE.MeshStandardMaterial({
   color:tint,roughness:kind==='boulder'?.77:1,metalness:0,
   flatShading:true,vertexColors:kind==='shrub'
  });
  const mesh=new THREE.InstancedMesh(geometry,material,target);
  mesh.name='Riverbank '+kind+' 3D instances';mesh.frustumCulled=false;
  mesh.castShadow=kind==='boulder'&&!mobile;mesh.receiveShadow=false;
  let n=0,tries=0;
  while(n<target&&tries<target*20){
   tries++;
   const i=Math.floor(rng()*(points.length-1)),a=points[i],b=points[i+1],t=rng();
   const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
   const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
   const side=rng()<.5?-1:1,spread=kind==='shrub'?10+rng()*17:
    kind==='boulder'?7.1+rng()*11.7:6.4+rng()*10.4;
   const px=x-side*dz/len*spread,pz=z+side*dx/len*spread;
   if(Math.hypot(px,pz)<85||avoid(-px,pz))continue;
   const base=heightAt(px,pz);
   if(!Number.isFinite(base))continue;
   const ground=carveKunlumRiverHeight(px,pz,heightAt,points);
   const scale=kind==='shrub'?.65+rng()*1.1:
    kind==='boulder'?1.25+rng()*2.75:.12+rng()*.51;
   // Bury feet into the sampled shoulder: no floating rocks on the incline.
   const foot=Math.min(ground,carveKunlumRiverHeight(px+scale*.45,pz,heightAt,points),
    carveKunlumRiverHeight(px-scale*.45,pz,heightAt,points),
    carveKunlumRiverHeight(px,pz+scale*.45,heightAt,points),
    carveKunlumRiverHeight(px,pz-scale*.45,heightAt,points));
   dummy.position.set(px,foot-scale*(kind==='shrub'?.1:.16),pz);
   dummy.scale.set(scale*(.8+rng()*.7),scale*(kind==='shrub'?.7:.49+rng()*.33),scale*(.65+rng()*.6));
   dummy.rotation.set((rng()-.5)*.35,rng()*Math.PI*2,(rng()-.5)*.28);
   dummy.updateMatrix();
   mesh.setMatrixAt(n,dummy.matrix);
   const v=rng();
   if(kind==='shrub')color.setRGB(.9+v*.07,.9+v*.07,.9+v*.07);
   else if(kind==='boulder')color.setRGB(.23+v*.19,.25+v*.18,.25+v*.17); // darker wet rock
   else color.setRGB(.38+v*.23,.37+v*.21,.32+v*.19);
   mesh.setColorAt(n,color);n++;
  }
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  root.add(mesh);owned.push(mesh,geometry,material);
  counts[kind]=n;
 }
 return {root,counts,dispose(){for(const o of owned)o.dispose?.()}};
}
