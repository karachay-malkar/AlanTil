/**
 * Artistic native 3D vegetation for the upper Cherek valley.
 * No mapped plant claims; deterministic instancing, no collision or save changes.
 * Deliberately uses willows, not birches.
 */
import {KUNLUM_AUTUMN} from './kunlum-autumn-palette.js';

const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>{const v=clamp((t-a)/(b-a),0,1);return v*v*(3-2*v);};

export function createKunlumGrassGeometry(THREE,variant=0){
 if(!Number.isInteger(variant)||variant<0||variant>7)throw Error('Invalid grass variant');
 const vertices=[];
 const blades=4+(variant%4);
 for(let j=0;j<blades;j++){
  const angle=TAU*(j/blades)+(variant*.47),cs=Math.cos(angle),sn=Math.sin(angle);
  const length=.66+((j*3+variant*5)%7)*.095;
  const width=.035+((j+variant*2)%4)*.012;
  const bend=.12+((j*5+variant)%5)*.065;
  const at=t=>{
   const x=Math.sin(t*1.3)*bend*t;
   const y=t*length;
   const w=width*(1-t*.92);
   return [[(x-w)*cs,y,(x-w)*sn],[(x+w)*cs,y,(x+w)*sn]];
  };
  for(let k=0;k<3;k++){
   const [a,b]=at(k/3),[c,d]=at((k+1)/3);
   vertices.push(...a,...b,...c,...c,...b,...d);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geo.computeVertexNormals();
 return geo;
}

function composer(THREE){
 const positions=[],normals=[],colors=[];
 const point=new THREE.Vector3(),normal=new THREE.Vector3(),color=new THREE.Color();
 return {
  add(geometry,matrix,tint){
   const raw=geometry.index?geometry.toNonIndexed():geometry;
   const pos=raw.getAttribute('position'),norm=raw.getAttribute('normal');
   color.set(tint);
   for(let i=0;i<pos.count;i++){
    point.fromBufferAttribute(pos,i).applyMatrix4(matrix);
    normal.fromBufferAttribute(norm,i).transformDirection(matrix);
    positions.push(point.x,point.y,point.z);
    normals.push(normal.x,normal.y,normal.z);
    colors.push(color.r,color.g,color.b);
   }
   if(raw!==geometry)raw.dispose();
   geometry.dispose();
  },
  finish(){
   const geo=new THREE.BufferGeometry();
   geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
   geo.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
   geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
   geo.computeBoundingSphere();
   return geo;
  }
 };
}
function addEllipsoid(THREE,out,x,y,z,sx,sy,sz,color,detail=0){
 const shape=new THREE.IcosahedronGeometry(1,detail);
 const matrix=new THREE.Matrix4().compose(
  new THREE.Vector3(x,y,z),new THREE.Quaternion(),
  new THREE.Vector3(sx,sy,sz)
 );
 out.add(shape,matrix,color);
}
function addBranch(THREE,out,a,b,radius,color,sides=5){
 const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b);
 const dir=to.clone().sub(from),length=dir.length();
 if(length<.02)return;
 const matrix=new THREE.Matrix4().compose(
  from.clone().add(to).multiplyScalar(.5),
  new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.multiplyScalar(1/length)),
  new THREE.Vector3(radius,length,radius)
 );
 out.add(new THREE.CylinderGeometry(.56,1,1,sides),matrix,color);
}

export function createKunlumShrubGeometry(THREE,species='rosehip',variant=0){
 if(!['rosehip','barberry','seabuckthorn'].includes(species)||![0,1].includes(variant))
  throw Error('Invalid highland shrub variant');
 const out=composer(THREE);
 const types={
  rosehip:{twig:'#6e5440',leaves:['#9c873d','#af9147','#776f36'],fruit:'#a43e2a'},
  barberry:{twig:'#65503b',leaves:['#8c6338','#b47c36','#6c6b35'],fruit:'#a83223'},
  seabuckthorn:{twig:'#80745d',leaves:['#87845e','#aaa06c','#777b61'],fruit:'#df8534'}
 };
 const s=types[species],branches=6+variant*2;
 for(let j=0;j<branches;j++){
  const a=TAU*j/branches+variant*.41;
  const spread=.36+(j%3)*.13+(variant*.08);
  const end=[Math.cos(a)*spread,.63+(j%4)*.13,Math.sin(a)*spread];
  addBranch(THREE,out,[0,.025,0],[Math.cos(a)*.08,.28,Math.sin(a)*.08],.045,s.twig);
  addBranch(THREE,out,[Math.cos(a)*.08,.27,Math.sin(a)*.08],end,.024,s.twig,4);
  for(let t=0;t<3;t++){
   const q=(t+.6)/3.4;
   const x=end[0]*q,y=end[1]*q+.12,z=end[2]*q;
   addEllipsoid(THREE,out,x,y,z,.15+(t%2)*.045,.085,.10,
    s.leaves[(j+t+variant)%s.leaves.length]);
  }
  if(j%2===0){
   addEllipsoid(THREE,out,end[0]*.82,end[1]*.88,end[2]*.82,
    .038,.06,.04,s.fruit);
   addEllipsoid(THREE,out,end[0]*.94,end[1]*.76,end[2]*.94,
    .036,.05,.034,s.fruit);
  }
 }
 return out.finish();
}

export function createKunlumWillowGeometry(THREE,variant=0){
 if(!Number.isInteger(variant)||variant<0||variant>2)throw Error('Invalid willow variant');
 const out=composer(THREE);
 const bark='#796951',branch='#796b4c',leaf=['#a9a259','#baa75d','#898b50','#c1ae6e'];
 const lean=(variant-1)*.16;
 addBranch(THREE,out,[0,0,0],[lean*.6,1.8,0],.15,bark,7);
 addBranch(THREE,out,[lean*.6,1.8,0],[lean,3.35,.03],.1,bark,6);
 for(let j=0;j<9+variant;j++){
  const angle=TAU*(j+.35*variant)/(9+variant);
  const extent=1.12+(j%4)*.24,top=2.6+(j%3)*.38;
  const inner=[lean*.8,.9+(j%4)*.25,0];
  const mid=[Math.cos(angle)*extent*.68+lean,top,Math.sin(angle)*extent*.68];
  const tip=[Math.cos(angle)*extent+lean,top-.45-(j%3)*.12,Math.sin(angle)*extent];
  addBranch(THREE,out,inner,mid,.055,branch,5);
  addBranch(THREE,out,mid,tip,.026,branch,4);
  // Loose, drooping sprays, rather than one spherical cartoon canopy.
  for(let t=0;t<3;t++){
   const w=(t+.75)/3.7;
   const x=mid[0]*(1-w)+tip[0]*w;
   const z=mid[2]*(1-w)+tip[2]*w;
   const y=mid[1]*(1-w)+tip[1]*w-.10*t;
   addEllipsoid(THREE,out,x,y,z,.21,.31+(j%2)*.09,.14,leaf[(j+t+variant)%leaf.length]);
  }
 }
 return out.finish();
}

export function installKunlumGrassWind(material){
 const time={value:0};
 const previous=material.onBeforeCompile;
 material.onBeforeCompile=shader=>{
  previous?.(shader);
  shader.uniforms.uKunlumWind=time;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\nuniform float uKunlumWind;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nfloat kPhase=instanceMatrix[3].x*.17+instanceMatrix[3].z*.11;\nfloat kTip=clamp(position.y,0.0,1.4);\ntransformed.x+=sin(uKunlumWind*1.8+kPhase+position.y)*.065*kTip*kTip;\ntransformed.z+=cos(uKunlumWind*1.35+kPhase*1.4)*.045*kTip*kTip;');
 };
 material.customProgramCacheKey=()=> 'kunlum-autumn-grass-wind-v1';
 return time;
}

export function createKunlumVegetation(THREE,heightAt,{
 mobile=false,rng=Math.random,avoid=()=>false,riverDistanceAt=()=>Infinity,
 range=580,excludedBounds=null,colors={},budgets={}
}={}){
 const root=new THREE.Group();root.name='Kunlum native instanced autumn meadow, shrubs and willows';
 const owned=[],batches=[];
 const quantity={grass:budgets.grass??(mobile?3500:9300),
  shrub:budgets.shrub??(mobile?230:570),
  willow:budgets.willow??(mobile?14:42)};
 const counts={grass:0,shrub:0,willow:0};
 const dummy=new THREE.Object3D(),tint=new THREE.Color();
 const grassMaterial=new THREE.MeshStandardMaterial({
  color:0xffffff,roughness:1,side:THREE.DoubleSide,metalness:0
 });
 const foliageMaterial=new THREE.MeshStandardMaterial({
  color:0xffffff,vertexColors:true,roughness:1,metalness:0,flatShading:true
 });
 owned.push(grassMaterial,foliageMaterial);
 const wind=installKunlumGrassWind(grassMaterial);
 const palette=[colors.dryGrass||KUNLUM_AUTUMN.dryGrass,
  '#a5a164','#d0b373','#8d8b55','#c7ab60','#b8a26c'];
 const nearGround=(x,z,clearance)=>{
  const b=excludedBounds;
  return !!b&&x>=b.minX-clearance&&x<=b.maxX+clearance&&
   z>=b.minZ-clearance&&z<=b.maxZ+clearance;
 };
 function sample(kind){
  for(let tries=0;tries<(kind==='willow'?300:65);tries++){
   const focus=kind==='grass'?115:kind==='shrub'?240:range;
   const radius=rng()<.78?Math.min(range,focus):range;
   const x=7.5+(rng()*2-1)*radius,z=15+(rng()*2-1)*radius;
   if(nearGround(x,z,kind==='grass'?1.5:kind==='shrub'?5:11)||avoid(x,z))continue;
   const y=heightAt(x,z);
   if(!Number.isFinite(y))continue;
   const delta=3;
   const slope=Math.hypot((heightAt(x+delta,z)-heightAt(x-delta,z))/(delta*2),
    (heightAt(x,z+delta)-heightAt(x,z-delta))/(delta*2));
   if(!Number.isFinite(slope))continue;
   const patch=Math.sin(x*.037+Math.sin(z*.021)*2)*.55+
     Math.sin(z*.057-x*.019)*.32;
   if(kind==='grass'){
    if(slope>.92||y>600||patch<-.52)continue;
   }else if(kind==='shrub'){
    if(slope>.73||y>450||patch<-.24)continue;
   }else{
    const water=riverDistanceAt(x,z);
    if(slope>.57||y>310||water<10||water>105)continue;
   }
   return {x,y,z};
  }
  return null;
 }
 function instantiate(name,geometry,material,target,kind,transform){
  owned.push(geometry);
  const mesh=new THREE.InstancedMesh(geometry,material,target);
  mesh.name=name;mesh.userData.vegetationKind=kind;
  mesh.frustumCulled=false; // split near/far material budgets, no bounds-based popping
  let placed=0;
  for(let i=0;i<target;i++){
   const pos=sample(kind);
   if(!pos)break;
   dummy.position.set(pos.x,pos.y-.025,pos.z);
   dummy.rotation.set(0,rng()*TAU,0);
   transform(dummy,rng(),pos);
   dummy.updateMatrix();mesh.setMatrixAt(placed,dummy.matrix);
   if(kind==='grass'){
    tint.set(palette[Math.floor(rng()*palette.length)]);
    tint.multiplyScalar(.72+rng()*.41);
    mesh.setColorAt(placed,tint);
   }
   placed++;
  }
  mesh.count=placed;
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  root.add(mesh);owned.push(mesh);batches.push(mesh);
  counts[kind]+=placed;
 }
 for(let v=0;v<8;v++){
  const number=Math.floor(quantity.grass/8)+(v<quantity.grass%8?1:0);
  instantiate('Meadow grass tuft '+v,createKunlumGrassGeometry(THREE,v),
   grassMaterial,number,'grass',(d,r)=>{
    const sc=.29+r*.58;
    d.scale.set(sc*(.9+r*.35),sc*(.85+r*.7),sc);
  });
 }
 for(const species of ['rosehip','barberry','seabuckthorn']){
  for(let v=0;v<2;v++){
   const index=['rosehip','barberry','seabuckthorn'].indexOf(species)*2+v;
   const number=Math.floor(quantity.shrub/6)+(index<quantity.shrub%6?1:0);
   instantiate(species+' autumn 3D shrub '+v,createKunlumShrubGeometry(THREE,species,v),
    foliageMaterial,number,'shrub',(d,r)=>{
     const sc=.75+r*.95;d.scale.set(sc,sc*(.84+r*.32),sc);
    });
  }
 }
 for(let v=0;v<3;v++){
  const number=Math.floor(quantity.willow/3)+(v<quantity.willow%3?1:0);
  instantiate('Riparian willow tree '+v,createKunlumWillowGeometry(THREE,v),
   foliageMaterial,number,'willow',(d,r)=>{
    const sc=.85+r*.67;d.scale.set(sc,sc*(.9+r*.3),sc);
  });
 }
 return {root,counts,batches,update(seconds,camera){
  wind.value=seconds;
  // Grass is a close-up feature; skip it entirely in a high aerial overview.
  const high=!!camera&&camera.position.y>380;
  for(const mesh of batches)if(mesh.userData.vegetationKind==='grass')mesh.visible=!high;
 },dispose(){for(const o of owned)o.dispose?.()}};
}
