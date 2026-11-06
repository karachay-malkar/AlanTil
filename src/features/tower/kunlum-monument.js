export const ABAY_KALA_HEIGHT=15.8;

export function createKunlumMonument(THREE,{x,z,baseY,mobile=false}){
 // Monument is an interpretative geometry only; exact elevation follows DEM.
 const stoneColors=['#b6ae99','#c7bfaf','#a39f8f','#d0c7b3','#aba99a','#bdb5a3'];
 const cache=stoneColors.map(x=>new THREE.Color(x));
 const pos=[],cols=[];
 function tri(a,b,c,id){
  const col=cache[Math.abs(id)%cache.length];
  for(const q of [a,b,c]){pos.push(...q);cols.push(col.r,col.g,col.b)}
 }
 const H=ABAY_KALA_HEIGHT;
 const corner=(side,u,y,offset=0)=>{
  const w=6+(4.65-6)*(y/H),half=w/2;
  const q=(u-.5)*w;
  const dx=side===0?q:side===1?-q:side===2?half:-half;
  const dz=side===0?half:side===1?-half:side===2?-q:q;
  const r=Math.hypot(dx,dz)||1;
  return [x+dx+dx/r*offset,baseY+y,z+dz+dz/r*offset];
 };
 for(let side=0;side<4;side++)for(let row=0;row<(mobile?22:34);row++){
  const y0=row*H/(mobile?22:34),y1=(row+1)*H/(mobile?22:34);
  const steps=mobile?9:13;
  for(let j=0;j<steps;j++){
   const u0=j/steps,u1=(j+1)/steps,mid=(u0+u1)/2,cy=(y0+y1)/2;
   if((side===0&&mid>.41&&mid<.59&&cy<2.6)||
     (side===0&&Math.abs(mid-.5)<.049&&cy>5.3&&cy<7.0)||
     (side===0&&Math.abs(mid-.5)<.049&&cy>9.5&&cy<11.1))continue;
   const a=corner(side,u0,y0),b=corner(side,u1,y0),
    c=corner(side,u1,y1),d=corner(side,u0,y1);
   const m=corner(side,mid,cy,.018+.065*Math.abs(Math.sin(row*6.2+j*1.7+side)));
   tri(a,b,m,row+j+side);tri(b,c,m,row+j+side+1);
   tri(c,d,m,row+j+side+2);tri(d,a,m,row+j+side+3);
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
 g.computeVertexNormals();
 const m=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide});
 const tower=new THREE.Mesh(g,m);
 tower.name='Абай-къала · approximate stone monument on real DEM elevation';
 tower.userData.common100TowerBase={x,z,baseY,height:H};
 return tower;
}
