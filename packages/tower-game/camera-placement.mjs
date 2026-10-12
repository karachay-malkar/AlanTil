// Isolated camera-directed placement candidate ranking; no changes to tower state.
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const length=a=>Math.hypot(...a);
const unit=a=>a.map(v=>v/(length(a)||1));
export function proposeStonePlacement({camera,stone,anchors,collides,support,inside,previous}){
  if(!camera||!stone||!Array.isArray(anchors)||typeof collides!=='function'||typeof support!=='function'||typeof inside!=='function')return null;
  const direction=unit(camera.forward);
  const proposals=[];
  for(const anchor of anchors){
    for(const dx of [-.1,0,.1])for(const dy of [-.1,0,.1])for(const dz of [-.1,0,.1]){
      const position=[anchor[0]+dx,anchor[1]+dy,anchor[2]+dz];
      if(!inside(position,stone)||collides(position,stone))continue;
      const bearing=sub(position,camera.origin),distance=length(bearing);
      if(distance<.001)continue;
      const alignment=dot(unit(bearing),direction);
      const bearingSupport=support(position,stone);
      if(alignment<=0||bearingSupport<.35)continue;
      const score=alignment*3+bearingSupport-.02*distance;
      proposals.push({position,score});
    }
  }
  proposals.sort((a,b)=>b.score-a.score);
  const best=proposals[0];if(!best)return null;
  const retained=proposals.find(p=>previous&&length(sub(p.position,previous.position))<.01);
  return retained&&best.score-retained.score<.08?retained:best;
}
export function confirmStonePlacement(proposal,{stone,collides,support,inside}){
  if(!proposal||!inside(proposal.position,stone)||collides(proposal.position,stone)||support(proposal.position,stone)<.35)return null;
  return {position:[...proposal.position]};
}
