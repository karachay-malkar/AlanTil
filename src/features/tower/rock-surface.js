/** Shared photographed rock surface for ALL masonry, including historical assets.
 * The Blender Rock Face 02 photo is a UV atlas, not a repeatable bitmap. It was
 * quilted offline with a continuous edge into 3 aligned PBR maps. This module
 * creates planar UVs from the REAL irregular geometry, never cuboid substitutes.
 * The geometry cache avoids 100s of duplicate UV buffers on mobile devices.
 */
import * as THREE from '../../vendor/three/three.module.js';
export const ROCK_SURFACE_VERSION='17.6-rock-face-02.1';
const root='/assets/tower/materials/rock-face-02/';
const cache=new WeakMap();
let materialPromise;
export function getRockSurface(){
 if(!materialPromise){
  const loader=new THREE.TextureLoader();
  const files=['rock-face-02-colour.jpg','rock-face-02-normal.jpg','rock-face-02-roughness.jpg'];
  materialPromise=Promise.all(files.map(name=>loader.loadAsync(`${root}${name}?v=${ROCK_SURFACE_VERSION}`)))
   .then(([map,normalMap,roughnessMap])=>{
    map.colorSpace=THREE.SRGBColorSpace;
    for(const tex of [map,normalMap,roughnessMap]){
     tex.wrapS=THREE.RepeatWrapping;tex.wrapT=THREE.RepeatWrapping;
     tex.anisotropy=4;
    }
    return new THREE.MeshStandardMaterial({
     name:'AlanTil Rock Face 02 dark mountain stone',map,normalMap,roughnessMap,
     normalScale:new THREE.Vector2(.38,.38),roughness:.97,metalness:0,
     side:THREE.DoubleSide
    });
   });
 }
 return materialPromise;
}
export function applyRockSurface(group,material){
 group.traverse(node=>{
  if(!node.isMesh||node.userData.alantilNonStone)return;
  const base=node.geometry;
  let geometry=cache.get(base);
  if(!geometry){
   geometry=base.clone();
   const p=geometry.getAttribute('position');
   let n=geometry.getAttribute('normal');
   if(!n){geometry.computeVertexNormals();n=geometry.getAttribute('normal');}
   const uv=new Float32Array(p.count*2);
   const scale=3.15; // 1 repeat per ~32 cm, never the original atlas UVs
   for(let i=0;i<p.count;i++){
    const a=Math.abs(n.getX(i)),b=Math.abs(n.getY(i)),c=Math.abs(n.getZ(i));
    let u,v;
    if(a>=b&&a>=c){u=p.getZ(i);v=p.getY(i);}
    else if(b>=a&&b>=c){u=p.getX(i);v=p.getZ(i);}
    else{u=p.getX(i);v=p.getY(i);}
    uv[i*2]=u*scale;uv[i*2+1]=v*scale;
   }
   geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
   cache.set(base,geometry);
  }
  node.geometry=geometry;
  node.material=material;
 });
 return group;
}
