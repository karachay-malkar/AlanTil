/** Single authoritative construction parcel, shared by terrain, scene and validation. */
export const KUNLUM_BUILD_PARCEL=Object.freeze({
 minX:0,maxX:15,minZ:0,maxZ:30,
 widthM:15,depthM:30,centerX:7.5,centerZ:15,
 gridStepM:.25,transitionM:12
});
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
