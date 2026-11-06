/** AlanTil 17.6 independently baked wild stone door (no engine-side stone cubes). */
export const DOOR_PREFAB_ID='door-7x9x2';
export const DOOR_PREFAB_VERSION='17.6-door.1';
export const DOOR_RENDER_VERSION='17.2.82';
export const DOOR_STONE_FILE='/assets/tower/approved-library/architecture/optimized/door-7x9x2-stone-v1-meshopt.glb';
export const DOOR_WOOD_FILE='/assets/tower/approved-library/architecture/optimized/door-wood-v1-webp.glb';
export const DOOR_PREFAB_SPEC=Object.freeze({
 id:DOOR_PREFAB_ID,size:Object.freeze([7,9,2]),
 variants:Object.freeze([Object.freeze({file:DOOR_STONE_FILE})]),
 jointInterface:null,architecturalOpening:Object.freeze({width:.75,height:2,depth:.5})
});
