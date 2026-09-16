export function masteryLevelForPercent(percent){const value=Math.max(0,Math.min(100,Number(percent)||0));return value>=100?3:value>=90?2:value>=80?1:0;}
const MASTERY_LABEL_KEYS=['stage.ne_sdan','stage.i_znak','stage.ii_znak','stage.iii_znak'];
export function masteryMarkForPercent(percent,translate){const level=masteryLevelForPercent(percent),key=level?MASTERY_LABEL_KEYS[level]:MASTERY_LABEL_KEYS[0],label=typeof translate==='function'?translate(key):level?`${['','I','II','III'][level]} знак`:'не сдан';return{level,mark:level?'⌃'.repeat(level):'—',label};}
