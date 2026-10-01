export const ASHYK_FEATURE_FLAGS=Object.freeze({
  enabled:true,
  allowGuests:true,
  allowComputer:true,
  allowOnlineFriend:true,
  allowLocalSameDevice:false,
});

export function ashykAccessForUser(userId=''){
  const registered=Boolean(String(userId||'').trim());
  const locked=!ASHYK_FEATURE_FLAGS.enabled||(!registered&&!ASHYK_FEATURE_FLAGS.allowGuests);
  const modes=[];
  if(!locked&&ASHYK_FEATURE_FLAGS.allowComputer)modes.push('computer');
  if(!locked&&ASHYK_FEATURE_FLAGS.allowLocalSameDevice)modes.push('local');
  if(!locked&&registered&&ASHYK_FEATURE_FLAGS.allowOnlineFriend)modes.push('online');
  return Object.freeze({enabled:ASHYK_FEATURE_FLAGS.enabled,registered,locked,modes:Object.freeze(modes)});
}

export function isAshykModeAllowed(mode,{userId=''}={}){
  return ashykAccessForUser(userId).modes.includes(String(mode||''));
}

export function ashykModeAccess(mode,{userId=''}={}){
  const id=String(mode||'').trim();
  const access=ashykAccessForUser(userId);
  const visible=Boolean(ASHYK_FEATURE_FLAGS.enabled&&(id==='computer'?ASHYK_FEATURE_FLAGS.allowComputer:id==='local'?ASHYK_FEATURE_FLAGS.allowLocalSameDevice:id==='online'?ASHYK_FEATURE_FLAGS.allowOnlineFriend:false));
  const allowed=visible&&access.modes.includes(id);
  return Object.freeze({mode:id,visible,allowed,requiresAuth:Boolean(visible&&id==='online'&&!access.registered)});
}

export function ashykVisibleModesForUser(userId=''){
  return Object.freeze(['computer','local','online'].map((id)=>Object.freeze({id,...ashykModeAccess(id,{userId})})).filter((item)=>item.visible));
}

export function normalizeAshykMode(mode,{userId=''}={}){
  const access=ashykAccessForUser(userId),value=String(mode||'');
  return access.modes.includes(value)?value:(access.modes[0]||'computer');
}
