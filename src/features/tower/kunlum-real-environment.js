/**
 * Georeferenced Kunlum visual environment for the Tower game.
 * Approved 2D 30x15m plot drives 15x30m construction grid.
 * Render-only. All historic polygons are one-point calibrated and provisional.
 * Does not register landscape as a placement target.
 */
import {makeKunlumTerrain,makeKunlumPanorama} from './kunlum-terrain-lod.js';
import {sampleDemLocal} from './kunlum-georeference.js';
import {createKunlumWideDem} from './kunlum-wide-dem.js';
import {createKunlumGameAlignment} from './kunlum-build-alignment.js';
import {KUNLUM_BUILD_PARCEL as SITE} from '../../../packages/tower-game/kunlum-parcel.mjs';
import {createKunlumMapOverlay} from './kunlum-map-overlay.js';
import {createKunlumNativeTerrainPBR} from './kunlum-game-landscape.js';
import {loadKunlumCherekLocal,createKunlumRiverLayer,riverDistanceAt} from './kunlum-river-layer.js';
import {createKunlumTerrainScatter,createKunlumRockOutcrops,createKunlumRiverbankScatter} from './kunlum-terrain-scatter.js';


export function createKunlumRealEnvironment(THREE,scene,{plan,mobile=false,stoneMaterialPromise=null,onReady=()=>{}}={}){
 if(!plan?.plot||!Array.isArray(plan.confirmed_features)||!Array.isArray(plan.auto_candidates))
  throw Error('Authoritative 2D vector plan required');
 const group=new THREE.Group();
 group.name='Кюнлюм · актуальный DEM PBR, план 120, Черек OSM';
 scene.add(group);
 const materials=[],geometries=[],textures=[];
 let monument=null;
 let disposed=false;
 const register=(geo,mat,texture)=>{
  if(geo)geometries.push(geo);
  if(mat)materials.push(mat);
  if(texture)textures.push(texture);
 };
 // One calibrated yellow parcel shared by all map and terrain layers.
 const alignment=createKunlumGameAlignment({plot:plan.plot});
 const pbr=createKunlumNativeTerrainPBR(THREE,{mobile});
 const terrain=makeKunlumTerrain(THREE,group,{
  mobile,plot:plan.plot,register,alignment,pbr
 });
 const panorama=makeKunlumPanorama(THREE,group,terrain,{mobile,register});
 const P=alignment.planToScene;
 const towerBase=P([908,460]);
 function createMonument(){
  // Monument is an interpretative geometry only; exact elevation follows DEM.
  const stoneColors=['#b6ae99','#c7bfaf','#a39f8f','#d0c7b3','#aba99a','#bdb5a3'];
  const cache=stoneColors.map(x=>new THREE.Color(x));
  const pos=[],cols=[];
  function tri(a,b,c,id){
   const col=cache[Math.abs(id)%cache.length];
   for(const q of [a,b,c]){pos.push(...q);cols.push(col.r,col.g,col.b)}
  }
  const H=15.8,baseY=terrain.heightAt(...towerBase);
  const x=towerBase[0],z=towerBase[1];
  const corner=(side,u,y,offset=0)=>{
   const w=6+(4.65-6)*(y/H),half=w/2;
   const q=(u-.5)*w;
   const dx=side===0?q:side===1?-q:side===2?half:-half;
   const dz=side===0?half:side===1?-half:side===2?-q:q;
   const r=Math.hypot(dx,dz)||1;
   return [x+dx+dx/r*offset,baseY+y,z+dz+dz/r*offset];
  };
  for(let side=0;side<4;side++)for(let row=0;row<(mobile?22:34);row++){
   const y0=row*H/(mobile?22:34),y1=(row+1)*H/(mobile?22:34);
   const steps=mobile?9:13;
   for(let j=0;j<steps;j++){
    const u0=j/steps,u1=(j+1)/steps,mid=(u0+u1)/2,cy=(y0+y1)/2;
    if((side===0&&mid>.41&&mid<.59&&cy<2.6)||
      (side===0&&Math.abs(mid-.5)<.049&&cy>5.3&&cy<7.0)||
      (side===0&&Math.abs(mid-.5)<.049&&cy>9.5&&cy<11.1))continue;
    const a=corner(side,u0,y0),b=corner(side,u1,y0),
     c=corner(side,u1,y1),d=corner(side,u0,y1);
    const m=corner(side,mid,cy,.018+.065*Math.abs(Math.sin(row*6.2+j*1.7+side)));
    tri(a,b,m,row+j+side);tri(b,c,m,row+j+side+1);
    tri(c,d,m,row+j+side+2);tri(d,a,m,row+j+side+3);
   }
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  g.computeVertexNormals();
  const m=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
  const tower=new THREE.Mesh(g,m);
  tower.name='Абай-къала · approximate stone monument on real DEM elevation';
  tower.userData.common100TowerBase={x,z,baseY,height:H};
  group.add(tower);register(g,m);monument=tower;
 }
 createMonument();
 // One 15x30m boundary from the exact 2D plot.
 const planned=alignment.footprintScene,footprint=[];
 for(let i=0;i<4;i++){
  const a=planned[i],b=planned[(i+1)%4];
  footprint.push(a[0],.14,a[1],b[0],.14,b[1]);
 }
 const footprintGeometry=new THREE.BufferGeometry();
 footprintGeometry.setAttribute('position',new THREE.Float32BufferAttribute(footprint,3));
 const footprintMaterial=new THREE.LineBasicMaterial({color:'#f1d44b',depthTest:false});
 const parcelOutline=new THREE.LineSegments(footprintGeometry,footprintMaterial);
 parcelOutline.name='Approved yellow 15x30m construction parcel';
 group.add(parcelOutline);register(footprintGeometry,footprintMaterial);
 const currentStats={houseContours:0,roofCourtyards:0,courtyards:0,
  confirmedFeatures:0,candidateFeatures:0,sourceAccuracy:'Loading vector plan'};
 group.userData.kunlum={
  plot:[plan.plot.widthM,plan.plot.heightM],buildable:[SITE.widthM,SITE.depthM],
  yellowParcelCenter:[SITE.centerX,SITE.centerZ],yellowParcelCorners:planned,
  gridStep:.25,ruins:currentStats,sitePlan:'kunlum-vector-plan-2026-10-23.json',
  monument:'Абай-къала',abaevModelPosition:towerBase,
  terrain:'Copernicus DEM GLO-30 + PBR, 30m source',terrainResolutionNearM:mobile?12:8,
  terrainTriangles:terrain.triangles,wideStatus:'loading',
  panorama:'fallback only: hidden after loading real Mapzen heights',
  accuracy:'UNVERIFIED: one-point user calibration; rendered scenery does not modify DEM or saved builds'
 };

 // Both datasets are versioned and bundled with the same published tower branch.
 // No live OSM request, no dynamically generated fake substitute river.
 let river=null,riverbank=null,scatter=null,outcrops=null,overlay=null,wideDem=null;
 let riverSourceLine=[];
 let localLine=[],planData=null;
 async function loadApprovedMap(){
  const source=plan; // Same plan fetched by the construction scene.
  if(source.confirmed_features?.length!==120||source.openings?.length!==42||
     source.auto_candidates?.length!==702)throw Error('Unexpected current settlement plan');
  if(disposed)return;
  planData=source;
  overlay=createKunlumMapOverlay(THREE,source,{toWorld:P,heightAt:terrain.heightAt,mobile,monument});
  overlay.setVisibility({confirmedVisible:true,candidatesVisible:true,passagesVisible:true});
  group.add(overlay.root);
  Object.assign(currentStats,{...overlay.counters,courtyards:overlay.counters.houses,
   sourceAccuracy:'Approved user-drawn vector plan (one-point registration)'});
  if(localLine.length)installScenery();
  try{await overlay.enhance({materialPromise:stoneMaterialPromise});}
  catch(error){console.warn('Common100 historic stone detail unavailable:',error);}
  onReady();
 }
 function wideHeightAt(x,z){
  if(!wideDem?.loaded)return terrain.surfaceAt(x,z);
  const [east,north]=terrain.sceneToDem(x,z),b=wideDem.bounds;
  return wideDem.sample(
   Math.max(b.minX,Math.min(b.maxX,east)),
   Math.max(b.minZ,Math.min(b.maxZ,north))
  )-terrain.baseHeight;
 }
 function rebuildRiver(){
  if(!riverSourceLine.length)return;
  const wide=!!wideDem?.loaded;
  const src=wide?riverSourceLine:riverSourceLine.filter(
   p=>Math.abs(p.x)<=1750&&Math.abs(p.z)<=1750
  );
  const line=src.map(({x,z})=>{
   const [sx,sz]=terrain.demToScene(x,z);return {x:sx,z:sz};
  });
  if(line.length<2)throw Error('Mapped Cherek reach outside current DEM');
  if(river){group.remove(river.root);river.dispose();}
  if(riverbank){group.remove(riverbank.root);riverbank.dispose();}
  // Keep the immutable Copernicus geometry incised only near its own extent.
  const core=riverSourceLine.filter(p=>Math.abs(p.x)<=1750&&Math.abs(p.z)<=1750)
   .map(({x,z})=>{const [sx,sz]=terrain.demToScene(x,z);return {x:sx,z:sz}});
  terrain.setRiverLine(core);
  localLine=line;
  const surface=wide?wideHeightAt:terrain.surfaceAt;
  river=createKunlumRiverLayer(THREE,surface,{
   quality:mobile?'interactive':'beautiful',mobile,centerline:line
  });
  group.add(river.root);
  riverbank=createKunlumRiverbankScatter(THREE,surface,{
   points:river.points,mobile,features:planData?.confirmed_features||[],toWorld:P
  });
  group.add(riverbank.root);
 }
 async function loadMappedRiver(){
  const source=await loadKunlumCherekLocal({url:'/assets/tower/environment/kunlum-cherek-balkarsky-osm.json'});
  if(disposed)return;
  riverSourceLine=source.line;
  // Existing tower raycasting still checks ONLY construction prefabs and floor.
  rebuildRiver();
  group.userData.kunlum.river='Local OpenStreetMap ODbL, '+source.line.length+' points';
  if(planData)installScenery();
  onReady();
 }
 function installScenery(){
  if(disposed||!planData||!localLine.length||scatter)return;
  const options={
   mobile,features:planData.confirmed_features,toWorld:P,
   riverDistanceAt:(x,z)=>riverDistanceAt(localLine,x,z)
  };
  const surface=wideDem?.loaded?wideHeightAt:terrain.heightAt;
  scatter=createKunlumTerrainScatter(THREE,surface,{
   ...options,range:mobile?450:580,
   excludedBounds:SITE
  });
  outcrops=createKunlumRockOutcrops(THREE,surface,{
   ...options,bounds:{minX:-1600,maxX:1600,minZ:-1600,maxZ:1600}
  });
  group.add(scatter.root,outcrops.root);
  onReady();
 }
 // The review uses the same real Mapzen/AWS Terrain Tiles DEM. Preserve
 // Copernicus at the centre and load only the 7.6x6.1km outer bands here.
 // It is optional and asynchronous: a failed CORS request cannot disable building.
 async function loadWideTerrain(){
  try{
   wideDem=createKunlumWideDem((e,n)=>sampleDemLocal(terrain.heights,e,n));
   await wideDem.load();
   if(disposed)return;
   const summary=terrain.installWideDem(wideDem);
   panorama.mesh.visible=false;
   // Extend the locally frozen OSM Cherek along the outer DEM and refresh
   // terrain-based scattered stones without moving any historic walls.
   if(riverSourceLine.length)rebuildRiver();
   if(scatter){group.remove(scatter.root);scatter.dispose();scatter=null;}
   if(outcrops){group.remove(outcrops.root);outcrops.dispose();outcrops=null;}
   if(planData&&riverSourceLine.length)installScenery();
   const meta=group.userData.kunlum;
   meta.wideStatus='ready';
   meta.terrainExtentM=summary.extent;
   meta.wideTriangles=summary.triangles;
   meta.terrain='Copernicus GLO-30 centre plus Mapzen/AWS real 7.6x6.1km DEM';
   onReady();
  }catch(error){
   if(disposed)return;
   group.userData.kunlum.wideStatus='unavailable';
   group.userData.kunlum.wideError=String(error?.message||error);
   console.warn('Kunlum outer Mapzen DEM unavailable; central DEM retained:',error);
   onReady();
  }
 }
 // The multi-kilometre DEM is needed only in panorama. Do not download or
 // synchronously assemble its terrain tiles when opening first-person building.
 let wideTerrainTask=null;
 function ensureWideTerrain(){
  if(disposed)return Promise.resolve();
  if(!wideTerrainTask)wideTerrainTask=loadWideTerrain();
  return wideTerrainTask;
 }
 const ready=Promise.allSettled([loadApprovedMap(),loadMappedRiver()]).then(results=>{
  if(disposed)return;
  const failed=results.filter(x=>x.status==='rejected');
  if(failed.length){
   currentStats.sourceAccuracy='Incomplete landscape: '+failed.map(x=>String(x.reason?.message||x.reason)).join('; ');
   console.warn('Kunlum tower world:',currentStats.sourceAccuracy);
  }
  onReady();
 });
 // Environment remains independent of tower placement and server state.
 return {group,heightAt:terrain.heightAt,ready,update(seconds){river?.update(seconds)},ensureWideTerrain,
  dispose(){
   if(disposed)return;disposed=true;scene.remove(group);
   overlay?.dispose();river?.dispose();riverbank?.dispose();scatter?.dispose();outcrops?.dispose();
   for(const o of geometries)o.dispose();
   for(const m of materials)m.dispose();
   for(const t of textures)t.dispose();
   wideDem?.dispose();pbr.dispose();
  }};

}
