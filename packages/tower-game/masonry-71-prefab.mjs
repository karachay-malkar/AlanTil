/** Versioned 25 built sections made from the approved 71 individually sculpted Balkar rocks. */
export const MASONRY71_VERSION='17.5.5';
export const MASONRY71_SIZES=Object.freeze(["1x1x1","2x2x2","2x2x3","2x3x4","4x4x4"]);
export const MASONRY71_VARIANTS=5;
export const MASONRY71_STYLES=Object.freeze(["Дикая короткая","Преобладают средние","Нерегулярная перевязка","Массивные опорные","Смешанная плотная"]);
export const isMasonry71=id=>MASONRY71_SIZES.includes(id);
