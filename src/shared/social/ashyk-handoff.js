let pending=null;
export function setPendingAshykInvite(value){pending=value&&value.room?{room:value.room,invite:value.invite||null}:null;}
export function takePendingAshykInvite(){const value=pending;pending=null;return value;}
export function peekPendingAshykInvite(){return pending;}
