import {validatePlacement,worldDimensions} from './core.mjs';
/** Legacy-grid-compatible camera placement; real mesh contact requires a separate server migration. */
export function suggestCameraPlacement(blocks,stone,camera,previous=null){
 if(!stone||!camera?.origin||!camera?.forward||!camera?.target)return null;
 const candidates=new Map();
 const add=(x,y,z)=>{const b={...stone,x:Math.round(x),y:Math.round(y),z:Math.round(z)};candidates.set([b.x,b.y,b.z].join(','),b);};
 const dims=worldDimensions(stone);
 if(!blocks.length){add(camera.target[0]-dims[0]/2,0,camera.target[2]-dims[2]/2);add(0,0,0);}
 for(const b of blocks){const d=worldDimensions(b);for(const y of [b.y,b.y+d[1],b.y-dims[1]]){add(b.x+d[0],y,b.z);add(b.x-dims[0],y,b.z);add(b.x,y,b.z+d[2]);add(b.x,y,b.z-dims[2]);add(b.x,y,b.z);}}
 const len=v=>Math.hypot(...v),forward=camera.forward,fl=len(forward)||1;
 const rank=b=>{if(!validatePlacement(blocks,b).ok)return -Infinity;const d=worldDimensions(b),c=[b.x+d[0]/2,b.y+d[1]/2,b.z+d[2]/2],v=c.map((x,i)=>x-camera.origin[i]),distance=len(v);if(distance<.001)return -Infinity;const facing=v.reduce((sum,x,i)=>sum+x*forward[i],0)/(distance*fl);if(facing<=0)return -Infinity;return facing*2-.018*len(c.map((x,i)=>x-camera.target[i]))-.002*distance;};
 let best=null,score=-Infinity;for(const b of candidates.values()){const s=rank(b);if(s>score){best=b;score=s;}}
 if(!best||!Number.isFinite(score))return null;
 if(previous){const old=candidates.get([previous.x,previous.y,previous.z].join(','));if(old&&score-rank(old)<.065)return old;}
 return best;
}
