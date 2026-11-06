import {writeFileSync} from 'node:fs';
import {ABAY_KALA_HEIGHT} from '../../src/features/tower/kunlum-monument.js';
import {kunlumRuinCrown,kunlumRuinFoot} from '../../src/features/tower/kunlum-wall-ground.js';

const folder=new URL('../../assets/tower/approved-library/lod-review/',import.meta.url);
const path=[[-9,0],[-3,0],[3,-1],[9,-1]];
const width=.72,height=2.1;
const ground=(x,z)=>.04*x+.06*z;
const fence=[],tower=[];
function quad(target,a,b,c,d){
 target.push(...a,...b,...c,...a,...c,...d);
}

const stations=path.flatMap(([x,z],index)=>{
 const next=path[index+1];
 if(!next)return [[x,z]];
 return Array.from({length:5},(_,i)=>[x+(next[0]-x)*i/5,z+(next[1]-z)*i/5]);
});
const rings=stations.map(([x,z],i)=>{
 const a=stations[Math.max(0,i-1)],b=stations[Math.min(i+1,stations.length-1)];
 const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
 const nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;
 const top=ground(x,z)+kunlumRuinCrown(height,x,z);
 const bottom=kunlumRuinFoot(x,z,width,ground,[nx,nz]);
 const edge=(side,y)=>[x+nx*side*width/2,y,z+nz*side*width/2];
 return [edge(1,bottom),edge(-1,bottom),edge(-1,top),edge(1,top)];
});
for(let i=1;i<rings.length;i++){
 const a=rings[i-1],b=rings[i];
 for(let j=0;j<4;j++){
  const k=(j+1)%4;
  quad(fence,a[k],b[k],b[j],a[j]);
 }
}
quad(fence,...rings[0].slice().reverse());
quad(fence,...rings.at(-1));

const H=ABAY_KALA_HEIGHT;
const levels=[0,2.6,5.3,7,9.5,11.1,H];
const spans=[0,.41,.451,.5,.549,.59,1];
function point(side,u,y,inset=0){
 const half=(6+(4.65-6)*y/H)/2;
 const q=(u-.5)*2*half;
 return [[q,y,half-inset],[-q,y,-half+inset],[half-inset,y,q],[-half+inset,y,-q]][side];
}
function opening(u,y){
 return (y<2.6&&Math.abs(u-.5)<.09)||
  ((y>5.3&&y<7||y>9.5&&y<11.1)&&Math.abs(u-.5)<.049);
}
for(let side=0;side<4;side++){
 for(let i=1;i<levels.length;i++)for(let j=1;j<spans.length;j++){
  const y0=levels[i-1],y1=levels[i],u0=spans[j-1],u1=spans[j];
  if(side===0&&opening((u0+u1)/2,(y0+y1)/2))continue;
  const face=[point(side,u0,y0),point(side,u1,y0),point(side,u1,y1),point(side,u0,y1)];
  quad(tower,...(side<2?face:face.reverse()));
 }
}
for(const [lo,hi,bottom,top] of [[.41,.59,0,2.6],[.451,.549,5.3,7],[.451,.549,9.5,11.1]]){
 const corners=[[lo,bottom],[hi,bottom],[hi,top],[lo,top]];
 for(let i=0;i<4;i++){
  const a=corners[i],b=corners[(i+1)%4];
  quad(tower,point(0,...a),point(0,...b),point(0,...b,.45),point(0,...a,.45));
 }
}
quad(tower,point(0,0,H),point(0,1,H),point(1,0,H),point(1,1,H));
const round=values=>values.map(x=>Number(x.toFixed(4)));
writeFileSync(new URL('models.json',folder),JSON.stringify({path,width,height,fence:round(fence),tower:round(tower)})+'\n');
