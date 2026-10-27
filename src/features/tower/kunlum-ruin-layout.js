/** Shared natural-rubble placement for Common100 and faceted distant LOD.
 * Geometry changes with detail, never the wall's stone arrangement.
 * Wall positions, doorways, historical linework, and terrain are untouched.
 */
import {kunlumRuinCrown,kunlumRuinFoot} from './kunlum-wall-ground.js?v=17.2.35';

const hash=(x,y,z)=>{
 const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453123;
 return v-Math.floor(v);
};
/**
 * Unequal interlocking rubble courses: randomized widths, independent local
 * bedding, non-uniform height/tilt. Each shape is actual 3D, not a brick cube.
 * Two LODs read identical placement records, so camera distance changes only
 * polygon detail.
 */
export function layoutKunlumRuinStones(segment,{meanWidth=.68,meanCourse=.37}={}){
 const {a,b,height,width,heightAt}=segment;
 const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
 if(length<.01||!(height>0)||!(width>0))return [];
 const nx=-dz/length,nz=dx/length;
 const rows=Math.max(2,Math.ceil(height/meanCourse));
 const columns=Math.max(1,Math.ceil(length/meanWidth));
 const nominal=height/rows,stones=[];
 for(let row=0;row<rows;row++){
  // Row-by-row proportions, not a repeated x/z lattice.
  const widths=Array.from({length:columns},(_,col)=>
   .46+.95*hash(a[0]*1.7+row*5.9,col*7.21,a[1]*2.1+row*.83));
  const sum=widths.reduce((s,v)=>s+v,0);
  let cursor=0;
  for(let col=0;col<columns;col++){
   const next=col===columns-1?length:cursor+length*widths[col]/sum;
   const x=a[0]+dx*(cursor+next)/(2*length);
   const z=a[1]+dz*(cursor+next)/(2*length);
   const w=next-cursor;
   cursor=next;
   if(w<.10)continue;
   const foot=kunlumRuinFoot(x,z,width,heightAt,[nx,nz]);
   const top=heightAt(x,z)+kunlumRuinCrown(height,x,z);
   const seed=hash(x*2.17,row*9.31,z*1.73);
   const base=foot+row*nominal+(seed-.5)*nominal*.34;
   const h=Math.min(nominal*(.99+.22*hash(z*2.3,row,x)),top-base+.015);
   if(h<.085)continue;
   // Rare missing crown stones add localized 25–35 cm ruin depressions.
   if(row===rows-1&&hash(x*1.91,row+11,z*1.73)>.91)continue;
   // Asymmetric broken stone faces and non-plumb joints, with overlap.
   stones.push({
    x,z,sideX:nx,sideZ:nz,y:base+h*.5,
    width:w*(1.05+.07*hash(row,z,x)),
    height:h,depth:.24+.075*hash(row*2.1,x,z),
    tilt:(hash(x,row*3,z)-.5)*.24,
    lean:(hash(z,row*4,x)-.5)*.19,
    kind:Math.floor(hash(x+row*1.3,z,col+2.7)*99991),
    row,col,top,foot
   });
  }
 }
 return stones;
}
