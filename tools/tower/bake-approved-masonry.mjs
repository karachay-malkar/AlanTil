import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {GLTFExporter} from '../ashyk-web/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {BufferAttribute,BufferGeometry,MeshStandardMaterial} from '../../src/vendor/three/three.module.js';
import {createApprovedSectionLoader} from '../../src/features/tower/approved-section-scene.js';

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

const section=await createApprovedSectionLoader({loadBaked:async()=>null})
 .make('3x3x3',1,new MeshStandardMaterial());
const [mesh]=section.children;
mesh.geometry=indexExactVertices(mesh.geometry);
mesh.userData={
 sourceStoneCount:section.userData.sourceStoneCount,
 optimization:section.userData.optimization
};
const binary=await new GLTFExporter().parseAsync(mesh,{binary:true});
const output=new URL('assets/tower/approved-library/baked/',root);
await mkdir(output,{recursive:true});
await writeFile(new URL('section-3x3x3-v2.glb',output),new Uint8Array(binary));
console.log(JSON.stringify({...section.userData.optimization,bytes:binary.byteLength}));
