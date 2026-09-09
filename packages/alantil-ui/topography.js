// Web 13.15.12 theme.css --topographic-lines, farthest-corner ellipses.
export function topographyLayers(size=420){
  const ellipse=(x,y,stops)=>({cx:x*size,cy:y*size,rx:Math.SQRT2*Math.max(x,1-x)*size,ry:Math.SQRT2*Math.max(y,1-y)*size,stops});
  const upper=ellipse(.16,.12,[[0,0],[.16,0],[.162,.10],[.166,.10],[.168,0],[.23,0],[.232,.08],[.236,.08],[.238,0],[1,0]]);
  const middle=ellipse(.78,.48,[[0,0],[.17,0],[.172,.08],[.176,.08],[.178,0],[.25,0],[.252,.07],[.256,.07],[.258,0],[1,0]]);
  const lower=ellipse(.55,.92,[]);
  // CSS radial length stops are measured on the horizontal gradient ray.
  for(let base=0;base<lower.rx+39;base+=39){
    for(const [distance,opacity] of [[0,0],[26,0],[27,.045],[28,.045],[29,0],[39,0]])lower.stops.push([(base+distance)/lower.rx,opacity]);
  }
  const beyond=lower.stops.findIndex(([offset])=>offset>1);
  if(beyond>0){const [a,alpha]=lower.stops[beyond-1],[b,beta]=lower.stops[beyond];lower.stops=lower.stops.slice(0,beyond);lower.stops.push([1,alpha+(beta-alpha)*(1-a)/(b-a)]);}
  // CSS paints the first background layer on top.
  return [lower,middle,upper];
}
