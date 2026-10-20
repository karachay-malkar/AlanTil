/** AlanTil 17.6 independently baked wild stone door (no engine-side stone cubes). */
export const DOOR_PREFAB_ID='door-7x9x2';
export const DOOR_PREFAB_VERSION='17.6-door.1';
export const DOOR_RENDER_VERSION='17.6-rock-face-02.1';
export const DOOR_STONE_FILE='/assets/tower/approved-library/architecture/door-7x9x2-stone-v1.glb';
export const DOOR_WOOD_FILE='/assets/tower/approved-library/architecture/door-wood-v1.glb';
export const DOOR_PREFAB_SPEC=Object.freeze({
 id:DOOR_PREFAB_ID,size:Object.freeze([7,9,2]),
 variants:Object.freeze([Object.freeze({file:DOOR_STONE_FILE})]),
 jointInterface:null,architecturalOpening:Object.freeze({width:.75,height:2,depth:.5})
});
