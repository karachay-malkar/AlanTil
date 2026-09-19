export const ASHYK_FEATURE_FLAGS=Object.freeze({
  enabled:true,
  allowGuests:false,
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

export function normalizeAshykMode(mode,{userId=''}={}){
  const access=ashykAccessForUser(userId),value=String(mode||'');
  return access.modes.includes(value)?value:(access.modes[0]||'computer');
}
