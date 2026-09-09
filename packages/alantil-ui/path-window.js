// Keep one viewport of overscan on either side, update at half-screen intervals.
export function createPathWindow(){
 let snapshot={offset:0,height:0};const listeners=new Set();
 return {subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot(){return snapshot;},update(offset,height){
  if(!(height>1))return;
  if(height===snapshot.height&&Math.abs(offset-snapshot.offset)<height/2)return;
  snapshot={offset:Math.max(0,offset),height};listeners.forEach(fn=>fn());
 }};
}
export function stationInWindow(y,{offset,height},pinned=false){
 return pinned||!height||!Number.isFinite(y)||(y>=offset-height*1.5&&y<=offset+height*2.5);
}
