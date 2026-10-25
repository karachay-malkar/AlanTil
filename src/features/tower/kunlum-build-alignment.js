/** Single 25x40m parcel shared by georeferenced scene and saved 25cm grid.
 * The one-point calibrated settlement/DEM rotation stays -134 degrees.
 * Parcel angle compensates for the mirrored georeference to align to X/Z grid.
 */
import {DEFAULT_KUNLUM_ALIGNMENT,pixelToLocalWorld,plotCorners,rotateKunlumPlanPoint} from './kunlum-georeference.js';
import {KUNLUM_BUILD_PARCEL as SITE} from '../../../packages/tower-game/kunlum-parcel.mjs';
export const PLOT=Object.freeze({
 // Preserve the old plot centre in original map pixels.
 x:1069.9197998046875,y:846.0927734375,
 widthM:SITE.widthM,heightM:SITE.depthM,ppm:3.6,angleDeg:116
});
export const APPROVED_KUNLUM_ROTATION=-134;
export function createKunlumGameAlignment({plot=PLOT,calibration=DEFAULT_KUNLUM_ALIGNMENT,rotation=APPROVED_KUNLUM_ROTATION}={}){
 const pixels=plotCorners(plot,calibration.pixelsPerMetre);
 const transformed=pixels.map(p=>rotateKunlumPlanPoint(pixelToLocalWorld(p,calibration),rotation));
 const origin=[
  transformed.reduce((v,p)=>v+p[0],0)/transformed.length,
  transformed.reduce((v,p)=>v+p[1],0)/transformed.length
 ];
 const pointInDisplay=p=>rotateKunlumPlanPoint(pixelToLocalWorld(p,calibration),rotation);
 const planToScene=p=>{const [x,z]=pointInDisplay(p);return [SITE.centerX+x-origin[0],SITE.centerZ+z-origin[1]]};
 const demToScene=(east,north)=>[SITE.centerX-east-origin[0],SITE.centerZ+north-origin[1]];
 const sceneToDem=(x,z)=>[SITE.centerX-x-origin[0],z-SITE.centerZ+origin[1]];
 return {origin,pixels,planToScene,demToScene,sceneToDem,
  footprintMetres:[plot.widthM,plot.heightM],footprintScene:pixels.map(planToScene)};
}
