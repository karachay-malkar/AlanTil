/** Deterministic, joint-aware authored-rock masonry. Coordinates use 25 cm cells.
 * Sections are ownership/extent envelopes; continuous stones may bridge seams.
 * No geometry primitive or wallet mutation is created here. */
export const SECTION_GEOMETRY_VERSION=2;
export const SECTION_CATALOG=Object.freeze([
 ['1x1x1',[1,1,1]],['2x2x2',[2,2,2]],['2x2x3',[2,2,3]],['2x3x4',[2,3,4]],['4x4x4',[4,4,4]]
].map(([key,size])=>Object.freeze({key,size:Object.freeze(size),priceSilver:null})));
const FAMILIES={small:'stone',medium:'medium',long:'long',big:'big'},COUNTS={small:7,medium:5,long:4,big:7},EPS=1e-6;
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0;}
function random(seed,index){let x=(seed^Math.imul(index+1,0x9e3779b1))>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
function worldSize(b){const d=[b.sx,b.sy,b.sz];switch(b.rotation||0){case 1:case 3:return[d[2],d[1],d[0]];case 4:return[d[1],d[0],d[2]];case 5:return[d[0],d[2],d[1]];case 6:return[d[1],d[2],d[0]];case 7:return[d[2],d[0],d[1]];default:return d;}}
export function sectionEnvelope(parent){const size=worldSize(parent),min=[parent.x,parent.y,parent.z];return{min,max:min.map((v,i)=>v+size[i]),size};}
const volume=b=>b.sx*b.sy*b.sz;
function ensureSections(sections){
 if(!Array.isArray(sections)||sections.length>250)throw new TypeError('Invalid masonry section list');
 const ids=new Set();
 for(const s of sections){
  if(!s||typeof s.id!=='string'||!s.id||ids.has(s.id)||![s.x,s.y,s.z,s.sx,s.sy,s.sz].every(Number.isFinite)||
   [s.sx,s.sy,s.sz].some(v=>v<=0||v>80)||!Number.isInteger(s.rotation||0)||(s.rotation||0)<0||(s.rotation||0)>7)
   throw new TypeError('Invalid masonry section envelope');
  ids.add(s.id);
 }
 const sorted=[...sections].sort((a,b)=>a.y-b.y||a.z-b.z||a.x-b.x||a.id.localeCompare(b.id));
 for(let i=0;i<sorted.length;i++)for(let j=0;j<i;j++){
  const a=sectionEnvelope(sorted[i]),b=sectionEnvelope(sorted[j]);
  if(a.min.every((v,k)=>Math.min(a.max[k],b.max[k])-Math.max(v,b.min[k])>EPS))
   throw new RangeError('Overlapping masonry sections are not authoritative');
 }
 return sorted;
}
function edges(sections,axis){const list=[];for(const s of sections){const box=sectionEnvelope(s);list.push(box.min[axis],box.max[axis]);}return [...new Set(list)].sort((a,b)=>a-b);}
function splitSpan(lo,hi,target,seed){
 const length=hi-lo;if(length<EPS)return [lo,hi];
 const n=Math.max(1,Math.ceil(length/target));
 const weights=Array.from({length:n},(_,i)=>.86+.28*random(seed,i));
 const total=weights.reduce((a,b)=>a+b,0),out=[lo];let used=0;
 for(let i=0;i<n-1;i++){used+=weights[i]/total*length;out.push(lo+used);}
 out.push(hi);return out;
}
function intervalUnion(ranges){
 const sorted=ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
 for(const pair of sorted){const last=merged[merged.length-1];if(last&&pair[0]<=last[1]+EPS)last[1]=Math.max(last[1],pair[1]);else merged.push([...pair]);}
 return merged;
}
function insideYZ(s,y0,y1,z0,z1){const b=sectionEnvelope(s);return b.min[1]<=y0+EPS&&b.max[1]>=y1-EPS&&b.min[2]<=z0+EPS&&b.max[2]>=z1-EPS;}
function selectFamily(dim,seed){
 const d=[...dim].sort((a,b)=>b-a);const slender=d[0]/Math.max(.001,d[2]);
 if(d[2]>=1.38&&d[0]>1.7)return 'big';
 if(slender>1.7)return 'long';
 if(d[0]>=1.04&&d[2]>=.62)return 'medium';
 return 'small';
}
function faceReach(mesh){
 if(!mesh?.positions?.length)return 0;
 const p=mesh.positions,n=p.length/3;let reach=0;
 for(let axis=0;axis<3;axis++){
  let min=Infinity,max=-Infinity,contact=0;
  for(let i=axis;i<p.length;i+=3){min=Math.min(min,p[i]);max=Math.max(max,p[i]);if(Math.abs(p[i])>.41)contact++;}
  reach+=(max-min)+contact/Math.max(1,n)*.40;
 }
 return reach;
}
function chooseVariant(family,dim,seed,rockCounts,getModel){
 const count=Number(rockCounts[family]);
 if(!Number.isInteger(count)||count<1||count>1024)throw new TypeError('Invalid authored stone catalogue for '+family);
 const start=Math.floor(random(seed,13)*count);
 if(!getModel)return start;
 let winner=start,best=-Infinity;
 for(let j=0;j<count;j++){
  const k=(start+j)%count;
  const score=faceReach(getModel(family,k))*.32+random(seed,k+977)*.18;
  if(score>best){best=score;winner=k;}
 }
 return winner;
}
function boxCoverage(stone,sections){
 let covered=0;
 for(const s of sections){const b=sectionEnvelope(s),a=[stone.x,stone.y,stone.z],d=[stone.sx,stone.sy,stone.sz];
  covered+=a.reduce((acc,v,k)=>acc*Math.max(0,Math.min(v+d[k],b.max[k])-Math.max(v,b.min[k])),1);
 }
 return covered;
}
function ownerFor(stone,sections){
 const pos=[stone.x+stone.sx/2,stone.y+stone.sy/2,stone.z+stone.sz/2];
 return sections.find(s=>{const b=sectionEnvelope(s);return pos.every((v,k)=>v>=b.min[k]-EPS&&v<b.max[k]-EPS)})||
 sections.find(s=>{const b=sectionEnvelope(s);return pos.every((v,k)=>v>=b.min[k]-EPS&&v<=b.max[k]+EPS)})||null;
}
/** Globally partition the union of all paid sections. Courses are staggered;
 * X cuts do not restart at section borders. Ownership follows stone centroid.
 * Contact solver only deforms existing authored meshes, not this envelope. */
export function solveMasonryLayout(input,{rockCounts=COUNTS,getModel=null,maxStones=1200}={}){
 const sections=ensureSections(input);
 if(!Number.isInteger(maxStones)||maxStones<1||maxStones>20000)throw new TypeError('Invalid stone budget');
 if(!sections.length)return [];
 const ys=edges(sections,1),zs=edges(sections,2),out=[];
 const seed=hash('natural-masonry-v2'),globalOrigin=sectionEnvelope(sections[0]).min;
 let course=0;
 for(let slab=0;slab<ys.length-1;slab++){
  const ylo=ys[slab],yhi=ys[slab+1];
  const courses=splitSpan(ylo,yhi,.93,hash('course:'+Math.round(ylo*1000)+':'+seed));
  for(let row=0;row<courses.length-1;row++,course++){
   const y=courses[row],height=courses[row+1]-y;
   let strip=0;
   for(let zz=0;zz<zs.length-1;zz++){
    const zlo=zs[zz],zhi=zs[zz+1];
    const bands=splitSpan(zlo,zhi,1.06,hash('depth:'+Math.round(zlo*1000)+':'+Math.floor(course/2)));
    for(let b=0;b<bands.length-1;b++,strip++){
     const z=bands[b],depth=bands[b+1]-z;
     const slices=sections.filter(s=>insideYZ(s,y,y+height,z,z+depth));
     const ranges=intervalUnion(slices.map(s=>{const box=sectionEnvelope(s);return [box.min[0],box.max[0]];}));
     for(const [xlo,xhi] of ranges){
      // Match footprints near vertical interfaces with changing wall outlines.
      // Do not introduce these artificial cuts along an uninterrupted wall.
      const cuts=[xlo,xhi];
      for(const other of sections){
       const b=sectionEnvelope(other);
       if(Math.abs(b.min[1]-(y+height))>EPS&&Math.abs(b.max[1]-y)>EPS)continue;
       if(b.min[2]>z+EPS||b.max[2]<z+depth-EPS)continue;
       for(const x of [b.min[0],b.max[0]])if(x>xlo+EPS&&x<xhi-EPS)cuts.push(x);
      }
      cuts.sort((a,b)=>a-b);
      for(let segment=1;segment<cuts.length;segment++){
       const start=cuts[segment-1],end=cuts[segment];
       // Courses use the same footprint seed in interlocking pairs.
       const phase=hash('stagger:'+Math.floor(course/2)+':'+strip+':'+Math.round(zlo*1000));
       const segments=splitSpan(start,end,1.28,phase);let x=start;
       for(let k=1;k<segments.length;k++){
       const width=segments[k]-x,stone={x,y,z,sx:width,sy:height,sz:depth,rotation:0};
       const parent=ownerFor(stone,sections);if(!parent)throw new RangeError('Stone cannot be assigned to a section');
       const identity=hash([x,y,z,width,height,depth].map(n=>n.toFixed(5)).join(':'));
       const family=selectFamily([width,height,depth],identity);
       const variant=chooseVariant(family,[width,height,depth],identity,rockCounts,getModel);
       out.push({...stone,id:parent.id+'/rock-'+identity.toString(36),parent,
        type:FAMILIES[family],variant});
       if(out.length>maxStones)throw new RangeError('Masonry layout exceeds stone budget');
       x=segments[k];
       }
      }
     }
    }
   }
  }
 }
 // Interlock selected vertical interfaces: merge exact-footprint source-rock
 // slots across two paid section boundaries. The source mesh remains authored.
 // Preserve complete 3D envelope coverage rather than drawing a fake overlay.
 const consumed=new Set(),joined=[];
 for(let i=0;i<out.length;i++){
  if(consumed.has(i))continue;
  const lower=out[i];let linked=false;
  for(let j=i+1;j<out.length;j++){
   if(consumed.has(j))continue;
   const upper=out[j];
   if(lower.parent.id===upper.parent.id||Math.abs(lower.y+lower.sy-upper.y)>EPS||
    Math.abs(lower.x-upper.x)>EPS||Math.abs(lower.z-upper.z)>EPS||
    Math.abs(lower.sx-upper.sx)>EPS||Math.abs(lower.sz-upper.sz)>EPS)continue;
   const seed=hash([lower.x,lower.z,lower.y,upper.y].map(v=>v.toFixed(5)).join(':'));
   if(random(seed,19)<.38)continue;
   const merged={x:lower.x,y:lower.y,z:lower.z,sx:lower.sx,sy:lower.sy+upper.sy,sz:lower.sz,rotation:0};
   const parent=ownerFor(merged,sections)||lower.parent;
   const family=selectFamily([merged.sx,merged.sy,merged.sz],seed);
   const variant=chooseVariant(family,[merged.sx,merged.sy,merged.sz],seed,rockCounts,getModel);
   joined.push({...merged,id:parent.id+'/rock-'+seed.toString(36),parent,
    type:FAMILIES[family],variant});consumed.add(j);linked=true;break;
  }
  if(!linked)joined.push(lower);
 }
 return joined.sort((a,b)=>a.y-b.y||a.z-b.z||a.x-b.x||a.id.localeCompare(b.id));
}
export function generateSectionStones(parent,options={}){return solveMasonryLayout([parent],options);}
/** Exact union-volume and envelope intersection checks, independent of meshes. */
export function validateCombinedLayout(sections,stones,{epsilon=1e-5}={}){
 const checked=ensureSections(sections);let overlap=0,outOfBounds=0,total=0;
 for(let i=0;i<stones.length;i++){
  const a=stones[i],v=volume(a);total+=v;
  if(Math.abs(boxCoverage(a,checked)-v)>epsilon*Math.max(1,v))outOfBounds++;
  for(let j=0;j<i;j++){
   const b=stones[j],touch=[0,1,2].map(k=>Math.min([a.x+a.sx,a.y+a.sy,a.z+a.sz][k],[b.x+b.sx,b.y+b.sy,b.z+b.sz][k])-Math.max([a.x,a.y,a.z][k],[b.x,b.y,b.z][k]));
   if(touch.every(t=>t>epsilon))overlap++;
  }
 }
 const parentVolume=checked.reduce((sum,s)=>sum+sectionEnvelope(s).size.reduce((v,n)=>v*n,1),0);
 const coverage=parentVolume?total/parentVolume:0;
 return{ok:outOfBounds===0&&overlap===0&&Math.abs(total-parentVolume)<epsilon*Math.max(1,parentVolume),coverage,overlap,outOfBounds,stones:stones.length};
}
export function validateSectionLayout(parent,stones,options){return validateCombinedLayout([parent],stones,options);}