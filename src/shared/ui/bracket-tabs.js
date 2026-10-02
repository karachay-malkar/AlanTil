// Progressive enhancement for shared bracket navigation; the CSS handles scrolling.
const tracked=new Map();
let frame=0;
function measure(){
  frame=0;
  for(const [track,shell] of tracked){
    if(!track.isConnected){resize?.unobserve(track);tracked.delete(track);continue;}
    shell.classList.toggle('canScrollStart',track.scrollLeft>2);
    shell.classList.toggle('canScrollEnd',track.scrollWidth-track.clientWidth-track.scrollLeft>2);
  }
}
function schedule(){if(!frame)frame=requestAnimationFrame(measure);}
const resize=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;
function enhance(){
  for(const track of document.querySelectorAll('.bracketTabsTrack')){
    if(tracked.has(track))continue;
    const shell=track.closest('.bracketTabsShell');if(!shell)continue;
    tracked.set(track,shell);resize?.observe(track);
    track.addEventListener('scroll',schedule,{passive:true});
    track.addEventListener('focusin',event=>event.target.scrollIntoView?.({block:'nearest',inline:'nearest'}));
  }
  schedule();
}
function start(){enhance();new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-text-size']});window.addEventListener('resize',schedule,{passive:true});document.fonts?.ready?.then(schedule);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
