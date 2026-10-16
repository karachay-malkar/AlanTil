/** Five deterministic pre-baked wild masonry variants, each using original 36 Rock meshes.
 * Pre-existing sections retain the original geometryVersion and rendered asset.
 */
export const WILD_PREFAB_VERSION='17.5.3';
export const WILD_PREFAB_IDS=Object.freeze(['2x2x2','4x4x4']);
export const WILD_VARIANTS_PER_SIZE=5;
export const WILD_STYLES=Object.freeze(['Дикая смешанная','Продольные камни','Ломаная рваная','Крупные валуны','Мелкая перевязка']);
export const isWildPrefab=id=>WILD_PREFAB_IDS.includes(id);
