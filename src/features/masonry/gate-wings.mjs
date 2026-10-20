/** Editable side wings outside the existing gate pillars; no stone enters the opening. */
const round=x=>Math.round(x*1e6)/1e6;
export const WING_WIDTH=.75;
export const WING_HEIGHT=2.5;
export const WING_DEPTH=.5;
const COU=10;
export function buildGateWings({manifest,dimensionsFor,gateWidth=4.5,centerX=0,existing=[]}){
 if(!(gateWidth>0)||!Number.isFinite(centerX))throw new Error('Неверные размеры ворот');
 const models=manifest.models.filter(m=>m.category==='main');
 const candidates=models.map(m=>({name:m.name,size:dimensionsFor(m.name)}))
  .filter(c=>c.size?.every(v=>Number.isFinite(v)&&v>.03)&&c.size[1]<.65);
 if(!candidates.length)throw new Error('В Common 100 нет подходящих камней для боковой кладки');
 const stones=[];
 const pick=(w,h,d,seed)=>{
  const ranked=[...candidates].sort((a,b)=>{
   const dist=c=>Math.abs(Math.log(c.size[0]/w))*.5+Math.abs(Math.log(c.size[1]/h))+
      Math.abs(Math.log(c.size[2]/d))*.4;
   return dist(a)-dist(b);
  });
  return ranked[seed%Math.min(6,ranked.length)];
 };
 // Offset neighboring courses to break continuous vertical joints.
 const courseHeight=WING_HEIGHT/COU;
 for(const side of [-1,1]){
  for(let row=0;row<2;row++){
   const depth=WING_DEPTH/2;
   const z=(row-.5)*depth;
   for(let course=0;course<COU;course++){
    const widths=(course+row)%2===0?[.40,.35]:[.32,.43];
    let offset=0;
    for(let col=0;col<widths.length;col++){
     const width=widths[col],p=pick(width,courseHeight,depth,course+col+row*2+(side+1)*3);
     const [sx,sy,sz]=p.size;
     const scale=[round(width/sx),round(courseHeight/sy),round(depth/sz)];
     if(scale.some(v=>v<=.01||v>20))continue;
     const x=centerX+side*(gateWidth/2+.005+offset+width/2);
     const y=(course+.5)*courseHeight,zPos=z;
     offset+=widths[col];
     stones.push({
      id:crypto.randomUUID(),name:p.name,position:[round(x),round(y),round(zPos)],
      quaternion:[0,0,0,1],scale,source:'gate-wing'
     });
    }
   }
  }
 }
 // Preserve previously placed stones; repeated button presses must not duplicate wings.
 if(existing.some(s=>s.source==='gate-wing'))throw new Error('Боковая кладка уже добавлена');
 return {stones,fullWidth:gateWidth+WING_WIDTH*2};
}
