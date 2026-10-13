/** Detect physical section-envelope face pairings; no generated fake cavity.
 * Actual exposed natural-rock surface geometry must be verified separately. */
import {sectionEnvelope} from './section-masonry.mjs';
const EPS=1e-5,AXIS=['x','y','z'];
const span=(a,b,c,d)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
const bounds=s=>({min:[s.x,s.y,s.z],max:[s.x+s.sx,s.y+s.sy,s.z+s.sz]});
function facing(a,b){
 const A=sectionEnvelope(a),B=sectionEnvelope(b),out=[];
 for(let k=0;k<3;k++){
  if([0,1,2].filter(i=>i!==k).some(i=>span(A.min[i],A.max[i],B.min[i],B.max[i])<=EPS))continue;
  if(Math.abs(A.max[k]-B.min[k])<EPS)out.push({axis:k,plane:A.max[k],left:a,right:b});
  else if(Math.abs(B.max[k]-A.min[k])<EPS)out.push({axis:k,plane:B.max[k],left:b,right:a});
 }
 return out;
}
export function findSectionJoints(sections,stones,{minArea=.015,maxJoints=5000}={}){
 if(!Array.isArray(sections)||!Array.isArray(stones))throw new TypeError('Invalid sections or stones');
 const bySection=new Map();
 for(const s of stones){const id=s.parent?.id;if(!id)continue;if(!bySection.has(id))bySection.set(id,[]);bySection.get(id).push(s);}
 const joints=[];
 for(let i=0;i<sections.length;i++)for(let j=i+1;j<sections.length;j++){
  for(const face of facing(sections[i],sections[j])){
   const {axis,plane,left,right}=face,axes=[0,1,2].filter(v=>v!==axis);
   const L=(bySection.get(left.id)||[]).filter(s=>Math.abs(bounds(s).max[axis]-plane)<EPS);
   const R=(bySection.get(right.id)||[]).filter(s=>Math.abs(bounds(s).min[axis]-plane)<EPS);
   for(const a of L)for(const b of R){
    const A=bounds(a),B=bounds(b),ranges=axes.map(k=>[Math.max(A.min[k],B.min[k]),Math.min(A.max[k],B.max[k])]);
    const area=ranges.reduce((n,[start,end])=>n*Math.max(0,end-start),1);if(area<minArea)continue;
    joints.push({axis,plane,leftParent:left.id,rightParent:right.id,leftStone:a.id,rightStone:b.id,area,ranges,key:[a.id,b.id,AXIS[axis],plane.toFixed(5)].join(':')});
    if(joints.length>maxJoints)throw new RangeError('Too many local section contacts');
   }
  }
 }
 return joints.sort((a,b)=>a.key.localeCompare(b.key));
}
export function affectedSections(sections,id,{tolerance=.05}={}){
 const changed=sections.find(s=>s.id===id);if(!changed)return[];
 const A=sectionEnvelope(changed);
 return sections.filter(s=>{const B=sectionEnvelope(s);return [0,1,2].every(i=>A.min[i]<=B.max[i]+tolerance&&B.min[i]<=A.max[i]+tolerance);}).map(s=>s.id).sort();
}
