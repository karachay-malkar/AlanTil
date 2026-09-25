export const GUIDE_PROGRESS_STORY='roots';
export const GUIDE_PROGRESS_INITIAL_DELAY_MS=0;
export const GUIDE_PROGRESS_BURST_MS=650;
export const GUIDE_PROGRESS_END_PAUSE_MS=900;
export const GUIDE_PROGRESS_FOCUS_RATIO=.58;
export const GUIDE_PROGRESS_CENTER_PLATEAU_INTERVALS=5;

const BASE_INTERVAL_MS=1100;
const PARABOLA_MIN_INTERVAL_MS=175;
const PARABOLA_MAX_INTERVAL_MS=875;
const PARABOLA_MIN_WEIGHT=PARABOLA_MIN_INTERVAL_MS/BASE_INTERVAL_MS;
const PARABOLA_MAX_WEIGHT=PARABOLA_MAX_INTERVAL_MS/BASE_INTERVAL_MS;
const FAST_MIDDLE_PULSE_MS=650;
const SLOW_EDGE_PULSE_MS=2200;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;

function guideProgressPlateauBounds(count){
  const size=Math.max(0,Math.floor(finite(count)));
  const intervalCount=Math.max(0,size-1);
  const plateauCount=Math.min(GUIDE_PROGRESS_CENTER_PLATEAU_INTERVALS,intervalCount);
  const start=Math.floor((intervalCount-plateauCount)/2);
  return{intervalCount,start,end:start+plateauCount-1};
}

function guideProgressParabolaDistance(targetIndex,count){
  const index=Math.max(0,Math.floor(finite(targetIndex)));
  const {intervalCount,start,end}=guideProgressPlateauBounds(count);
  if(index<=0||!intervalCount)return 0;
  const position=clamp(index-1,0,intervalCount-1);
  if(position<start)return start?clamp((start-position)/start,0,1):0;
  if(position>end){
    const rightSpan=Math.max(1,(intervalCount-1)-end);
    return clamp((position-end)/rightSpan,0,1);
  }
  return 0;
}

export function guideProgressIntervalWeight(targetIndex,count){
  const size=Math.max(0,Math.floor(finite(count)));
  const index=Math.max(0,Math.floor(finite(targetIndex)));
  if(index<=0||size<=1)return 0;
  const distance=guideProgressParabolaDistance(index,size);
  return PARABOLA_MIN_WEIGHT+(PARABOLA_MAX_WEIGHT-PARABOLA_MIN_WEIGHT)*distance*distance;
}

export function guideProgressDuration({stationCount=0}={}){
  const count=Math.max(0,Math.floor(finite(stationCount)));
  if(count<=1)return 900;
  let total=0;
  for(let index=1;index<count;index+=1)total+=guideProgressIntervalWeight(index,count);
  return Math.round(clamp(total*BASE_INTERVAL_MS,4800,12500));
}

export function guideProgressTriggerOffset(centerY,viewportHeight,maxScroll){
  const viewport=Math.max(1,finite(viewportHeight,1));
  const maximum=Math.max(0,finite(maxScroll));
  return clamp(finite(centerY)-viewport*GUIDE_PROGRESS_FOCUS_RATIO,0,maximum);
}

export function guideProgressPulseDuration(index,count){
  const size=Math.max(0,Math.floor(finite(count)));
  const position=Math.max(0,Math.floor(finite(index)));
  if(size<=1)return SLOW_EDGE_PULSE_MS;
  const weight=position<=0?PARABOLA_MAX_WEIGHT:guideProgressIntervalWeight(position,size);
  const span=Math.max(.000001,PARABOLA_MAX_WEIGHT-PARABOLA_MIN_WEIGHT);
  const progress=clamp((weight-PARABOLA_MIN_WEIGHT)/span,0,1);
  return Math.round(FAST_MIDDLE_PULSE_MS+(SLOW_EDGE_PULSE_MS-FAST_MIDDLE_PULSE_MS)*progress);
}

export function orderGuideProgressStations(stations=[]){
  return (Array.isArray(stations)?stations:[])
    .map((station,index)=>({...station,__guideIndex:index,y:finite(station?.y,NaN)}))
    .filter((station)=>Number.isFinite(station.y))
    .sort((left,right)=>right.y-left.y||left.__guideIndex-right.__guideIndex)
    .map(({__guideIndex,...station})=>station);
}

export function createGuideProgressTimeline(stations=[]){
  const list=Array.isArray(stations)?stations:[];
  if(!list.length)return[];
  const firstY=finite(list[0]?.y,0),lastY=finite(list.at(-1)?.y,firstY);
  const distance=Math.max(.000001,firstY-lastY);
  let totalWeight=0;
  for(let index=1;index<list.length;index+=1)totalWeight+=guideProgressIntervalWeight(index,list.length);
  let elapsed=0,previousRoute=0;
  return list.map((station,index)=>{
    if(index>0)elapsed+=guideProgressIntervalWeight(index,list.length);
    const rawRoute=list.length<=1?0:clamp((firstY-finite(station?.y,firstY))/distance,0,1);
    const routeProgress=index===0?0:index===list.length-1?1:Math.max(previousRoute,rawRoute);
    previousRoute=routeProgress;
    return{
      ...station,
      routeProgress,
      triggerProgress:index===0?0:clamp(elapsed/Math.max(.000001,totalWeight),0,1),
    };
  });
}

function timelineTangents(timeline){
  const points=Array.isArray(timeline)?timeline:[];
  if(points.length<2)return[];
  const count=points.length,delta=[],span=[];
  for(let index=0;index<count-1;index+=1){
    const h=Math.max(.000001,finite(points[index+1]?.triggerProgress)-finite(points[index]?.triggerProgress));
    span.push(h);
    delta.push((finite(points[index+1]?.routeProgress)-finite(points[index]?.routeProgress))/h);
  }
  const tangent=new Array(count).fill(0);
  tangent[0]=0;
  tangent[count-1]=0;
  for(let index=1;index<count-1;index+=1){
    const left=delta[index-1],right=delta[index];
    if(left<=0||right<=0){tangent[index]=0;continue;}
    const w1=2*span[index]+span[index-1],w2=span[index]+2*span[index-1];
    tangent[index]=(w1+w2)/(w1/left+w2/right);
  }
  return tangent;
}

export function guideProgressRouteProgressAt(progress,timeline=[]){
  const t=clamp(finite(progress),0,1),points=Array.isArray(timeline)?timeline:[];
  if(!points.length)return t;
  if(points.length===1||t<=0)return finite(points[0]?.routeProgress,0);
  if(t>=1)return finite(points.at(-1)?.routeProgress,1);
  const tangent=timelineTangents(points);
  for(let index=0;index<points.length-1;index+=1){
    const left=points[index],right=points[index+1];
    const a=finite(left?.triggerProgress),b=finite(right?.triggerProgress);
    if(t>b)continue;
    const h=Math.max(.000001,b-a),u=clamp((t-a)/h,0,1),u2=u*u,u3=u2*u;
    const h00=2*u3-3*u2+1,h10=u3-2*u2+u,h01=-2*u3+3*u2,h11=u3-u2;
    return clamp(h00*finite(left?.routeProgress)+h10*h*tangent[index]+h01*finite(right?.routeProgress)+h11*h*tangent[index+1],0,1);
  }
  return 1;
}

export function guideProgressOffsetAt(progress,maxScroll,timeline=[]){
  const maximum=Math.max(0,finite(maxScroll));
  return maximum*(1-guideProgressRouteProgressAt(progress,timeline));
}

export function guideProgressClipY(routeProgress,startY,endY){
  const start=finite(startY),end=finite(endY),t=clamp(finite(routeProgress),0,1);
  return start+(end-start)*t;
}
