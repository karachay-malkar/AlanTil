/** Timber fork supports (багъана). Height choices refer to the wood only.
 * Each GLB includes a 0.25m natural stone base; all dimensions are integer 25cm cells.
 * Legacy 17.2-bagana.1 prefab remains readable for existing towers.
 */
export const BAGANA_PREFAB_ID='bagana-2x10x2';
export const BAGANA_PREFAB_VERSION='17.2-bagana.1';
export const BAGANA_RENDER_VERSION='17.2-bagana-wood.1';
export const BAGANA_PREFAB_FILE='/assets/tower/approved-library/architecture/bagana-2x10x2-v1.glb';
export const BAGANA_PREFAB_SPEC=Object.freeze({
 id:BAGANA_PREFAB_ID,size:Object.freeze([2,10,2]),
 variants:Object.freeze([Object.freeze({file:BAGANA_PREFAB_FILE})]),jointInterface:null
});
export const BAGANA_PREFAB_VERSION_V2='17.2-bagana.2';
export const BAGANA_RENDER_VERSION_V2='17.2-bagana-wood-rock.3';
export const BAGANA_WOOD_HEIGHT_CELLS=Object.freeze([8,9,10,11,12]);
export const baganaType=(form,woodCells)=>`bagana-f${form}-3x${woodCells+1}x3`;
export const BAGANA_PREFABS=Object.freeze([1,2,3].flatMap(form=>
 BAGANA_WOOD_HEIGHT_CELLS.map(woodCells=>Object.freeze({
  id:baganaType(form,woodCells),form,woodCells,
  woodHeightM:woodCells*.25,stoneHeightM:.25,
  size:Object.freeze([3,woodCells+1,3]),
  file:`/assets/tower/approved-library/architecture/${baganaType(form,woodCells)}-v2.glb`
 }))
));
const byId=new Map(BAGANA_PREFABS.map(b=>[b.id,b]));
export const baganaPrefab=id=>byId.get(id)||null;
/** Cycle the three supported fork shapes without changing the chosen wood height. */
export const nextBaganaType=id=>{
 const current=baganaPrefab(id);
 return current?baganaType(current.form%3+1,current.woodCells):null;
};
export const isBaganaPrefab=id=>id===BAGANA_PREFAB_ID||byId.has(id);
