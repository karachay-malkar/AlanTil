/**
 * AlanTil 17.1 - collision/render geometry contract, V2 (experimental).
 * No generated rock meshes: exactly the positions and triangles returned by
 * originalRockMesh(ROCK_PACK[type][variant]); only rigid rotations and
 * authored-cell scaling are used. Coordinates are physical meters.
 *
 * This module is intentionally independent of DOM, Three, storage and RPC.
 * A prototype must not enable production placement until the server can
 * independently validate the corresponding convex geometry.
 */
import {makeBody} from './stone-placement-v2.mjs';
export const CELL_METERS = 0.25;
const ROCK_TYPES=new Set(['stone','medium','long','big']);
export const validateRockType=type=>ROCK_TYPES.has(type);
const EPS=1e-9;
const point=(a,i)=>[Number(a[i*3]),Number(a[i*3+1]),Number(a[i*3+2])];
const subtract=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=x=>Math.hypot(...x);
function canonicalDirection(v){
 const n=length(v);if(n<1e-9)return null;
 const a=v.map(x=>x/n);
 if((a.find(x=>Math.abs(x)>1e-7)||0)<0)return a.map(x=>-x);
 return a;
}
function uniqueDirections(values){
 const seen=new Set(),out=[];
 for(const value of values){const axis=canonicalDirection(value);if(!axis)continue;
  const key=axis.map(x=>Math.round(x*10000)).join(',');
  if(!seen.has(key)){seen.add(key);out.push(axis);}
 }
 return out;
}
/** Matches scene.js orientation() quaternion cases 0-7 exactly. */
export function orientAuthoredVertex([x,y,z],rotation){
 switch(rotation){
  case 0:return[x,y,z];case 1:return[z,y,-x];case 2:return[-x,y,-z];case 3:return[-z,y,x];
  case 4:return[y,-x,z];case 5:return[x,-z,y];case 6:return[y,z,x];case 7:return[z,x,y];
  default:throw new RangeError('Invalid rock rotation');
 }
}
export function worldStoneDimensions(block){
 const [sx,sy,sz]=[block.sx,block.sy,block.sz];
 switch(block.rotation){case 0:case 2:return[sx,sy,sz];case 1:case 3:return[sz,sy,sx];
  case 4:return[sy,sx,sz];case 5:return[sx,sz,sy];case 6:return[sy,sz,sx];case 7:return[sz,sx,sy];
  default:throw new RangeError('Invalid rock rotation');}
}
export function meshDiagnostics(mesh){
 if(!mesh?.positions||!mesh?.indices||mesh.positions.length%3||mesh.indices.length%3)throw new TypeError('Invalid authored mesh');
 const n=mesh.positions.length/3;const counts=new Map(),directions=new Map();let degenerate=0,signedVolume=0;
 for(let f=0;f<mesh.indices.length;f+=3){const ids=[mesh.indices[f],mesh.indices[f+1],mesh.indices[f+2]];
  if(ids.some(i=>i>=n||!Number.isInteger(i)))throw new TypeError('Invalid authored triangle index');
  const [a,b,c]=ids.map(i=>point(mesh.positions,i));
  const normal=cross(subtract(b,a),subtract(c,a));if(length(normal)<1e-8)degenerate++;
  signedVolume+=(a[0]*normal[0]+a[1]*normal[1]+a[2]*normal[2])/6;
  for(let k=0;k<3;k++){
   const x=ids[k],y=ids[(k+1)%3],key=Math.min(x,y)+':'+Math.max(x,y);
   counts.set(key,(counts.get(key)||0)+1);directions.set(key,(directions.get(key)||0)+(x<y?1:-1));
  }
 }
 let boundaryEdges=0,nonManifoldEdges=0,windingConflicts=0;
 for(const [key,count]of counts){if(count===1)boundaryEdges++;if(count>2)nonManifoldEdges++;if(count===2&&directions.get(key)!==0)windingConflicts++;}
 return{vertices:n,triangles:mesh.indices.length/3,boundaryEdges,nonManifoldEdges,windingConflicts,degenerate,signedVolume,watertight:!boundaryEdges&&!nonManifoldEdges&&!windingConflicts&&!degenerate};
}
/** Convert SAME authored mesh displayed by Three to solver shape.
 * The collision hull is conservative: includes EVERY authored triangle normal
 * and edge direction. Missing hull facets can cause false REJECTION, never
 * a false collision-free result for convex hulls. Contact uses raw triangles.
 */
export function stoneMeshFromAuthored(mesh,block,{cell=CELL_METERS}={}){
 if(!mesh?.positions||!mesh?.indices||mesh.positions.length<12||mesh.positions.length%3||mesh.indices.length<12||mesh.indices.length%3)throw new TypeError('Degenerate authored mesh');
 if(!validateRockType(block?.type)||!Number.isInteger(block.rotation)||block.rotation<0||block.rotation>7||
  ![block.sx,block.sy,block.sz].every(x=>Number.isInteger(x)&&x>0)||
  ![block.x,block.y,block.z].every(Number.isFinite)||!Number.isFinite(cell)||cell<=0)throw new TypeError('Invalid rock block');
 const vertices=[];const span=[block.sx,block.sy,block.sz].map(v=>v*cell);
 for(let i=0;i<mesh.positions.length;i+=3){
  const v=[mesh.positions[i]*span[0],mesh.positions[i+1]*span[1],mesh.positions[i+2]*span[2]];
  if(v.some(x=>!Number.isFinite(x)))throw new TypeError('Invalid mesh coordinates');
  vertices.push(orientAuthoredVertex(v,block.rotation));
 }
 if(vertices.length>255)throw new RangeError('Unusually large mesh; verify solver budget');
 const faces=[],axes=[],edges=[];
 for(let i=0;i<mesh.indices.length;i+=3){
  const a=mesh.indices[i],b=mesh.indices[i+1],c=mesh.indices[i+2];
  if([a,b,c].some(index=>index>=vertices.length))throw new TypeError('Invalid authored triangle index');
  if(a===b||b===c||a===c)continue;
  const ab=subtract(vertices[b],vertices[a]),bc=subtract(vertices[c],vertices[b]),ca=subtract(vertices[a],vertices[c]),normal=cross(ab,subtract(vertices[c],vertices[a]));
  if(length(normal)<EPS)continue;
  faces.push([a,b,c]);axes.push(normal);edges.push(ab,bc,ca);
 }
 if(faces.length<4)throw new TypeError('Degenerate authored surface');
 const center=[0,1,2].map(i=>vertices.reduce((s,v)=>s+v[i],0)/vertices.length);
 return{vertices,faces,hullNormals:uniqueDirections(axes),hullEdges:uniqueDirections(edges),center};
}
/** Scene computes render position from AABB origin + worldDims/2. */
export function bodyForTowerBlock(mesh,block,{cell=CELL_METERS}={}){
 const template=stoneMeshFromAuthored(mesh,block,{cell}),d=worldStoneDimensions(block);
 const renderCenter=[block.x+d[0]/2,block.y+d[1]/2,block.z+d[2]/2].map(v=>v*cell);
 return makeBody(template,renderCenter);
}
/** Body position is its transform pivot, NOT the biased sampled COM. */
export function towerBlockFromBody(body,template,{cell=CELL_METERS}={}){
 if(!body?.position?.every(Number.isFinite)||!validateRockType(template?.type))throw new TypeError('Invalid placement result');
 const d=worldStoneDimensions(template);
 const [x,y,z]=body.position.map((v,i)=>v/cell-d[i]/2);
 return{...template,x,y,z};
}
