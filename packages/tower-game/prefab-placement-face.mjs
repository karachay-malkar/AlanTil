/** Grid-face picking, independent from irregular stone triangle normals.
 * All inputs use world metres; offsets use integer 25 cm grid cells.
 */
export function resolvePrefabHitFace(bounds,origin,direction,point,fallback={x:0,y:1,z:0}){
 const axes=['x','y','z'];let entry=-Infinity,exit=Infinity,entryAxis=-1,entrySign=1;
 for(let i=0;i<3;i++){
  const v=direction[i],o=origin[i],lo=bounds.min[i]*.25,hi=bounds.max[i]*.25;
  if(Math.abs(v)<1e-9){if(o<lo||o>hi){entryAxis=-1;break;}continue;}
  const t1=(lo-o)/v,t2=(hi-o)/v,near=Math.min(t1,t2),far=Math.max(t1,t2);
  if(near>entry){entry=near;entryAxis=i;entrySign=v>0?-1:1;}
  exit=Math.min(exit,far);
 }
 if(entryAxis>=0&&exit>=Math.max(0,entry)&&entry>=0){
  return Object.fromEntries(axes.map((a,i)=>[a,i===entryAxis?entrySign:0]));
 }
 // Fallback: choose the closest logical boundary to the actual tap.
 let best=Infinity,axis=1,sign=1;
 for(let i=0;i<3;i++)for(const side of [-1,1]){
  const value=(side>0?bounds.max[i]:bounds.min[i])*.25;
  const d=Math.abs(point[i]-value);
  const normal=Number(fallback[axes[i]]||0);
  const score=d-(normal*side>0?.0001:0);
  if(score<best){best=score;axis=i;sign=side;}
 }
 return Object.fromEntries(axes.map((a,i)=>[a,i===axis?sign:0]));
}
export function nudgePrefabOnFace(position,normal,direction){
 const n=normal||{x:0,y:1,z:0};
 const axis=Math.abs(n.x)>.5?'x':Math.abs(n.z)>.5?'z':'y';
 const axes=axis==='y'?['x','z']:axis==='x'?['z','y']:['x','y'];
 const delta={up:[axes[1],-1],down:[axes[1],1],left:[axes[0],-1],right:[axes[0],1]}[direction];
 if(!delta)return {...position};
 // Vertical screen arrows should increase height on wall faces.
 if(axis!=='y'&&(direction==='up'||direction==='down'))delta[1]*=-1;
 return {...position,[delta[0]]:position[delta[0]]+delta[1]};
}
