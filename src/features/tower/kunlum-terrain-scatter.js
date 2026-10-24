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
   const cluster=rng()<.68?(type==='rock'?660:470):range;
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
