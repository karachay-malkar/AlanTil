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
 mobile=false,features=[],toWorld=p=>p,riverXAt=()=>Infinity,range=1000,seed=87131
}={}){
 const root=new THREE.Group();root.name='Kunlum artistic 3D boulders / grass / shrubland';
 const rng=kunlumRng(seed),avoid=createKunlumAvoidance(features,toWorld);
 const owned=[];
 const stoneGeom=new THREE.IcosahedronGeometry(1,0);
 const shrubGeom=new THREE.DodecahedronGeometry(.8,0);
 const grassGeom=new THREE.BufferGeometry();
 grassGeom.setAttribute('position',new THREE.Float32BufferAttribute([
  -.45,0,0,  .05,1.65,0,  .50,0,0,
  0,0,-.40, 0,1.45,.05, 0,0,.42,
  -.18,0,-.38, .10,1.35,.12, .32,0,.27
 ],3));grassGeom.computeVertexNormals();
 const rockMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,metalness:0,flatShading:true});
 const shrubMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,flatShading:true});
 const grassMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1,side:THREE.DoubleSide});
 owned.push(stoneGeom,shrubGeom,grassGeom,rockMat,shrubMat,grassMat);
 const budgets=mobile?{rock:1150,shrub:460,grass:1800}:{rock:3400,shrub:1250,grass:5700};
 const materialMap={rock:[stoneGeom,rockMat],shrub:[shrubGeom,shrubMat],grass:[grassGeom,grassMat]};
 const dummy=new THREE.Object3D(),col=new THREE.Color();
 const placementCounts={};
 const nearWater=(x,z)=>Math.abs(x-riverXAt(z))<27;
 const take=(type,target)=>{
  const [geom,mat]=materialMap[type],mesh=new THREE.InstancedMesh(geom,mat,target);
  mesh.name=type+' (3D instances, artistic)';
  mesh.castShadow=type==='rock'&&!mobile;mesh.receiveShadow=false;
  mesh.frustumCulled=false;
  let placed=0,tries=0;
  while(placed<target&&tries<target*10){
   tries++;
   // Put about 60% of detail into walkable vicinity of the ruins.
   const cluster=rng()<.68?Math.min(range,type==='rock'?560:470):range;
   const x=(rng()*2-1)*cluster,z=(rng()*2-1)*cluster;
   if(x*x+z*z<750||nearWater(x,z)||avoid(x,z))continue;
   const y=heightAt(x,z);
   const dx=(heightAt(x+4,z)-heightAt(x-4,z))/8,dz=(heightAt(x,z+4)-heightAt(x,z-4))/8;
   const slope=Math.hypot(dx,dz);
   if(!Number.isFinite(y)||slope>3.5)continue;
   if(type==='grass'&&(slope>.65||y>470))continue;
   if(type==='shrub'&&(slope>.89||y>400))continue;
   if(type==='rock'&&slope<.12&&rng()<.65)continue;
   const r=rng();
   if(type==='rock'){
    const scale=.5+Math.pow(r,3)*(slope>.8?4.7:2.2);
    dummy.scale.set(scale*(1+rng()*.65),scale*(.58+rng()*.36),scale*(.8+rng()*.65));
    dummy.position.set(x,y+scale*.12,z); // embed stones into ground, no floating stones
    col.setRGB(.38+rng()*.28,.36+rng()*.25,.30+rng()*.22);
   }else if(type==='shrub'){
    const scale=.65+rng()*.9;
    dummy.scale.set(scale*(.9+rng()*.6),scale*(.54+rng()*.4),scale*(.8+rng()*.7));
    dummy.position.set(x,y+scale*.18,z);
    col.setRGB(.19+rng()*.12,.24+rng()*.22,.11+rng()*.1);
   }else{
    const scale=.36+rng()*.62;
    dummy.scale.set(scale,scale,scale);
    dummy.position.set(x,y-.08,z);
    col.setRGB(.27+rng()*.15,.36+rng()*.25,.12+rng()*.11);
   }
   dummy.rotation.set((rng()-.5)*.45,rng()*Math.PI*2,(rng()-.5)*.55);
   dummy.updateMatrix();
   mesh.setMatrixAt(placed,dummy.matrix);mesh.setColorAt(placed,col);placed++;
  }
  mesh.count=placed;
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  root.add(mesh);owned.push(mesh);
  placementCounts[type]=placed;
 };
 for(const type of ['rock','shrub','grass'])take(type,budgets[type]);
 return {root,counts:placementCounts,dispose(){for(const o of owned)o.dispose?.()}};
}

/**
 * Angular rock outcrops formed from actual instanced 3D meshes, not an image.
 * Decorative, not historically surveyed. Sample all footprint edges to bury
 * the rock into the DEM rather than levitating above the downhill face.
 * Culled from a bounded region for mobile browser performance.
 */
export function createKunlumRockOutcrops(THREE,heightAt,{
 mobile=false,features=[],toWorld=p=>p,riverXAt=()=>Infinity,
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
  if(!within(x,z)||x*x+z*z<110*110||avoid(x,z)||Math.abs(x-riverXAt(z))<48)continue;
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
  color.setRGB(.39+.22*t,.38+.20*t,.33+.18*t);
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
