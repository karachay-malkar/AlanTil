// Navigation must wait for the authoritative terminal result, including retries.
export function isNaturalAshykComputerCompletion(state){
  return Boolean(state?.gameMode==='computer'&&state?.status==='finished'&&state?.lastOutcome?.code==='capture');
}

export function createAshykLeaveController({getGame,confirm,message,onError=()=>{}}){
  let pending=null;
  const run=async()=>{
    const game=getGame();
    const state=game?.getState();
    if(!state||!['playing','waiting'].includes(state.status))return true;
    if(state.status==='playing'&&!(await confirm(message)))return false;
    try{await game.resign();return true;}catch(error){onError(error);return false;}
  };
  return {requestLeave(){if(pending)return pending;pending=run().finally(()=>{pending=null;});return pending;}};
}
