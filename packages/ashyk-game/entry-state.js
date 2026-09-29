let pending=false;

export function beginAshykEntry(){pending=true;}
export function finishAshykEntry(){pending=false;}
export function isAshykEntryPending(){return pending;}
export function resetAshykEntry(){pending=false;}
