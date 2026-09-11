// Window-to-overlay conversion: both rectangles must come from the same native window.
export function localGuideRect(rect, origin) {
  return rect && origin ? {...rect, x:rect.x-origin.x, y:rect.y-origin.y} : null;
}
export function expandGuideRect(rect,padding=8,minWidth=0,minHeight=0,shape='rounded') {
  if(!rect)return null;
  let width=Math.max(minWidth,rect.width+padding*2),height=Math.max(minHeight,rect.height+padding*2);
  if(shape==='circle')width=height=Math.max(width,height);
  return {x:rect.x+(rect.width-width)/2,y:rect.y+(rect.height-height)/2,width,height,shape};
}
const intersection=(a,b)=>!a||!b?0:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
// Candidate order and overlap penalties from Web 13.15.12 positionGuideContent.
export function placeGuidePanel({width,height,panelHeight,target,holes=[],avoids=[],header=null,bottomNav=null,preference='auto'}) {
  const edge=width<=390?14:18,gap=edge,panelWidth=Math.min(360,width-28),left=(width-panelWidth)/2,maxTop=Math.max(edge,height-panelHeight-edge);
  const inside=preference==='inside-bottom',center=(height-panelHeight)/2;
  const targetCenter=target?target.y+target.height/2:height/2;
  const above=target?target.y-gap-panelHeight:edge,below=target?target.y+target.height+gap:maxTop;
  const opposite=!target?center:targetCenter<=height/2?Math.max(below,height*.61-panelHeight/2):Math.min(above,height*.27-panelHeight/2);
  const topZone=height*.24-panelHeight/2,bottomZone=height*.72-panelHeight/2,targetBottom=target?target.y+target.height-gap-panelHeight:maxTop;
  const protectedAvoids=avoids.map(r=>expandGuideRect(r,gap));
  const aboveAvoided=protectedAvoids.length?Math.min(...protectedAvoids.map(r=>r.y))-panelHeight:targetBottom;
  const candidates=preference==='top'?[above,topZone,opposite,below,center,edge,maxTop]:preference==='bottom'?[below,bottomZone,opposite,above,center,maxTop,edge]:inside?[aboveAvoided,targetBottom,bottomZone,center,topZone]:[opposite,above,below,center,topZone,bottomZone,edge,maxTop];
  const min=inside&&target?Math.max(edge,target.y+gap):edge,max=inside&&target?Math.max(min,Math.min(maxTop,targetBottom)):maxTop;
  const protectedRects=inside?protectedAvoids:[...holes.map(r=>expandGuideRect(r,gap)),...protectedAvoids];
  let best={top:clamp(center,min,max),penalty:Infinity};
  candidates.forEach((value,index)=>{const top=clamp(value,min,max),rect={x:left,y:top,width:panelWidth,height:panelHeight};const penalty=protectedRects.reduce((sum,r)=>sum+intersection(rect,r),0)*100000+(intersection(rect,header)+intersection(rect,bottomNav))*50000+index;if(penalty<best.penalty)best={top,penalty};});
  return {left,top:best.top,width:panelWidth};
}
