// Both renderers use the same recovery cadence and stale-response rules.
export function shouldAcceptRoom(previous, incoming) {
  if (!incoming) return false;
  if (!previous || previous.id !== incoming.id) return true;
  if (Number(incoming.revision || 0) < Number(previous.revision || 0)) return false;
  if (Number(incoming.phase_seq || 0) < Number(previous.phase_seq || 0)) return false;
  if (previous.status !== 'waiting' && incoming.status === 'waiting') return false;
  if (['finished', 'abandoned'].includes(previous.status) && ['waiting', 'playing'].includes(incoming.status)) return false;
  if (incoming.updated_at && previous.updated_at && Date.parse(incoming.updated_at) < Date.parse(previous.updated_at)) return false;
  return true;
}

export function startRoomReconciliation({online, roomId, getRoom, applyRoom, setConnection=()=>{}, canReady=()=>true, setTimer=globalThis.setTimeout, clearTimer=globalThis.clearTimeout}) {
  let stopped=false, timer=null, failures=0;
  const current=()=>!stopped && getRoom()?.id===roomId;
  async function pulse() {
    if (!current() || !['waiting','playing'].includes(getRoom().status)) return;
    try {
      const room=getRoom();
      const next=await (room.status==='waiting' ? (canReady()?online.markReady(roomId):online.markNotReady(roomId)) : online.pingRoom(roomId));
      if (!current()) return;
      if (next) applyRoom(next);
      failures=0;
      setConnection('online');
    } catch {
      if (!current()) return;
      failures++;
      setConnection('reconnecting');
      // A failed Ready may already have committed on the server.
      try { const next=await online.getRoom(roomId); if (current() && next) applyRoom(next); } catch {}
    } finally {
      if (current() && ['waiting','playing'].includes(getRoom().status)) {
        const delay=failures ? Math.min(5000,1000*2**Math.min(failures-1,3)) : getRoom().status==='waiting'?1000:3000;
        timer=setTimer(pulse,delay);
      }
    }
  }
  void pulse();
  return ()=>{stopped=true;if(timer!==null)clearTimer(timer);};
}

export function createOperationLock() {
  let locked=false;
  return {acquire(){if(locked)return false;locked=true;return true;},release(){locked=false;}};
}

// Work is scheduled before Challenge is pressed; small batches yield to input.
export function prepareInitialField(engine, onReady, onError=()=>{}) {
  let cancelled=false, timer=null, batches=0;
  function step() {
    if(cancelled)return;
    try {
      engine.settleInitial(20);
      if(engine.isReady()){onReady(engine.snapshot());return;}
      if(++batches>=90){onError(new Error('ASHYK_INITIAL_FIELD_NOT_READY'));return;}
      timer=setTimeout(step,16);
    } catch(error){onError(error);}
  }
  timer=setTimeout(step,0);
  return ()=>{cancelled=true;clearTimeout(timer);};
}
