/** Centimetre-scale landscape erosion, fading out at the build plot and terrain LOD seams.
 * Applied to both vertex sampling and ground queries: never change saved buildings or DEM.
 */
import {KUNLUM_BUILD_PARCEL as SITE} from '../../../packages/tower-game/kunlum-parcel.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
function hash(x,z,seed){
 let h=Math.imul(x,374761393)^Math.imul(z,668265263)^Math.imul(seed,1442695041);
 h=Math.imul(h^(h>>>13),1274126177);
 return ((h^(h>>>16))>>>0)/4294967295;
}
function noise(x,z,seed){
 const i=Math.floor(x),j=Math.floor(z),a=smooth(x-i),b=smooth(z-j);
 return mix(mix(hash(i,j,seed),hash(i+1,j,seed),a),
  mix(hash(i,j+1,seed),hash(i+1,j+1,seed),a),b);
}
/** 0 in the 2m safe band, 1 on nearby slopes, 0 at the 15m terrain tile boundary. */
export function kunlumMicroreliefWeight(x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))throw Error('Microrelief coordinates must be finite');
 const dx=Math.max(SITE.minX-x,0,x-SITE.maxX);
 const dz=Math.max(SITE.minZ-z,0,z-SITE.maxZ);
 const distance=Math.hypot(dx,dz);
 return smooth((distance-2)/3)*(1-smooth((distance-11)/4));
}
/** Deterministic sub-8.3cm soil unevenness; suppress displacement in excavated riverbeds. */
export function kunlumMicrorelief(x,z,riverCut=0){
 if(!Number.isFinite(riverCut))throw Error('River cut depth must be finite');
 const weight=kunlumMicroreliefWeight(x,z)*(1-smooth((Math.max(0,riverCut)-.02)/.12));
 if(weight===0)return 0;
 return weight*(.11*(noise(x*.22,z*.22,31)-.5)+.055*(noise(x*.47,z*.47,79)-.5));
}
