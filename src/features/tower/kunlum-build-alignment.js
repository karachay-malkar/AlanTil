/** One metre-accurate frame for the approved yellow Kunlum rectangle.
 * Historical pixel plan is rotated -134 degrees exactly as in the review;
 * mirrored Copernicus/Mapzen DEM is sampled in the same display frame.
 * Local game origin (10,10) is the yellow rectangle CENTRE.
 * Saved 80x80 cell coordinates are intentionally never transformed.
 */
import {DEFAULT_KUNLUM_ALIGNMENT,pixelToLocalWorld,plotCorners,rotateKunlumPlanPoint} from './kunlum-georeference.js';
export const PLOT=Object.freeze({
 x:1060.6697998046875,y:892.3427734375,
 widthM:30,heightM:15,ppm:3.6,angleDeg:-7
});
export const APPROVED_KUNLUM_ROTATION=-134;
export function createKunlumGameAlignment({
 plot=PLOT,calibration=DEFAULT_KUNLUM_ALIGNMENT,
 rotation=APPROVED_KUNLUM_ROTATION
}={}){
 const pixels=plotCorners(plot,calibration.pixelsPerMetre);
 const transformed=pixels.map(p=>rotateKunlumPlanPoint(pixelToLocalWorld(p,calibration),rotation));
 const origin=[
  transformed.reduce((v,p)=>v+p[0],0)/transformed.length,
  transformed.reduce((v,p)=>v+p[1],0)/transformed.length
 ];
 const pointInDisplay=p=>rotateKunlumPlanPoint(pixelToLocalWorld(p,calibration),rotation);
 const planToScene=p=>{const [x,z]=pointInDisplay(p);return [10+x-origin[0],10+z-origin[1]]};
 const demToScene=(east,north)=>[10-east-origin[0],10+north-origin[1]];
 const sceneToDem=(x,z)=>[10-x-origin[0],z-10+origin[1]];
 return {origin,pixels,planToScene,demToScene,sceneToDem,
  footprintMetres:[plot.widthM,plot.heightM],
  savedBuildableMetres:[20,20],
  // This is deliberate: it is impossible to contain a 20x20m square within
  // an approved 30x15m rectangle without changing or corrupting save geometry.
  legacyBuildFitsYellow:false,
  footprintScene:pixels.map(planToScene)
 };
}
