/**
 * Runtime-only mesh optimisation for immutable, user-authored stone sections.
 * Each original stone keeps its exact transform and metric PBR UVs in the editor.
 * Only triangles provably inside another CLOSED rock's interior are discarded.
 *
 * Every pruning sphere is entirely inside a watertight stone: the centre is
 * inside the solid and its radius is less than the distance to its closest
 * surface. Because spheres and triangles are convex, a triangle with all
 * three vertices strictly inside one sphere cannot appear from any camera.
 * This is deliberately conservative: unsupported occlusion is never guessed.
 */
import * as THREE from '../../vendor/three/three.module.js';
import {mergeGeometries} from '../../vendor/three/addons/utils/BufferGeometryUtils.js';

const EPSILON=0.0005;
const DIRECTIONS=[
 new THREE.Vector3(1,.237,.413).normalize(),
 new THREE.Vector3(.173,1,.357).normalize(),
 new THREE.Vector3(.349,.271,1).normalize()
];
const COORDINATES=[.25,.5,.75];
const ATTRIBUTES=['position','normal','uv','uv2'];
const xyz=(attribute,index)=>new THREE.Vector3().fromBufferAttribute(attribute,index);
const keyOf=v=>[v.x,v.y,v.z].map(n=>Math.round(n*100000)).join(',');
function trianglesFor(geometry){
 const p=geometry.getAttribute('position'),faces=[];
 for(let i=0;i<p.count;i+=3)faces.push(new THREE.Triangle(xyz(p,i),xyz(p,i+1),xyz(p,i+2)));
 return faces;
}
function isClosed(triangles){
 const edges=new Map();
 for(const triangle of triangles){
  const vertices=[triangle.a,triangle.b,triangle.c];
  for(let i=0;i<3;i++){
   const a=keyOf(vertices[i]),b=keyOf(vertices[(i+1)%3]);
   if(a===b)return false;
   const k=a<b?a+'|'+b:b+'|'+a;
   edges.set(k,(edges.get(k)||0)+1);
  }
 }
 return edges.size>0&&[...edges.values()].every(count=>count===2);
}
function isInterior(point,triangles){
 const ray=new THREE.Ray(),hit=new THREE.Vector3();
 for(const direction of DIRECTIONS){
  ray.set(point,direction);
  const distances=[];
  for(const triangle of triangles){
   const match=ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit);
   if(match){
    const distance=match.distanceTo(point);
    if(distance>EPSILON)distances.push(distance);
   }
  }
  distances.sort((a,b)=>a-b);
  let crossings=0,last=-Infinity;
  for(const distance of distances){
   if(distance-last>1e-5){crossings++;last=distance;}
  }
  if(crossings%2!==1)return false;
 }
 return true;
}
function inscribedSpheres(geometry){
 const triangles=trianglesFor(geometry);
 if(!isClosed(triangles))return [];
 geometry.computeBoundingBox();
 const box=geometry.boundingBox,extent=box.getSize(new THREE.Vector3());
 const point=new THREE.Vector3(),closest=new THREE.Vector3(),spheres=[];
 for(const x of COORDINATES)for(const y of COORDINATES)for(const z of COORDINATES){
  point.set(box.min.x+x*extent.x,box.min.y+y*extent.y,box.min.z+z*extent.z);
  if(!isInterior(point,triangles))continue;
  let squared=Infinity;
  for(const face of triangles){
   face.closestPointToPoint(point,closest);
   squared=Math.min(squared,point.distanceToSquared(closest));
  }
  const radius=Math.sqrt(squared)-EPSILON;
  if(radius>EPSILON*4)spheres.push({center:point.clone(),radiusSq:radius*radius});
 }
 return spheres;
}
function triangleIsBuried(a,b,c,others){
 for(const other of others){
  const box=other.box;
  if(!box.containsPoint(a)||!box.containsPoint(b)||!box.containsPoint(c))continue;
  for(const sphere of other.spheres){
   if(a.distanceToSquared(sphere.center)<sphere.radiusSq&&
      b.distanceToSquared(sphere.center)<sphere.radiusSq&&
      c.distanceToSquared(sphere.center)<sphere.radiusSq)return true;
  }
 }
 return false;
}
function selectVisible(geometry,others){
 const positions=geometry.getAttribute('position'),count=positions.count;
 if(!others.length)return {geometry,trimmed:0};
 const keep=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
 for(let i=0;i<count;i+=3){
  a.fromBufferAttribute(positions,i);
  b.fromBufferAttribute(positions,i+1);
  c.fromBufferAttribute(positions,i+2);
  if(!triangleIsBuried(a,b,c,others))keep.push(i,i+1,i+2);
 }
 if(keep.length===count)return {geometry,trimmed:0};
 if(!keep.length)return {geometry:null,trimmed:count/3};
 const visible=new THREE.BufferGeometry();
 for(const name of ATTRIBUTES){
  const source=geometry.getAttribute(name),array=new Float32Array(keep.length*source.itemSize);
  for(let i=0;i<keep.length;i++){
   for(let c=0;c<source.itemSize;c++)array[i*source.itemSize+c]=source.array[keep[i]*source.itemSize+c];
  }
  visible.setAttribute(name,new THREE.BufferAttribute(array,source.itemSize));
 }
 return {geometry:visible,trimmed:(count-keep.length)/3};
}
/**
 * @param {THREE.Group} root Root with actual independent authored stone meshes.
 * @returns {{geometry:THREE.BufferGeometry,stats:Object}} One mesh-ready geometry.
 */
export function mergeApprovedStoneMeshes(root){
 const stones=[];
 root.updateMatrixWorld(true);
 // Bake child-local transforms only; root's position stays in the saved layout.
 for(const node of root.children){
  if(!node.isMesh)continue;
  const source=node.geometry;
  let geometry=source.index?source.toNonIndexed():source.clone();
  geometry.applyMatrix4(node.matrix);
  if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
  if(!geometry.getAttribute('uv'))throw new Error('Approved rock UV attribute is missing');
  if(!geometry.getAttribute('uv2'))geometry.setAttribute('uv2',geometry.getAttribute('uv').clone());
  const cleaned=new THREE.BufferGeometry();
  for(const name of ATTRIBUTES)cleaned.setAttribute(name,geometry.getAttribute(name).clone());
  geometry.dispose();
  cleaned.computeBoundingBox();
  stones.push({geometry:cleaned,box:cleaned.boundingBox});
 }
 if(!stones.length)throw new Error('Empty approved stone section');
 const stats={sourceMeshes:stones.length,sourceTriangles:stones.reduce((n,s)=>n+s.geometry.getAttribute('position').count/3,0),trimmedTriangles:0};
 // Each closed rock yields strictly interior spheres. The expensive proof is
 // performed once per approved variant, not per placed block or render frame.
 for(const stone of stones)stone.spheres=inscribedSpheres(stone.geometry);
 const usable=[];
 for(const stone of stones){
  const neighbors=stones.filter(other=>other!==stone&&other.spheres.length&&stone.box.intersectsBox(other.box));
  const result=selectVisible(stone.geometry,neighbors);
  stats.trimmedTriangles+=result.trimmed;
  if(result.geometry)usable.push(result.geometry);
  if(result.geometry!==stone.geometry)stone.geometry.dispose();
 }
 const geometry=mergeGeometries(usable,false);
 for(const item of usable)item.dispose();
 if(!geometry)throw new Error('Approved stones cannot be merged');
 geometry.computeBoundingBox();
 geometry.computeBoundingSphere();
 stats.renderTriangles=geometry.getAttribute('position').count/3;
 return {geometry,stats};
}
