/**
 * Georeferenced Kunlum visual environment for the Tower game.
 * Supports the unchanged 20x20m prefab raycast floor and current tower saves.
 * Render-only. All historic polygons are one-point calibrated and provisional.
 * Does not register landscape as a placement target.
 */
import {makeKunlumTerrain,makeKunlumPanorama} from './kunlum-terrain-lod.js';
import {populateKunlumVectorSettlement} from './kunlum-vector-settlement.js';
import {pixelToLocalWorld,plotCorners,DEFAULT_KUNLUM_ALIGNMENT}
 from './kunlum-georeference.js';

const PLOT={x:1060.6697998046875,y:892.3427734375,
 widthM:30,heightM:15,ppm:3.6,angleDeg:-7};
export function createKunlumRealEnvironment(THREE,scene,{mobile=false,onReady=()=>{}}={}){
 const group=new THREE.Group();
 group.name='Кюнлюм · DEM 30 м + цифровые стены + панорама';
 scene.add(group);
 const materials=[],geometries=[],textures=[];
 let disposed=false;
 const register=(geo,mat,texture)=>{
  if(geo)geometries.push(geo);
  if(mat)materials.push(mat);
  if(texture)textures.push(texture);
 };
 const calibration=DEFAULT_KUNLUM_ALIGNMENT;
 const terrain=makeKunlumTerrain(THREE,group,{mobile,plot:PLOT,calibration,register});
 makeKunlumPanorama(THREE,group,terrain,{mobile,register});
 const P=p=>{const [e,n]=pixelToLocalWorld(p,calibration);return terrain.demToScene(e,n)};
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
 const currentStats={houseContours:0,roofCourtyards:0,courtyards:0,
  confirmedFeatures:0,candidateFeatures:0,sourceAccuracy:'Loading vector plan'};
 group.userData.kunlum={
  plot:[40,50],buildable:[20,20],reserveX:[-10,30],reserveZ:[-15,35],
  gridStep:.25,ruins:currentStats,sitePlan:'user-calibrated kunlum-plan-edited.json',
  monument:'Абай-къала',abaevModelPosition:towerBase,
  terrain:'Copernicus DEM GLO-30, 30m',terrainResolutionNearM:mobile?20:10,
  terrainTriangles:terrain.triangles,panorama:'procedural DEM-border based: not a surveyed skyline',
  accuracy:'UNVERIFIED: one-point user calibration; terraces approximated from DEM; 665 auto traces require review'
 };
 const ready=populateKunlumVectorSettlement(THREE,group,{
  calibration,plot:PLOT,terrain,register,mobile,isDisposed:()=>disposed
 }).then(stats=>{
  if(disposed||!stats)return;
  Object.assign(currentStats,{...stats,courtyards:stats.houseContours});
  onReady();
 }).catch(error=>{
  if(disposed)return;
  currentStats.sourceAccuracy='Failed to load vector plan: '+String(error.message||error);
  console.error('Kunlum vector terrain:',error);
  onReady();
 });
 // Game preserves synchronous contract: the terrain exists before first render,
 // walls load independently without changing placement or save state.
 return {group,heightAt:terrain.heightAt,ready,dispose(){
  if(disposed)return;disposed=true;scene.remove(group);
  for(const o of geometries)o.dispose();
  for(const m of materials)m.dispose();
  for(const t of textures)t.dispose();
 }};
}
