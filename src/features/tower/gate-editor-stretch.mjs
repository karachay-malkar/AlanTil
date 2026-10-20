/**
 * Minimal runtime reproduction of the user's manual gate edit.
 * Source: assets/tower/prefabs/architectural/gate-18x10x2-editor-stretch-v8.json
 *
 * The editor's parent position [0.663945, -0.101546, -0.006991] is a
 * staging position, not a prefab-local geometry edit. Retain the game's
 * authoritative 18x10x2 cell footprint, section ID, and world position.
 *
 * For this export, the only visual changes are:
 *   gate scale.x: 1 -> 1.011
 *   mesh index 101 scale.x: 1 -> 1.011
 * Indices 140/180 retain identity; mesh 591 has quaternion [0,0,0,-1],
 * which is the same orientation as [0,0,0,1]. Do not reset original
 * mesh-local translations or materials.
 */
export const GATE_EDITOR_STRETCH_VERSION='gate-editor-stretch-v8.1';
export const GATE_EDITOR_STRETCH_SCALE_X=1.011;
export const GATE_EDITOR_STRETCH_PART=101;

export function applyGateEditorStretch(gate){
 if(!gate||typeof gate.traverse!=='function'||!Number.isFinite(gate.scale?.x))
  throw new TypeError('Gate GLB root is unavailable');
 const meshes=[];
 gate.traverse(node=>{if(node.isMesh)meshes.push(node);});
 const part=meshes[GATE_EDITOR_STRETCH_PART];
 if(!part||!Number.isFinite(part.scale?.x))
  throw new Error('Gate GLB topology differs from the authored editor export: part 101 missing');
 // The second 1.011 factor affects only this mesh; every other mesh
 // keeps its existing authored transforms.
 part.scale.x*=GATE_EDITOR_STRETCH_SCALE_X;
 gate.scale.x*=GATE_EDITOR_STRETCH_SCALE_X;
 gate.updateMatrixWorld?.(true);
 return gate;
}
