/**
 * Deterministic close-fitting stone surfaces, shared by the WebGL renderer and
 * geometry worker. The 23 authored variants supply the source colors and
 * variation seed; geometry is regularized into a mildly chamfered block.
 * Coordinates are centered in [-.5,.5]. No changes to saved variant indices.
 */
export function regularizedRockMesh(source, variant = 0, detail = 5) {
  const [,,base,alternate,encoded] = source;
  if (!Array.isArray(base) || !Array.isArray(alternate) || !encoded) throw new Error('Invalid source stone');
  const positions=[], colors=[], indices=[];
  let seed=variant+2166136261;
  for (let i=0;i<Math.min(encoded.length,96);i++) seed=Math.imul(seed^encoded.charCodeAt(i),16777619)>>>0;
  const hash=(x,y,z,salt=0)=>{
    let n=seed^Math.imul(x+41,73856093)^Math.imul(y+59,19349663)^Math.imul(z+83,83492791)^Math.imul(salt+1,2654435761);
    n=Math.imul(n^(n>>>16),2246822507);n=Math.imul(n^(n>>>13),3266489909);
    return ((n^(n>>>16))>>>0)/4294967296;
  };
  const project=xyz=>{
    const q=xyz.map(v=>Math.round((v+.5)*detail));
    const cornerCount=xyz.filter(v=>Math.abs(v)>.4999).length;
    const ripple=(hash(...q,4)-.5)*.017;
    // Broad faces remain near the construction cell; modest cut edges/corners.
    const cut=.003+(cornerCount>=2?.055:0)+(cornerCount>=3?.020:0)+(hash(...q,4)-.5)*.008;
    return xyz.map(v=>v*(1-Math.max(.0015,cut)));
  };
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const start=positions.length/3,u=(axis+1)%3,v=(axis+2)%3;
    for(let j=0;j<=detail;j++)for(let i=0;i<=detail;i++){
      const point=[0,0,0];point[axis]=sign*.5;point[u]=i/detail-.5;point[v]=j/detail-.5;
      const p=project(point);positions.push(...p);
      const shade=.84+hash(Math.round(p[0]*100),Math.round(p[1]*100),Math.round(p[2]*100),axis)*.17;
      const blend=.30+hash(i,j,axis,variant)*.48;
      for(let k=0;k<3;k++)colors.push(Math.max(0,Math.min(1,(base[k]*(1-blend)+alternate[k]*blend)*shade/255)));
    }
    for(let j=0;j<detail;j++)for(let i=0;i<detail;i++){
      const a=start+j*(detail+1)+i,b=a+1,c=a+detail+1,d=c+1;
      if(sign>0)indices.push(a,b,c,b,d,c);
      else indices.push(a,c,b,b,c,d);
    }
  }
  return {positions:new Float32Array(positions),colors:new Float32Array(colors),indices:new Uint16Array(indices)};
}

export function rockMeshVolume(mesh) {
  const {positions:p,indices:index}=mesh;let v=0;
  for(let i=0;i<index.length;i+=3){
    const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
    const ab=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1]);
    const bc=p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2]);
    const ca=p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);
    v+=(ab+bc+ca)/6;
  }
  return Math.abs(v);
}
