/** 17.5.5 wall variants share a single immutable library of authored stones. */
export const COMPACT_STONE_VERSION='17.5.5';
export const COMPACT_STONE_TYPES=Object.freeze(['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4']);
export const COMPACT_STONE_VARIANTS=5;
export const isCompactStone=(id)=>COMPACT_STONE_TYPES.includes(id);
export function validateCompactStoneRecipe(pack,sectionId,variant){
 if(!pack||pack.version!==COMPACT_STONE_VERSION||!Number.isInteger(variant)||variant<0||variant>=COMPACT_STONE_VARIANTS||!isCompactStone(sectionId))throw new TypeError('Unsupported compact masonry version/type');
 const recipe=pack.variants?.[sectionId]?.[variant];
 if(!recipe||!Array.isArray(recipe.placement)||recipe.placement.length<1||recipe.placement.length>512)throw new TypeError('Corrupt compact masonry recipe');
 const allowed=new Set(pack.shapes||[]);
 for(const p of recipe.placement){
  if(!Array.isArray(p)||p.length!==13||!allowed.has(p[0])||/^(A|B)_/.test(p[0])||p.slice(1).some(x=>!Number.isFinite(x)))throw new TypeError('Invalid stone transform');
 }
 return recipe;
}
