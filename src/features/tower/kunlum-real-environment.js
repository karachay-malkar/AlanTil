/**
 * Georeferenced Kunlum visual environment for the Tower game.
 * Supports the unchanged 20x20m prefab raycast floor and current tower saves.
 * Render-only. All historic polygons are one-point calibrated and provisional.
 * Does not register landscape as a placement target.
 */
import {makeKunlumTerrain,makeKunlumPanorama} from './kunlum-terrain-lod.js';
import {createKunlumMapOverlay} from './kunlum-map-overlay.js';
import {createKunlumNativeTerrainPBR} from './kunlum-game-landscape.js';
import {loadKunlumCherekLocal,createKunlumRiverLayer,riverDistanceAt} from './kunlum-river-layer.js';
import {createKunlumTerrainScatter,createKunlumRockOutcrops,createKunlumRiverbankScatter} from './kunlum-terrain-scatter.js';
import {pixelToLocalWorld,plotCorners,rotateKunlumPlanPoint,DEFAULT_KUNLUM_ALIGNMENT}
 from './kunlum-georeference.js';

const PLOT={x:1060.6697998046875,y:892.3427734375,
 widthM:30,heightM:15,ppm:3.6,angleDeg:-7};
export function createKunlumRealEnvironment(THREE,scene,{mobile=false,onReady=()=>{}}={}){
 const group=new THREE.Group();
 group.name='Кюнлюм · актуальный DEM PBR, план 120, Черек OSM';
 scene.add(group);
 const materials=[],geometries=[],textures=[];
 let disposed=false;
 const register=(geo,mat,texture)=>{
  if(geo)geometries.push(geo);
  if(mat)materials.push(mat);
  if(texture)textures.push(texture);
 };
 const calibration=DEFAULT_KUNLUM_ALIGNMENT;
 // The tower engine keeps its own untouched 20x20m plane and grid.
 // Only scenic geometry uses the same east/west mirroring as the latest review.
 const pbr=createKunlumNativeTerrainPBR(THREE,{mobile});
 const terrain=makeKunlumTerrain(THREE,group,{
  mobile,plot:PLOT,calibration,register,mirrorDemX:true,pbr
 });
 makeKunlumPanorama(THREE,group,terrain,{mobile,register});
 // Approved -134 degree settlement rotation is visual-only; source coordinates
 // and the playable plot have NOT been moved.
 const P=p=>{
  const [displayEast,north]=rotateKunlumPlanPoint(pixelToLocalWorld(p,calibration),-134);
  // The approved historical plan is already mirrored in its own calibration.
  // Only the DEM needs an X mirror; mirroring these wall coordinates again
  // would move the village away from the validated 3D preview.
  return [displayEast+terrain.centerEast+10,north-terrain.centerNorth+10];
 };
 const towerBase=P([calibration.anchorPixel.x,calibration.anchorPixel.y]);
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
  group.add(tower);register(g,m);
 }
 createMonument();
 // The current placeable 20m square is not affected. The outer envelope is
 // a visual marker for the legacy gameplay reserve, not a build permission.
 function addPerimeter(){
  const coords=[];
  const corners=[[-10,-15],[30,-15],[30,35],[-10,35]];
  for(let i=0;i<4;i++){
   const a=corners[i],b=corners[(i+1)%4];
   coords.push(a[0],.10,a[1],b[0],.10,b[1]);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
  const m=new THREE.LineBasicMaterial({color:'#ccb88d',transparent:true,opacity:.65});
  group.add(new THREE.LineSegments(g,m));register(g,m);
 }
 addPerimeter();
 // Separate the historic-plan 30×15m rectangle from the existing playable
 // 20×20m cell grid. They have different purposes; neither changes saved builds.
 const planned=plotCorners(PLOT,calibration.pixelsPerMetre).map(P);
 const footprint=[];
 for(let i=0;i<4;i++){
  const a=planned[i],b=planned[(i+1)%4];
  footprint.push(a[0],terrain.heightAt(...a)+.14,a[1],
   b[0],terrain.heightAt(...b)+.14,b[1]);
 }
 const footprintGeometry=new THREE.BufferGeometry();
 footprintGeometry.setAttribute('position',new THREE.Float32BufferAttribute(footprint,3));
 const footprintMaterial=new THREE.LineBasicMaterial({color:'#f0a75c',depthTest:false});
 group.add(new THREE.LineSegments(footprintGeometry,footprintMaterial));
 register(footprintGeometry,footprintMaterial);
 const currentStats={houseContours:0,roofCourtyards:0,courtyards:0,
  confirmedFeatures:0,candidateFeatures:0,sourceAccuracy:'Loading vector plan'};
 group.userData.kunlum={
  plot:[PLOT.widthM,PLOT.heightM],buildable:[20,20],reserveX:[-10,30],reserveZ:[-15,35],
  gridStep:.25,ruins:currentStats,sitePlan:'kunlum-vector-plan-2026-10-23.json',
  monument:'Абай-къала',abaevModelPosition:towerBase,
  terrain:'Copernicus DEM GLO-30 + PBR, 30m source',terrainResolutionNearM:mobile?12:8,
  terrainTriangles:terrain.triangles,panorama:'procedural DEM-border based: not a surveyed skyline',
  accuracy:'UNVERIFIED: one-point user calibration; rendered scenery does not modify DEM or saved builds'
 };

 // Both datasets are versioned and bundled with the same published tower branch.
 // No live OSM request, no dynamically generated fake substitute river.
 let river=null,riverbank=null,scatter=null,outcrops=null,overlay=null;
 let localLine=[],planData=null;
 async function loadApprovedMap(){
  const response=await fetch('/assets/tower/environment/kunlum-vector-plan-2026-10-23.json');
  if(!response.ok)throw Error('Approved Kunlum plan: HTTP '+response.status);
  const source=await response.json();
  if(source.confirmed_features?.length!==120||source.openings?.length!==42||
     source.auto_candidates?.length!==702)throw Error('Unexpected current settlement plan');
  if(disposed)return;
  planData=source;
  overlay=createKunlumMapOverlay(THREE,source,{toWorld:P,heightAt:terrain.heightAt,
   excludeBounds:{minX:-10.75,maxX:30.75,minZ:-15.75,maxZ:35.75}});
  overlay.setVisibility({confirmedVisible:true,candidatesVisible:false,passagesVisible:true});
  group.add(overlay.root);
  Object.assign(currentStats,{...overlay.counters,courtyards:overlay.counters.houses,
   sourceAccuracy:'Approved user-drawn vector plan (one-point registration)'});
  if(localLine.length)installScenery();
  onReady();
 }
 async function loadMappedRiver(){
  const source=await loadKunlumCherekLocal({url:'/assets/tower/environment/kunlum-cherek-balkarsky-osm.json'});
  if(disposed)return;
  localLine=source.line.filter(p=>Math.abs(p.x)<=1750&&Math.abs(p.z)<=1750)
   .map(({x,z})=>{const [sx,sz]=terrain.demToScene(x,z);return {x:sx,z:sz}});
  if(localLine.length<2)throw Error('Mapped Cherek reach outside Copernicus DEM');
  terrain.setRiverLine(localLine); // visible vertices only, immutable source DEM
  // Existing tower raycasting still checks ONLY construction prefabs and floor.
  river=createKunlumRiverLayer(THREE,terrain.surfaceAt,{
   quality:mobile?'interactive':'beautiful',mobile,centerline:localLine
  });
  group.add(river.root);
  riverbank=createKunlumRiverbankScatter(THREE,terrain.surfaceAt,{
   points:river.points,mobile,features:planData?.confirmed_features||[],
   toWorld:p=>{const [x,z]=P(p);return [-x,z]}
  });
  group.add(riverbank.root);
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
  scatter=createKunlumTerrainScatter(THREE,terrain.heightAt,{
   ...options,range:mobile?450:580,
   excludedBounds:{minX:-10,maxX:30,minZ:-15,maxZ:35}
  });
  outcrops=createKunlumRockOutcrops(THREE,terrain.heightAt,{
   ...options,bounds:{minX:-1600,maxX:1600,minZ:-1600,maxZ:1600}
  });
  group.add(scatter.root,outcrops.root);
  onReady();
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
 return {group,heightAt:terrain.heightAt,ready,update(seconds){river?.update(seconds)},
  dispose(){
   if(disposed)return;disposed=true;scene.remove(group);
   overlay?.dispose();river?.dispose();riverbank?.dispose();scatter?.dispose();outcrops?.dispose();
   for(const o of geometries)o.dispose();
   for(const m of materials)m.dispose();
   for(const t of textures)t.dispose();
   pbr.dispose();
  }};

}
