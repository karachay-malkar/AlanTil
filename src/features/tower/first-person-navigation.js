/** Continuous first-person movement inside the authoritative 15x30m parcel. */
import {KUNLUM_BUILD_PARCEL as SITE} from '../../../packages/tower-game/kunlum-parcel.mjs';
export const TOWER_EXPLORER=Object.freeze({
 minX:SITE.minX,maxX:SITE.maxX,minZ:SITE.minZ,maxZ:SITE.maxZ,
 radius:.32,eyeHeight:1.7,maxHeight:15,
 walkingSpeed:3.2,flyingSpeed:4,verticalSpeed:1.25
});
const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const valid=n=>Number.isFinite(n)?n:0;
const intersects=(x,y,z,obstacles,config)=>{
 const bottom=y-config.eyeHeight+.08,top=y+.1,r=config.radius;
 return obstacles.some(b=>x+r>b.min.x&&x-r<b.max.x&&
  z+r>b.min.z&&z-r<b.max.z&&bottom<b.max.y&&top>b.min.y);
};
/** Prevent the orbit camera from crossing even the dynamically incised terrain. */
export function constrainTowerCamera(point,groundAt,clearance=.5){
 const x=valid(point.x),z=valid(point.z);
 return {x,y:Math.max(valid(point.y),valid(groundAt(x,z))+clearance),z};
}
/** Refuse landing when the capsule would overlap any existing authored stone. */
export function canTowerExplorerLand(position,groundAt,obstacles=[],config=TOWER_EXPLORER){
 const x=valid(position.x),z=valid(position.z);
 const y=valid(groundAt(x,z))+config.eyeHeight;
 return !intersects(x,y,z,obstacles,config);
}
/**
 * Collision is a swept-by-small-steps capsule approximation against real
 * prefab bounds; separate X/Z steps allow the player to slide along walls.
 * Ground collision and altitude limits are independent of rendered materials.
 */
export function moveTowerExplorer(position,input,yaw,dt,{
 groundAt=()=>0,fly=false,obstacles=[],config=TOWER_EXPLORER
}={}){
 const t=clamp(valid(dt),0,.05),a=clamp(valid(input?.forward),-1,1),
  b=clamp(valid(input?.strafe),-1,1),up=clamp(valid(input?.up),-1,1);
 const length=Math.max(1,Math.hypot(a,b)),speed=fly?config.flyingSpeed:config.walkingSpeed;
 const distance=t*speed/length,sy=Math.sin(yaw),cy=Math.cos(yaw);
 const dx=(-sy*a+cy*b)*distance,dz=(-cy*a-sy*b)*distance;
 const loX=config.minX+config.radius,hiX=config.maxX-config.radius;
 const loZ=config.minZ+config.radius,hiZ=config.maxZ-config.radius;
 let x=clamp(valid(position.x),loX,hiX),z=clamp(valid(position.z),loZ,hiZ);
 let y=valid(position.y);
 const baseY=valid(groundAt(x,z));
 const candidateY=fly?clamp(y+up*t*config.verticalSpeed,baseY+config.eyeHeight,baseY+config.maxHeight):
  baseY+config.eyeHeight;
 // Block both ascending through overhangs and descending through roofs.
 if(!intersects(x,candidateY,z,obstacles,config))y=candidateY;
 // Vertical flight must respect stone roofs and lintels, not only terrain.
 // The prior height is used as the collision-safe fallback when descending.
 if(intersects(x,y,z,obstacles,config))y=clamp(valid(position.y),baseY+config.eyeHeight,baseY+config.maxHeight);
 const nextX=clamp(x+dx,loX,hiX);
 if(!intersects(nextX,y,z,obstacles,config))x=nextX;
 const nextZ=clamp(z+dz,loZ,hiZ);
 if(!intersects(x,y,nextZ,obstacles,config))z=nextZ;
 const ground=valid(groundAt(x,z));
 const finalY=fly?clamp(y,ground+config.eyeHeight,ground+config.maxHeight):ground+config.eyeHeight;
 if(!intersects(x,finalY,z,obstacles,config))y=finalY;
 return {x,y,z};
}
