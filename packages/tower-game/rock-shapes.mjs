/**
 * Decode the 23 authored irregular rock meshes without replacing their topology.
 *
 * Source vertices are packed in X,Z,Y order (the original FBX was Z-up).
 * Their axis swap reverses triangle winding, so original face winding is flipped
 * to match the renderer. Both WebGL and masonry geometry use these exact meshes.
 * Local coordinates remain centred in the unit bounding cell.
 */
export function originalRockMesh(source,variant=0){
 const [vertexCount,faceCount,base,alternate,encoded]=source;
 if(!Number.isInteger(vertexCount)||!Number.isInteger(faceCount)||!Array.isArray(base)||!Array.isArray(alternate)||typeof encoded!=='string'){
  throw new Error('Invalid authored stone mesh');
 }
 const binary=atob(encoded);
 if(binary.length!==3*(vertexCount+faceCount))throw new Error('Invalid authored stone payload');
 const positions=new Float32Array(vertexCount*3),colors=new Float32Array(vertexCount*3);
 for(let i=0;i<vertexCount;i++){
  const x=binary.charCodeAt(i*3)/255,y=binary.charCodeAt(i*3+2)/255,z=binary.charCodeAt(i*3+1)/255;
  positions.set([x-.5,y-.5,z-.5],i*3);
  // Modest intrinsic colour variation preserves the original palette without
  // imposing procedural cubic geometry on the source silhouette.
  const wave=(Math.sin(x*11.7+z*7.3+variant*.87)+Math.cos(y*8.4-x*9.1))*.12;
  const blend=Math.max(0,Math.min(1,.48+wave)),shade=.92+.07*y;
  for(let channel=0;channel<3;channel++){
   colors[i*3+channel]=Math.max(0,Math.min(1,(base[channel]*(1-blend)+alternate[channel]*blend)*shade/255));
  }
 }
 const indices=new Uint16Array(faceCount*3),offset=vertexCount*3;
 for(let i=0;i<faceCount;i++){
  const a=binary.charCodeAt(offset+i*3),b=binary.charCodeAt(offset+i*3+1),c=binary.charCodeAt(offset+i*3+2);
  if(a>=vertexCount||b>=vertexCount||c>=vertexCount)throw new Error('Stone triangle index out of range');
  indices.set([a,c,b],i*3);
 }
 return {positions,colors,indices};
}

/** Volume of a closed mesh in units of the construction bounding box.
 * Source meshes are not always perfectly closed: this is diagnostic, not a
 * sizing target and not an occupancy oracle for server placement. */
export function rockMeshVolume(mesh){
 const {positions:p,indices:index}=mesh;let v=0;
 for(let i=0;i<index.length;i+=3){
  const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
  v+=(p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])
    +p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])
    +p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]))/6;
 }
 return Math.abs(v);
}
