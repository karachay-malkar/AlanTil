/** Far-distance wall shell: visible outer masonry faces only.
 * It combines small sets of stones, not an opaque wall core or a village-wide mesh.
 * Original archaeological polylines and existing authored stone recipes are untouched.
 */
import {layoutKunlumRuinStones} from './kunlum-ruin-layout.js?v=17.2.75';
import {getApprovedStoneSurfaceGeometry} from './rock-surface.js?v=balkaria-stone-v2.1-light-ochre.2';

export function makeKunlumRuinShell(THREE,segments,{aggregate=3}={}){
 const positions=[];
 const tri=(a,b,c)=>positions.push(...a,...b,...c);
 for(const seg of segments){
  const dx=seg.b[0]-seg.a[0],dz=seg.b[1]-seg.a[1],length=Math.hypot(dx,dz);
  if(length<.01)continue;
  const tx=dx/length,tz=dz/length,nx=-tz,nz=tx;
  const stones=layoutKunlumRuinStones(seg);
  let offset=0;
  while(offset<stones.length){
   const row=stones[offset].row;
   let end=offset+1;
   while(end<stones.length&&stones[end].row===row)end++;
   for(let i=offset;i<end;i+=aggregate){
    const slice=stones.slice(i,Math.min(end,i+aggregate));
    const first=slice[0],last=slice.at(-1);
    const highest=slice.reduce((a,b)=>a.y+a.height*.5>=b.y+b.height*.5?a:b);
    const crestAlong=(highest.x-seg.a[0])*tx+(highest.z-seg.a[1])*tz;
    const crestY=highest.y+highest.height*.5;
    const y0=first.y-first.height*.5,y1=last.y-last.height*.5;
    const t0=first.y+first.height*.5,t1=last.y+last.height*.5;
    const begin=(first.x-seg.a[0])*tx+(first.z-seg.a[1])*tz-first.width*.5;
    const finish=(last.x-seg.a[0])*tx+(last.z-seg.a[1])*tz+last.width*.5;
    if(finish-begin<.04)continue;
    const face=(along,off,y)=>[seg.a[0]+tx*along+nx*off,y,seg.a[1]+tz*along+nz*off];
    const inset=Math.min(.025,(finish-begin)*.06);
    const height=Math.max(.08,(t0+t1)*.5-(y0+y1)*.5);
    for(const side of [-1,1]){
     const edge=side*seg.width*.39,centre=edge+side*.055;
     const a=face(begin+inset,edge,y0),b=face(finish-inset,edge,y1);
     const c=face(finish-inset,edge,t1),d=face(begin+inset,edge,t0);
     const m=face((begin+finish)*.5,centre,(y0+y1+t0+t1)*.25+height*.06);
     const crown=face(crestAlong,edge,crestY);
     tri(a,b,m);tri(b,c,m);tri(c,crown,m);tri(crown,d,m);tri(d,a,m);
    }
    // The damaged top is truly open stone geometry, not a solid rectangular prism.
    const la=face(begin+inset,-seg.width*.39,t0);
    const lb=face(finish-inset,-seg.width*.39,t1);
    const ra=face(begin+inset,seg.width*.39,t0);
    const rb=face(finish-inset,seg.width*.39,t1);
    const ridge=face(crestAlong,0,crestY);
    tri(la,ra,ridge);tri(ra,rb,ridge);
    tri(rb,lb,ridge);tri(lb,la,ridge);
   }
   offset=end;
  }
 }
 if(!positions.length)return null;
 const raw=new THREE.BufferGeometry();
 raw.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 raw.computeVertexNormals();
 const geometry=getApprovedStoneSurfaceGeometry(raw);
 raw.dispose();
 geometry.computeBoundingSphere();
 return geometry;
}
