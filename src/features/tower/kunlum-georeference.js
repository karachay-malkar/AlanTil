/**
 * Reversible draft georegistration of a digitised, non-survey Kunlum site plan.
 * Degrees are clockwise in scene East/North ENU (Three.js x/z axes).
 * This is a single-control-point similarity approximation until ≥2
 * IDENTIFIED map features are independently verified in world coordinates.
 */
export const DEFAULT_KUNLUM_ALIGNMENT=Object.freeze({
 schema:"alantil.kunlum.georegistration.v1",
 status:"USER_CALIBRATED_ONE_POINT_UNVERIFIED",
 anchorName:"Abay-Kala — pixel manually selected by user on 2026-10-23 (not independently verified)",
 anchorWgs84:{lat:43.10611388888889,lon:43.42876944444444},
 anchorUTM38N:{easting:372151.107,northing:4773796.751},
 anchorPixel:{x:908,y:460}, // user-selected; NOT independently verified
 pixelsPerMetre:3.7, // user-calibrated; not independently checked
 mirrorWallsX:true, // Only project mapped features mirrored E-W; never reflect 2D map or DEM
 angleDeg:70, // user-calibrated on the 3D preview; not independently checked
 eastOffsetM:0,
 northOffsetM:0,
 controlPointsVerified:0,
 caution:"Never use for historical-accuracy claims or publishing mapped coordinates"
});
export function pixelToLocalWorld(point,a=DEFAULT_KUNLUM_ALIGNMENT){
 const u=(point[0]-a.anchorPixel.x)/a.pixelsPerMetre*(a.mirrorWallsX?-1:1);
 const v=(a.anchorPixel.y-point[1])/a.pixelsPerMetre;
 const t=a.angleDeg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
 return [u*c-v*s+a.eastOffsetM,u*s+v*c+a.northOffsetM];
}
export function localWorldToPixel(world,a=DEFAULT_KUNLUM_ALIGNMENT){
 const x=world[0]-a.eastOffsetM,z=world[1]-a.northOffsetM;
 const t=a.angleDeg*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
 const u=(x*c+z*s)*(a.mirrorWallsX?-1:1),v=-x*s+z*c;
 return [a.anchorPixel.x+u*a.pixelsPerMetre,a.anchorPixel.y-v*a.pixelsPerMetre];
}
export function plotCorners(plot,pixelsPerMetre=plot.ppm){
 // Preserve physical dimensions when the map calibration differs from the draft ppm.
 const width=plot.widthM*pixelsPerMetre,height=plot.heightM*pixelsPerMetre;
 const cx=plot.x+width/2,cy=plot.y+height/2,a=plot.angleDeg*Math.PI/180;
 const c=Math.cos(a),s=Math.sin(a);
 return [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]]
  .map(([x,y])=>[cx+x*c-y*s,cy+x*s+y*c]);
}
export function sampleDemLocal(heights,x,z,step=30,size=121){
 // Heights are registered on 30 m pixel-centre positions from -1800 to +1800.
 // Row zero is north (+z), index centre 60 corresponds to Abay-Kala.
 const gx=x/step+(size-1)/2,gz=(size-1)/2-z/step;
 const ix=Math.max(0,Math.min(size-2,Math.floor(gx))),
  iz=Math.max(0,Math.min(size-2,Math.floor(gz)));
 const fx=Math.max(0,Math.min(1,gx-ix)),fz=Math.max(0,Math.min(1,gz-iz));
 const a=heights[iz*size+ix],b=heights[iz*size+ix+1],
  c=heights[(iz+1)*size+ix],d=heights[(iz+1)*size+ix+1];
 return (a*(1-fx)+b*fx)*(1-fz)+(c*(1-fx)+d*fx)*fz;
}
