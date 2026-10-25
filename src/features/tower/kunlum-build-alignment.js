/** Derive the game parcel and mapped walls from the single approved 2D plan. */
import {DEFAULT_KUNLUM_ALIGNMENT,pixelToLocalWorld,plotCorners,rotateKunlumPlanPoint} from './kunlum-georeference.js';
import {KUNLUM_BUILD_PARCEL as SITE} from '../../../packages/tower-game/kunlum-parcel.mjs';
export function createKunlumGameAlignment({plot,calibration=DEFAULT_KUNLUM_ALIGNMENT}={}){
 if(!plot||plot.widthM!==SITE.depthM||plot.heightM!==SITE.widthM||
  !Number.isFinite(plot.x)||!Number.isFinite(plot.y)||!Number.isFinite(plot.ppm)||plot.ppm<=0||
  !Number.isFinite(plot.angleDeg))throw Error('Expected authoritative 30x15m 2D plot');
 // The rectangle on the 2D map is drawn at plot.ppm, not the DEM draft scale.
 const survey={...calibration,pixelsPerMetre:plot.ppm};
 if(!survey.mirrorWallsX)throw Error('Kunlum mirrored plan required');
 // Align the 30m map side with world Z, the 15m side with world X.
 const rotation=-90-plot.angleDeg-survey.angleDeg;
 const pixels=plotCorners(plot,plot.ppm);
 const project=p=>rotateKunlumPlanPoint(pixelToLocalWorld(p,survey),rotation);
 const transformed=pixels.map(project);
 const origin=[transformed.reduce((s,p)=>s+p[0],0)/4,transformed.reduce((s,p)=>s+p[1],0)/4];
 const planToScene=p=>{const [x,z]=project(p);return [SITE.centerX+x-origin[0],SITE.centerZ+z-origin[1]]};
 const demToScene=(east,north)=>[SITE.centerX-east-origin[0],SITE.centerZ+north-origin[1]];
 const sceneToDem=(x,z)=>[SITE.centerX-x-origin[0],z-SITE.centerZ+origin[1]];
 return {origin,pixels,rotation,plot,planToScene,demToScene,sceneToDem,
  footprintMetres:[SITE.widthM,SITE.depthM],footprintScene:pixels.map(planToScene)};
}
