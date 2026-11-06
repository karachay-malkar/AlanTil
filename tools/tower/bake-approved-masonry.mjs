import {resolve} from 'node:path';
import {GLTFLoader} from '../../src/vendor/three/addons/loaders/GLTFLoader.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {GLTFExporter} from '../ashyk-web/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {BufferAttribute,BufferGeometry,MeshStandardMaterial} from '../../src/vendor/three/three.module.js';
import {APPROVED_MASONRY_VARIANTS} from '../../packages/tower-game/approved-prefab.mjs';
import * as THREE from '../../src/vendor/three/three.module.js';
import {loadCommon100} from '../../src/features/masonry/library.js?v=17.7-approved-masonry.1';
import {loadManualSection} from '../../src/features/masonry/manual-sections/registry.mjs?v=approved-manual.1';
import {approvedSectionId,APPROVED_PREFAB_VERSION} from '../../packages/tower-game/approved-prefab.mjs';
import {PREFAB_CELL_METERS} from '../../packages/tower-game/prefab-layout.mjs';
import {getApprovedStoneSurfaceGeometry} from '../../src/features/tower/rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';
import {mergeApprovedStoneMeshes} from '../../src/features/tower/approved-section-geometry.js?v=17.2.69';

const root=new URL('../../',import.meta.url);
const NativeRequest=globalThis.Request;
globalThis.Request=class extends NativeRequest {
 constructor(input,options){super(new URL(input,'http://localhost'),options);}
};
globalThis.fetch=async input=>new Response(await readFile(
 new URL(new URL(typeof input==='string'?input:input.url,'http://localhost').pathname.slice(1),root)
));
globalThis.ProgressEvent=class extends Event {
 constructor(type,options){super(type);Object.assign(this,options);}
};
globalThis.FileReader=class {
 readAsArrayBuffer(blob){
  blob.arrayBuffer().then(result=>{
   this.result=result;
   this.onloadend();
  });
 }
};

// Share vertices only when every attribute matches exactly. Stone seams and
// the face normals on sharp edges keep their independent vertices.
function indexExactVertices(source){
 const attributes=Object.entries(source.attributes);
 const data=attributes.map(()=>[]);
 const vertices=new Map(),indices=[];
 for(let i=0;i<source.attributes.position.count;i++){
  const values=attributes.map(([,attribute])=>attribute.array.subarray(
   i*attribute.itemSize,(i+1)*attribute.itemSize
  ));
  const key=values.join('|');
  if(!vertices.has(key)){
   vertices.set(key,vertices.size);
   values.forEach((value,j)=>data[j].push(...value));
  }
  indices.push(vertices.get(key));
 }
 const geometry=new BufferGeometry();
 attributes.forEach(([name,attribute],i)=>geometry.setAttribute(name,
  new BufferAttribute(new attribute.array.constructor(data[i]),attribute.itemSize,attribute.normalized)
 ));
 geometry.setIndex(indices);
 return geometry;
}

function createRecipeSectionLoader(){
 let libraryPromise=null;
 const recipes=new Map();
 const library=()=>{
  if(!libraryPromise)libraryPromise=loadCommon100().catch(e=>{libraryPromise=null;throw e;});
  return libraryPromise;
 };
 const source=async id=>{
  if(!recipes.has(id))recipes.set(id,library().then(({manifest})=>loadManualSection(id,manifest))
    .catch(e=>{recipes.delete(id);throw e;}));
  return recipes.get(id);
 };
 async function make(sectionId,variant,material){
  const id=approvedSectionId(sectionId,variant);
  const root=new THREE.Group();root.name='Approved '+id;
  // Editor and baked meshes are bottom-anchored; game blocks are centered.
  root.position.y=-Number(sectionId.split('x')[1])*PREFAB_CELL_METERS/2;
  const [{geometries},{recipe}]=await Promise.all([library(),source(id)]);
  if(recipe.cells.join('x')!==sectionId)throw new Error('Approved prefab footprint mismatch: '+id);
  for(const entry of recipe.stones){
   const original=geometries.get(entry.name);
   if(!original)throw new Error('Missing authored mesh '+entry.name);
   const mesh=new THREE.Mesh(getApprovedStoneSurfaceGeometry(original,entry.scale),material);
   mesh.name=entry.name;
   mesh.position.fromArray(entry.position);
   mesh.quaternion.fromArray(entry.quaternion);
   mesh.scale.fromArray(entry.scale);
   mesh.userData.approvedSourceId=entry.id;
   root.add(mesh);
  }
   // Keep the original recipe intact and cull only provably buried triangles.
   const result=mergeApprovedStoneMeshes(root);
   root.clear();
   const geometry=result.geometry;
   root.userData.optimization=result.stats;
   root.userData.sourceStoneCount=recipe.stones.length;
  const optimized=new THREE.Mesh(geometry,material);
  optimized.name='Approved consolidated '+id;
  root.add(optimized);
  root.userData.approvedSectionId=id;
  root.userData.geometryVersion=APPROVED_PREFAB_VERSION;
  return root;
 }
 return {make};
}

const loader=createRecipeSectionLoader();
const exporter=new GLTFExporter();
const material=new MeshStandardMaterial();
// An optional directory of reviewed *-cast.glb meshes produces the game casts.
const castDirectory=process.argv[2];
const bakedDirectory=new URL('assets/tower/approved-library/baked/',root);
const output=castDirectory?new URL('../casts/',bakedDirectory):bakedDirectory;
const gltfLoader=new GLTFLoader();
async function readMesh(file){
 const bytes=await readFile(file);
 const {scene}=await gltfLoader.parseAsync(
  bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),''
 );
 const [mesh]=scene.children;
 if(scene.children.length!==1||!mesh?.isMesh)throw new Error('Expected one masonry mesh: '+file);
 return mesh;
}
async function prepareCast(filename){
 const cast=await readMesh(resolve(castDirectory,filename.replace('.glb','-cast.glb')));
 const reference=await readMesh(new URL(filename,bakedDirectory));
 cast.geometry.computeBoundingBox();
 reference.geometry.computeBoundingBox();
 const from=cast.geometry.boundingBox,to=reference.geometry.boundingBox;
 const scale=['x','y','z'].map(axis=>(to.max[axis]-to.min[axis])/(from.max[axis]-from.min[axis]));
 cast.geometry.translate(-from.min.x,-from.min.y,-from.min.z);
 cast.geometry.scale(...scale);
 cast.geometry.translate(to.min.x,to.min.y,to.min.z);
 const geometry=getApprovedStoneSurfaceGeometry(cast.geometry);
 return {geometry,userData:{
  sourceStoneCount:reference.userData.sourceStoneCount,
  optimization:{...reference.userData.optimization,renderTriangles:geometry.attributes.position.count/3}
 }};
}
await mkdir(output,{recursive:true});
for(const [size,ids] of Object.entries(APPROVED_MASONRY_VARIANTS)){
 for(const [variant,id] of ids.entries()){
  const filename=id.replace('manual-','section-')+'.glb';
  if(castDirectory&&size==='1x1x1')continue;
  let source,userData;
  if(castDirectory){
   ({geometry:source,userData}=await prepareCast(filename));
  }else{
   const section=await loader.make(size,variant,material);
   source=section.children[0].geometry;
   userData={sourceStoneCount:section.userData.sourceStoneCount,optimization:section.userData.optimization};
  }
  const mesh=new THREE.Mesh(indexExactVertices(source),material);
  source.dispose();
  mesh.userData=userData;
  const binary=await exporter.parseAsync(mesh,{binary:true});
  await writeFile(new URL(filename,output),new Uint8Array(binary));
  mesh.geometry.dispose();
  console.log(JSON.stringify({id,...userData.optimization,bytes:binary.byteLength}));
 }
}
material.dispose();
