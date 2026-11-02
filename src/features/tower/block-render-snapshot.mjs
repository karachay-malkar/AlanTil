/** Stable per-section render snapshots, rebuilt only when its signature changes. */
export function captureBlockRenderSnapshot(THREE,group){
 group.updateMatrixWorld(true);
 const box=new THREE.Box3().setFromObject(group);
 const targets=[];
 group.traverse(node=>{if(node.isMesh&&node.userData.block)targets.push(node);});
 return {bounds:box.isEmpty()?null:{min:box.min.clone(),max:box.max.clone()},targets};
}
export function rebindCachedBlockTargets(group,block,targets){
 group.userData.block=block;
 for(const mesh of targets)mesh.userData.block=block;
}
export function areSameRenderedBlocks(visible,rendered,signatureForBlock){
 return visible.length===rendered.size&&
  visible.every(block=>rendered.get(block.id)?.signature===signatureForBlock(block));
}
