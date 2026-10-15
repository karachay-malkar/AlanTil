/** AlanTil 17.6 window prefab: immutable architectural add-on. */
export const WINDOW_PREFAB_ID='window-4x5x2';
export const WINDOW_PREFAB_VERSION='17.6-window.1';
export const WINDOW_RENDER_VERSION='17.6-window.2';
export const WINDOW_WOOD_FILE='/assets/tower/prefabs/architectural/window-wood-v3.glb';
export const WINDOW_JOINT_FILES=Object.freeze({
 x:'/assets/tower/prefabs/architectural/window-joint-x-v1.glb',
 y:'/assets/tower/prefabs/architectural/window-joint-y-v1.glb',
 z:'/assets/tower/prefabs/architectural/window-joint-z-v1.glb',
 corner:'/assets/tower/prefabs/architectural/window-joint-corner-v1.glb'
});
export const WINDOW_PREFAB_FILE='/assets/tower/prefabs/architectural/window-4x5x2-v2.glb';
export const WINDOW_PREFAB_SPEC=Object.freeze({
 id:WINDOW_PREFAB_ID,size:Object.freeze([4,5,2]),
 variants:Object.freeze([Object.freeze({file:WINDOW_PREFAB_FILE})]),
 jointInterface:null,architecturalOpening:Object.freeze({width:.5,height:1,depth:.5})
});
