// Exact surface and responsive padding from Web 13.15.12 theme.css / learn.css.
export const LEARN_SURFACE=Object.freeze({angle:145,start:'#f8f5ed',startOpacity:.92,end:'#e8e0d3',endOpacity:.9});
export function cssGradientLine(width,height,angle=LEARN_SURFACE.angle){
 const radians=angle*Math.PI/180,dx=Math.sin(radians),dy=-Math.cos(radians);
 const length=Math.abs(width*dx)+Math.abs(height*dy);
 return {x1:width/2-dx*length/2,y1:height/2-dy*length/2,x2:width/2+dx*length/2,y2:height/2+dy*length/2};
}
export function learnCardPadding(width){
 const front=Math.max(22,Math.min(42,width*.05));
 return {frontHorizontal:width<=420?18:front,frontVertical:width<=420?22:front,backHorizontal:width<=420?18:Math.max(18,Math.min(30,width*.04))};
}
