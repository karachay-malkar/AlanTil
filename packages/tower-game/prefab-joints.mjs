import {prefabBounds,touchingPrefabPairs} from './prefab-layout.mjs';
import {WINDOW_PREFAB_ID,WINDOW_PREFAB_VERSION,WINDOW_JOINT_FILES} from './window-prefab.mjs';
/** Static 25-cm joint-tile resolver; no runtime mesh generation/deformation. */
export const JOINT_INTERFACE='shared-recessed-25cm-v1';
const EPS=1e-5;
export function sectionAssetVersion(s,manifest){return s.geometryVersion??manifest.version;}
export function sectionJointProfile(s,manifest){
 if(s.type!=='masonry_section')return null;
 if(s.sectionId===WINDOW_PREFAB_ID)return sectionAssetVersion(s,manifest)===WINDOW_PREFAB_VERSION?JOINT_INTERFACE:null;
 if(![manifest.version,manifest.previousVersion,...Object.keys(manifest.historicVariants||{})].includes(sectionAssetVersion(s,manifest)))return null;
 return manifest.types.find(x=>x.id===s.sectionId)?.jointInterface||null;
}
export function compatibleSectionFaces(a,b,manifest){
 const pa=sectionJointProfile(a,manifest),pb=sectionJointProfile(b,manifest);
 return !!pa&&pa===pb&&pa===JOINT_INTERFACE;
}
/** Original 4x5x2 window contains solid piers at x=0..1 and x=3..4,
 * and one solid lintel course y=4..5. The 2x4 cell aperture is EMPTY.
 * Inverse Three.js yaw maps world contact points into the authored prefab.
 */
export function windowStoneAtJoint(section,point){
 if(section?.sectionId!==WINDOW_PREFAB_ID)return true;
 const bounds=prefabBounds(section);
 const theta=(section.rotation||0)*Math.PI/2;
 const dx=point[0]-(bounds.min[0]+bounds.max[0])/2;
 const dz=point[2]-(bounds.min[2]+bounds.max[2])/2;
 const localX=dx*Math.cos(theta)-dz*Math.sin(theta)+2;
 const localY=point[1]-bounds.min[1];
 return !(localX>1+EPS&&localX<3-EPS&&localY<4-EPS);
}
/** Contact between two baked 17.5 sections must resolve to pre-baked assets.
 * Legacy read-only stones never have their meshes modified by this resolver.
 */
export function resolvePrefabJoints(sections,manifest){
 const byId=new Map(sections.map(s=>[s.id,s]));
 const pairs=touchingPrefabPairs(sections.filter(s=>s.type==='masonry_section'));
 const joints=[],incompatible=[];
 for(const pair of pairs){
  const a=byId.get(pair.a),b=byId.get(pair.b);
  const involvesWindow=a.sectionId===WINDOW_PREFAB_ID||b.sectionId===WINDOW_PREFAB_ID;
  // Older 17.4.1 pieces never shared the newer prepared interface.
  if(involvesWindow&&(sectionAssetVersion(a,manifest)===manifest.legacyVersion||
                     sectionAssetVersion(b,manifest)===manifest.legacyVersion))continue;
  if(sectionAssetVersion(a,manifest)===manifest.legacyVersion&&
     sectionAssetVersion(b,manifest)===manifest.legacyVersion){
   const file=manifest.legacyConnectors?.[pair.axis];
   if(file)joints.push({...pair,file,legacyScale:true});
   continue;
  }
  if(!compatibleSectionFaces(a,b,manifest)){
   incompatible.push({...pair,reason:'У вариантов нет совместимого подготовленного стыка'});continue;
  }
  // Old saved towers retain their original pre-baked joint geometry. New
  // neighbours use the latest shared interface, without re-baking old stones.
  const va=sectionAssetVersion(a,manifest),vb=sectionAssetVersion(b,manifest);
  const source=va===vb&&va===manifest.previousVersion?manifest.previousConnectors:
               va===vb&&manifest.historicConnectors?.[va]?manifest.historicConnectors[va]:null;
  const spec=involvesWindow?
   {file:WINDOW_JOINT_FILES[pair.axis],interface:JOINT_INTERFACE}:
   source?.[pair.axis]?{file:source[pair.axis],interface:JOINT_INTERFACE}:manifest.connectors?.[pair.axis];
  if(!spec||spec.interface!==JOINT_INTERFACE||!spec.file){incompatible.push({...pair,reason:'Нет готового соединения'});continue;}
  const axes={x:[1,2],y:[0,2],z:[0,1]}[pair.axis];
  // Grid coordinates are integral for all newly placed sections.
  for(let u=Math.round(pair.min[axes[0]]);u<pair.max[axes[0]]-EPS;u++)
   for(let v=Math.round(pair.min[axes[1]]);v<pair.max[axes[1]]-EPS;v++){
    const p=[...pair.min];p[axes[0]]=u+.5;p[axes[1]]=v+.5;
    if(windowStoneAtJoint(a,p)&&windowStoneAtJoint(b,p))
     joints.push({a:pair.a,b:pair.b,axis:pair.axis,point:p,file:spec.file,profile:JOINT_INTERFACE});
   }
 }
 // A prepared vertical corner tile connects two perpendicular seam chains.
 const dedupe=new Set();
 for(const middle of sections.filter(s=>s.type==='masonry_section')){
  const connected=pairs.filter(p=>p.a===middle.id||p.b===middle.id);
  for(const px of connected.filter(p=>p.axis==='x'))for(const pz of connected.filter(p=>p.axis==='z')){
   const y0=Math.max(px.min[1],pz.min[1]),y1=Math.min(px.max[1],pz.max[1]);
   if(y1-y0<EPS)continue;
   if(!compatibleSectionFaces(byId.get(px.a),byId.get(px.b),manifest)||
      !compatibleSectionFaces(byId.get(pz.a),byId.get(pz.b),manifest))continue;
   const otherX=byId.get(px.a===middle.id?px.b:px.a),otherZ=byId.get(pz.a===middle.id?pz.b:pz.a);
   const windowCorner=[middle,otherX,otherZ].some(s=>s.sectionId===WINDOW_PREFAB_ID);
   const spec=windowCorner?{file:WINDOW_JOINT_FILES.corner,interface:JOINT_INTERFACE}:manifest.connectors?.corner;
   if(!spec?.file||spec.interface!==JOINT_INTERFACE)continue;
   for(let y=Math.round(y0);y<y1-EPS;y++){
    const point=[px.min[0],y+.5,pz.min[2]];
    if(![middle,otherX,otherZ].every(s=>windowStoneAtJoint(s,point)))continue;
    const key=point.join(':');if(dedupe.has(key))continue;dedupe.add(key);
    joints.push({a:middle.id,b:px.a===middle.id?px.b:px.a,axis:'corner',point,file:spec.file,profile:JOINT_INTERFACE});
   }
  }
 }
 return {ok:incompatible.length===0,joints,incompatible,pairs};
}
export function validateSectionJoints(existing,proposed,manifest){
 if(!manifest)return{ok:false,reason:'Не загружен каталог готовых стыков'};
 const all=[...existing.filter(s=>s.type==='masonry_section'),proposed];
 const result=resolvePrefabJoints(all,manifest);
 return result.ok?{ok:true,reason:''}:{ok:false,reason:result.incompatible[0].reason};
}