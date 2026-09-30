export const ASHYK_FEATURE_FLAGS=Object.freeze({
  enabled:true,
  allowGuests:true,
  allowComputer:true,
  allowOnlineFriend:true,
  allowLocalSameDevice:false,
});

export function ashykModeOptionsForUser(userId=''){
  const registered=Boolean(String(userId||'').trim());
  if(!ASHYK_FEATURE_FLAGS.enabled)return Object.freeze([]);
  const options=[];
  if(ASHYK_FEATURE_FLAGS.allowComputer)options.push(Object.freeze({id:'computer',allowed:registered||ASHYK_FEATURE_FLAGS.allowGuests,requiresRegistration:!registered&&!ASHYK_FEATURE_FLAGS.allowGuests}));
  if(ASHYK_FEATURE_FLAGS.allowLocalSameDevice)options.push(Object.freeze({id:'local',allowed:registered,requiresRegistration:!registered}));
  if(ASHYK_FEATURE_FLAGS.allowOnlineFriend)options.push(Object.freeze({id:'online',allowed:registered,requiresRegistration:!registered}));
  return Object.freeze(options);
}

export function ashykAccessForUser(userId=''){
  const registered=Boolean(String(userId||'').trim());
  const options=ashykModeOptionsForUser(userId);
  const modes=options.filter((option)=>option.allowed).map((option)=>option.id);
  const locked=!ASHYK_FEATURE_FLAGS.enabled||modes.length===0;
  return Object.freeze({enabled:ASHYK_FEATURE_FLAGS.enabled,registered,locked,modes:Object.freeze(modes),options});
}

export function isAshykModeAllowed(mode,{userId=''}={}){
  return ashykAccessForUser(userId).modes.includes(String(mode||''));
}

export function normalizeAshykMode(mode,{userId=''}={}){
  const access=ashykAccessForUser(userId),value=String(mode||'');
  return access.modes.includes(value)?value:(access.modes[0]||'computer');
}
