/** Display-only correction for sourced open triangle soups.
 * The canonical packed faces and server collision geometry are never modified.
 * Outwardness is evaluated from area-weighted triangle normals against the
 * source vertex centroid. Only overwhelmingly inverted source variants flip.
 */
export function inspectDisplayWinding(mesh){
 const p=mesh?.positions,faces=mesh?.indices;
 if(!p?.length||!faces?.length||faces.length%3)throw new TypeError('Authored indexed mesh required');
 let outward=0,inward=0,ambiguous=0;
 const center=[0,1,2].map(axis=>{
  let value=0;for(let i=axis;i<p.length;i+=3)value+=p[i];return value/(p.length/3);
 });
 for(let i=0;i<faces.length;i+=3){
  const [a,b,c]=[faces[i],faces[i+1],faces[i+2]].map(j=>[p[j*3],p[j*3+1],p[j*3+2]]);
  const u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]);
  const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const relative=a.map((x,k)=>(x+b[k]+c[k])/3-center[k]);
  const signed=relative.reduce((s,x,k)=>s+x*normal[k],0),scale=Math.hypot(...normal)*Math.max(.000001,Math.hypot(...relative));
  if(Math.abs(signed)<=scale*1e-5)ambiguous++;else if(signed>0)outward++;else inward++;
 }
 const reversed=inward>outward*3&&inward>=4;
 return{outward,inward,ambiguous,reversed};
}
export function repairRockDisplayWinding(mesh){
 const diagnostics=inspectDisplayWinding(mesh);
 if(!diagnostics.reversed)return {...mesh,displayWinding:diagnostics};
 const indices=mesh.indices.slice();
 for(let i=0;i<indices.length;i+=3){const swap=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=swap;}
 return{...mesh,indices,displayWinding:diagnostics};
}
