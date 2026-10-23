/**
 * Kunlum El — interpretative settlement topology, v17.2.11.
 *
 * Sources: user-supplied illustrated plan of Kunlum El and two VT screenshots.
 * The plan has no scale/orientation control points: these are NOT surveyed
 * footprints or named family parcels. Coordinates are local game metres.
 *
 * +Z uphill to Abaev Kala; -Z toward the Cherek.
 * Every paired row is one house depth apart: lower roof = upper courtyard.
 */
export const KUNLUM_SITE_PLAN=Object.freeze({
 source:"Kunlum El foundation illustrated plan / user screenshot, visually sampled",
 surveyAccuracy:"schematic layout only; no georeference",
 active:{x:[0,20],z:[0,20]},
 reserve:{x:[-10,30],z:[-15,35]},
 landmark:{abayKala:[-12,68],cherekZ:-91},
 // Loosely digitised district envelopes, not cadastral polygons. Layout follows
 // dense elongated centre, strips above river, upper belt and eastern extension.
 districts:[
  {id:"lower-west",label:"Нижние западные дворы",x:[-94,-12],z:[-71,-38]},
  {id:"lower-east",label:"Нижние восточные дворы",x:[32,105],z:[-70,-32]},
  {id:"middle-west",label:"Центральный западный квартал",x:[-102,-13],z:[-36,38]},
  {id:"middle-east",label:"Центральный восточный квартал",x:[34,122],z:[-34,40]},
  {id:"high-west",label:"Верхние дворы",x:[-86,-20],z:[37,90]},
  {id:"high-east",label:"Верхний восточный квартал",x:[19,96],z:[39,89]}
 ],
 // Rows follow contour lines. X intervals preserve historic-style irregular
 // courtyard blocks and alleys visible in the plan. z0 is lower slope edge.
 bands:[
  {id:"S1",z0:-70,depth:8.2,ranges:[[-83,-29],[39,96]]},
  {id:"S2",z0:-61.8,depth:8.2,ranges:[[-91,-18],[35,108]]},
  {id:"S3",z0:-53.6,depth:8.2,ranges:[[-96,-22],[36,112]]},
  {id:"S4",z0:-45.4,depth:8.2,ranges:[[-89,-17],[38,103]]},
  {id:"L1",z0:-37.2,depth:8.2,ranges:[[-98,-16],[34,104]]},
  {id:"L2",z0:-29,depth:8.2,ranges:[[-100,-19],[35,111]]},
  {id:"L3",z0:-20.8,depth:8.2,ranges:[[-95,-19],[38,109]]},
  {id:"C1",z0:-12.6,depth:8.2,ranges:[[-102,-21],[39,116]]},
  {id:"C2",z0:-4.4,depth:8.2,ranges:[[-105,-21],[39,120]]},
  {id:"C3",z0:3.8,depth:8.2,ranges:[[-99,-22],[38,121]]},
  {id:"C4",z0:12,depth:8.2,ranges:[[-95,-21],[38,118]]},
  {id:"C5",z0:20.2,depth:8.2,ranges:[[-94,-22],[39,110]]},
  {id:"C6",z0:28.4,depth:8.2,ranges:[[-91,-22],[39,106]]},
  {id:"U1",z0:36.6,depth:8.2,ranges:[[-83,-25],[33,98]]},
  {id:"U2",z0:44.8,depth:8.2,ranges:[[-81,-27],[31,97]]},
  {id:"U3",z0:53,depth:8.2,ranges:[[-77,-27],[24,93]]},
  {id:"U4",z0:61.2,depth:8.2,ranges:[[-79,-29],[25,93]]},
  {id:"U5",z0:69.4,depth:8.2,ranges:[[-73,-24],[18,92]]},
  {id:"U6",z0:77.6,depth:8.2,ranges:[[-72,-25],[15,88]]}
 ],
 // Paths that separate small groups within strips, rather than broad streets.
 // Narrow gaps are treated as openings in continuous retaining walls.
 laneXs:[-67,-43,-20,46,73,96],
 laneWidth:1.1,
 houseWidthPattern:[7.1,6.0,8.4,6.6,7.8,5.8,7.5],
 wallThickness:.55,
 levelHeight:2.35
});
const intersects=(p,r)=>p.x0<r.x[1]&&p.x1>r.x[0]&&p.z0<r.z[1]&&p.z1>r.z[0];
/**
 * Deterministic plot segments and their adjacency relations.
 * Rows meet at their edges, so a lower roof becomes the open platform
 * at the door of its uphill neighbour. No independent random houses.
 */
export function getKunlumSiteLayout(){
 const plan=KUNLUM_SITE_PLAN,parcels=[],paths=[],terraces=[],reserve=plan.reserve;
 const w=plan.houseWidthPattern;
 for(let bi=0;bi<plan.bands.length;bi++){
  const band=plan.bands[bi],z0=band.z0,z1=z0+band.depth;
  for(let ri=0;ri<band.ranges.length;ri++){
   const [xmin,xmax]=band.ranges[ri];
   let x=xmin,ordinal=0;
   while(x<xmax-4.2){
    const width=w[(ordinal+bi*2+ri)%w.length];
    let x1=Math.min(xmax,x+width);
    // Real alley gaps separate the continuous stone-house rows.
    const lane=plan.laneXs.find(v=>v>x+.3&&v<x1+.65);
    if(lane!==undefined){
     if(lane-x<4.1){x=lane+plan.laneWidth*.5;ordinal++;continue;}
     x1=Math.min(x1,lane-plan.laneWidth*.5);
    }
    if(x1-x<4.1){if(lane!==undefined){x=lane+plan.laneWidth*.5;ordinal++;continue;}break;}
    const house={id:band.id+'-'+ri+'-'+ordinal,band:band.id,row:bi,
      x0:x,x1,z0,z1,centerX:(x+x1)/2,centerZ:(z0+z1)/2,
      ruinType:(ordinal*5+bi*3+ri)%7,
      hasRoof:((ordinal+bi*2+ri)%5===0 || (bi+ordinal*3)%11===0),
      level:bi,region:ri===0?"west":"east"};
    // Clear the entire expansion envelope, not merely the present building cells.
    if(!intersects(house,{x:[reserve.x[0]-.8,reserve.x[1]+.8],
      z:[reserve.z[0]-.8,reserve.z[1]+.8]}))parcels.push(house);
    x=lane!==undefined?lane+plan.laneWidth*.5:x1;
    ordinal++;
   }
   terraces.push({id:band.id+'-'+ri,x0:xmin,x1:xmax,z0,z1});
  }
 }
 // The familiar external lanes are represented as line chains in the map's
 // principal directions. They sit outside the reserve and river channel.
 const chains=[
  [[-69,-70],[-71,-38],[-72,-12],[-74,16],[-76,44],[-72,79]],
  [[-20,-71],[-19,-42],[-20,-16],[-21,12],[-22,34],[-24,52]],
  [[38,-68],[36,-41],[35,-13],[35,14],[36,41],[34,77]],
  [[76,-70],[76,-43],[75,-18],[74,8],[73,32],[75,60],[76,83]]
 ];
 chains.forEach((points,i)=>paths.push({id:'lane-'+i,points,width:plan.laneWidth}));
 const ids=new Map(parcels.map(p=>[p.id,p]));
 const pairs=[];
 for(const p of parcels){
  const uphill=parcels.filter(q=>q.row===p.row+1
    &&Math.abs(q.z0-p.z1)<.04&&Math.min(p.x1,q.x1)-Math.max(p.x0,q.x0)>2);
  if(uphill.length){
   // One connection per lower parcel; the strongest overlap leads uphill.
   const upper=uphill.reduce((a,b)=>Math.min(p.x1,b.x1)-Math.max(p.x0,b.x0)>
     Math.min(p.x1,a.x1)-Math.max(p.x0,a.x0)?b:a);
   pairs.push({lower:p.id,upper:upper.id,
     seamZ:p.z1,overlapX:[Math.max(p.x0,upper.x0),Math.min(p.x1,upper.x1)]});
  }
 }
 return {plan,parcels,terraces,paths,pairs};
}
