// Keep one viewport of overscan on either side, update at half-screen intervals.
function initialSnapshot(scope='',revision=0){return{offset:0,height:0,ready:false,scope:String(scope||''),revision};}
export function createPathWindow(initialScope=''){
 let snapshot=initialSnapshot(initialScope,0);const listeners=new Set();
 const publish=(next)=>{snapshot=next;listeners.forEach(fn=>fn());return snapshot;};
 return {subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot(){return snapshot;},reset(scope=''){return publish(initialSnapshot(scope,snapshot.revision+1));},update(offset,height,scope=snapshot.scope){
  const nextScope=String(scope||'');if(nextScope!==snapshot.scope)return snapshot;
  const nextHeight=Number(height)||0;if(!(nextHeight>1))return snapshot;
  const nextOffset=Math.max(0,Number(offset)||0);if(snapshot.ready&&nextHeight===snapshot.height&&Math.abs(nextOffset-snapshot.offset)<nextHeight/2)return snapshot;
  return publish({...snapshot,offset:nextOffset,height:nextHeight,ready:true});
 }};
}
export function stationInWindow(y,window={},pinned=false){
 if(pinned)return true;if(!window.ready)return true;
 return window.height>1&&Number.isFinite(y)&&y>=window.offset-window.height*1.5&&y<=window.offset+window.height*2.5;
}
