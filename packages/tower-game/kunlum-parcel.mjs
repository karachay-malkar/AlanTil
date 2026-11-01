/** Single authoritative construction parcel, shared by terrain, scene and validation. */
export const KUNLUM_BUILD_PARCEL=Object.freeze({
 minX:0,maxX:15,minZ:0,maxZ:30,
 widthM:15,depthM:30,centerX:7.5,centerZ:15,
 gridStepM:.25,transitionM:12
});
/** Construction camera includes 10m beyond each edge of the building parcel. */
export const TOWER_ORBIT_CONTEXT_METERS=10;
export const TOWER_ORBIT_REGION=Object.freeze({
 minX:KUNLUM_BUILD_PARCEL.minX-10,maxX:KUNLUM_BUILD_PARCEL.maxX+10,
 minZ:KUNLUM_BUILD_PARCEL.minZ-10,maxZ:KUNLUM_BUILD_PARCEL.maxZ+10,
 widthM:KUNLUM_BUILD_PARCEL.widthM+20,depthM:KUNLUM_BUILD_PARCEL.depthM+20
});
export function towerOrbitFramingDistance(aspect,verticalFovDegrees=42){
 const a=Math.max(.3,Number.isFinite(aspect)?aspect:1);
 const vfov=Math.max(20,Math.min(85,verticalFovDegrees))*Math.PI/180;
 const hfov=2*Math.atan(Math.tan(vfov/2)*a);
 return Math.max(TOWER_ORBIT_REGION.depthM/(2*Math.tan(vfov/2)),
  TOWER_ORBIT_REGION.widthM/(2*Math.tan(hfov/2)))*1.30;
}
export const TOWER_ORBIT_MIN_DISTANCE=1.4;
export const towerOrbitMaximumDistance=(aspect,verticalFovDegrees=42)=>
 towerOrbitFramingDistance(aspect,verticalFovDegrees)*1.10;
export function towerOrbitTargetY(elements=[],roofLevels=[]){
 let max=0;
 for(const b of elements){const y=Number(b.y);if(Number.isFinite(y))max=Math.max(max,y*.25);}
 for(const l of roofLevels)if(Number.isFinite(l))max=Math.max(max,l*.25);
 return Math.min(12,Math.max(.65,max*.45));
}
export function isWithinKunlumParcel(x,z){
 const p=KUNLUM_BUILD_PARCEL;
 return Number.isFinite(x)&&Number.isFinite(z)&&
  x>=p.minX-1e-7&&x<=p.maxX+1e-7&&z>=p.minZ-1e-7&&z<=p.maxZ+1e-7;
}
export function kunlumTerraceBlend(x,z){
 const p=KUNLUM_BUILD_PARCEL;
 const dx=Math.max(p.minX-x,0,x-p.maxX),dz=Math.max(p.minZ-z,0,z-p.maxZ);
 const t=Math.max(0,Math.min(1,Math.hypot(dx,dz)/p.transitionM));
 return t*t*(3-2*t);
}
