export function masteryLevelForPercent(percent){const value=Math.max(0,Math.min(100,Number(percent)||0));return value>=100?3:value>=90?2:value>=80?1:0;}
export function masteryMarkForPercent(percent){const level=masteryLevelForPercent(percent);return{level,mark:level?'⌃'.repeat(level):'—',label:level?`${['','I','II','III'][level]} знак`:'не сдан'};}
