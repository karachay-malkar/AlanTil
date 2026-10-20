/** Initial positions for new Common 100 stones; never alters existing recipe transforms.
 * Axes: X to the right of the dashed cube, Y up, Z along the staging lane.
 * Coordinates and dimensions are metres.
 */
export const STAGING_CLEARANCE = 0.12; // >10 cm from the cube after 6-decimal serialization
export const STAGING_GAP = 0.035;
const CELL_METERS = 0.25;
const round = n => Math.round(n * 1e6) / 1e6;

/** Axis-aligned half extents of a scaled and quaternion-rotated centred GLB mesh. */
export function worldHalfExtents(dimensions, quaternion = [0,0,0,1], scale = [1,1,1]) {
 const [x,y,z,w] = quaternion;
 const norm = Math.hypot(x,y,z,w) || 1;
 const a=x/norm,b=y/norm,c=z/norm,d=w/norm;
 const hx=Math.abs(dimensions[0]*scale[0])*.5;
 const hy=Math.abs(dimensions[1]*scale[1])*.5;
 const hz=Math.abs(dimensions[2]*scale[2])*.5;
 const xx=1-2*(b*b+c*c), xy=2*(a*b-c*d), xz=2*(a*c+b*d);
 const yx=2*(a*b+c*d), yy=1-2*(a*a+c*c), yz=2*(b*c-a*d);
 const zx=2*(a*c-b*d), zy=2*(b*c+a*d), zz=1-2*(a*a+b*b);
 return [
  Math.abs(xx)*hx+Math.abs(xy)*hy+Math.abs(xz)*hz,
  Math.abs(yx)*hx+Math.abs(yy)*hy+Math.abs(yz)*hz,
  Math.abs(zx)*hx+Math.abs(zy)*hy+Math.abs(zz)*hz
 ];
}

/** Place a new stone right of the cube, advancing down a collision-free Z lane.
 * Existing stones (including user-authored outliers) stay exactly where they are.
 */
export function stagingPosition({cells, dimensions, stones, dimensionsFor,
 quaternion=[0,0,0,1],scale=[1,1,1]}) {
 const half=worldHalfExtents(dimensions,quaternion,scale);
 const x=cells[0]*CELL_METERS*.5+STAGING_CLEARANCE+half[0];
 const y=half[1];
 const obstacles=[];
 for(const stone of stones) {
  const size=dimensionsFor(stone.name);
  if(!size)continue;
  const ext=worldHalfExtents(size,stone.quaternion,stone.scale);
  // A stone elsewhere cannot intersect the staging lane at the selected height.
  if(Math.abs(stone.position[0]-x) >= half[0]+ext[0]+STAGING_GAP)continue;
  if(Math.abs(stone.position[1]-y) >= half[1]+ext[1]+STAGING_GAP)continue;
  obstacles.push({z:stone.position[2],halfZ:ext[2]});
 }
 // Monotonic movement ensures termination even when many stones share positions.
 let z=0;
 for(let pass=0;pass<=obstacles.length;pass++){
  let next=z;
  for(const obstacle of obstacles){
   if(Math.abs(z-obstacle.z) < half[2]+obstacle.halfZ+STAGING_GAP){
    next=Math.max(next,obstacle.z+obstacle.halfZ+half[2]+STAGING_GAP);
   }
  }
  if(next===z)break;
  z=next;
 }
 return [round(x),round(y),round(z)];
}
