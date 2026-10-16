/** 25 versioned wall GLBs from all 486 approved gate v7 stone meshes. */
export const GATE_STONE_VERSION='17.5.4';
export const GATE_STONE_TYPES=Object.freeze(['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4']);
export const GATE_STONE_VARIANTS=5;
export const GATE_STONE_STYLES=Object.freeze(['Дикая перевязка','Крупный горизонтальный камень','Рваная нерегулярная кладка','Валуны с переменной толщиной','Плотная смешанная кладка']);
export const isGateStone=id=>GATE_STONE_TYPES.includes(id);
