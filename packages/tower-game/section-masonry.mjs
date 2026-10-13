/** Deterministic authored-rock layout in continuous 25cm section cells.
 * Visual subdivision only. Server purchases require a separate validated RPC.
 * Preserve old tower catalog/index order; prices are intentionally unset. */
export const SECTION_GEOMETRY_VERSION=1;
export const SECTION_CATALOG=Object.freeze([
 ['1x1x1',[1,1,1]],['2x2x2',[2,2,2]],['2x2x3',[2,2,3]],['2x3x4',[2,3,4]],['4x4x4',[4,4,4]]
].map(([key,size])=>Object.freeze({key,size:Object.freeze(size),priceSilver:null})));
const FAMILIES={small:'stone',medium:'medium',long:'long',big:'big'},COUNTS={small:7,medium:5,long:4,big:7};
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function random(seed,index){let x=(seed^Math.imul(index+1,0x9e3779b1))>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
function worldSize(b){const d=[b.sx,b.sy,b.sz];switch(b.rotation||0){case 1:case 3:return[d[2],d[1],d[0]];case 4:return[d[1],d[0],d[2]];case 5:return[d[0],d[2],d[1]];case 6:return[d[1],d[2],d[0]];case 7:return[d[2],d[0],d[1]];default:return d;}}
function partition(length,desired,seed){
 const count=Math.max(1,Math.min(Math.max(1,Math.floor(length/.61)),Math.round(length/desired)));
 if(count===1)return[length];
 const weights=Array.from({length:count},(_,i)=>.84+.32*random(seed,i)),sum=weights.reduce((a,b)=>a+b,0);
 let used=0;
 return weights.map((w,i)=>{const v=i===count-1?length-used:length*w/sum;used+=v;return v;});
}
function familyFor(d,seed){const v=[...d].sort((a,b)=>b-a);if(v[2]>=1.35)return'big';if(v[0]/Math.max(.001,v[2])>1.72)return'long';if(v[0]>1.08&&random(seed,17)>.38)return'medium';return'small';}
export function generateSectionStones(parent,{rockCounts=COUNTS,maxStones=600}={}){
 if(!parent||typeof parent.id!=='string'||!parent.id||![parent.x,parent.y,parent.z,parent.sx,parent.sy,parent.sz].every(Number.isFinite)||
  [parent.sx,parent.sy,parent.sz].some(v=>v<=0||v>80)||!Number.isInteger(parent.rotation||0)||(parent.rotation||0)<0||(parent.rotation||0)>7)
  throw new TypeError('Invalid masonry section envelope');
 const dims=worldSize(parent),seed=hash(parent.id+':'+SECTION_GEOMETRY_VERSION+':'+dims.join(',')),out=[],ys=partition(dims[1],.96,seed^0x1199);
 let y=parent.y;
 for(let layer=0;layer<ys.length;layer++){
  const height=ys[layer],zs=partition(dims[2],.99,seed^Math.imul(layer+1,713));let z=parent.z;
  for(let band=0;band<zs.length;band++){
   const depth=zs[band],xs=partition(dims[0],.99,seed^Math.imul(layer+1,1009)^Math.imul(band+1,761));let x=parent.x;
   for(let column=0;column<xs.length;column++){
    const width=xs[column],ordinal=out.length,stoneSeed=hash(parent.id+'/'+ordinal+':'+layer+':'+band),family=familyFor([width,height,depth],stoneSeed);
    const count=Number(rockCounts[family])||0;
    if(!Number.isInteger(count)||count<=0)throw new TypeError('Invalid authored stone catalogue for '+family);
    out.push({id:parent.id+'/rock-'+ordinal,parent,type:FAMILIES[family],variant:Math.floor(random(stoneSeed,13)*count),x,y,z,sx:width,sy:height,sz:depth,rotation:0});
    if(out.length>maxStones)throw new RangeError('Section exceeds render stone budget');
    x+=width;
   }
   z+=depth;
  }
  y+=height;
 }
 return out;
}
export function sectionEnvelope(parent){const size=worldSize(parent),min=[parent.x,parent.y,parent.z];return{min,max:min.map((v,i)=>v+size[i]),size};}
/** Only validates rectangular envelopes, NOT actual irregular mesh occupancy. */
export function validateSectionLayout(parent,stones,{epsilon=1e-7}={}){
 const size=worldSize(parent),start=[parent.x,parent.y,parent.z];let volume=0,overlap=0,outOfBounds=0;
 for(let i=0;i<stones.length;i++){
  const a=stones[i];volume+=a.sx*a.sy*a.sz;const lo=[a.x,a.y,a.z],hi=lo.map((n,k)=>n+[a.sx,a.sy,a.sz][k]);
  if(lo.some((v,k)=>v<start[k]-epsilon)||hi.some((v,k)=>v>start[k]+size[k]+epsilon))outOfBounds++;
  for(let j=0;j<i;j++){const b=stones[j],d=[Math.min(a.x+a.sx,b.x+b.sx)-Math.max(a.x,b.x),Math.min(a.y+a.sy,b.y+b.sy)-Math.max(a.y,b.y),Math.min(a.z+a.sz,b.z+b.sz)-Math.max(a.z,b.z)];if(d.every(v=>v>epsilon))overlap++;}
 }
 const coverage=volume/size.reduce((a,b)=>a*b,1);
 return{ok:outOfBounds===0&&overlap===0&&Math.abs(coverage-1)<epsilon,bounds:{min:start,size},coverage,overlap,outOfBounds,stones:stones.length};
}
