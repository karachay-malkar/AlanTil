import { getCompleteDictionaryWords, refreshDictionary } from "../../shared/data/word-repository.js?v=13.15.12";
import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.10.12";
import { getSupabaseClient } from "../../shared/auth/supabase-client.js?v=13.10.12";
import { getUserSettings } from "../../shared/settings/user-settings-store.js?v=13.15.12";
import { msg } from "../../shared/i18n/index.js?v=16.6.12";
import { fetchFriendsSnapshot } from "../../shared/social/social-service.js?v=16.7.0.2";
import { takePendingAshykInvite } from "../../shared/social/ashyk-handoff.js?v=16.7.0.2";
import { createAshykOnlineAdapter } from "../../../packages/ashyk-game/online.js?v=16.7.0.15";
import { ashykAccessForUser } from "../../../packages/alantil-core/ashyk-access.js?v=16.7.0.3";
import { socialMessage } from "../../../packages/alantil-core/social-i18n.js?v=16.7.0.3";
import { createAshykQuestionDeck } from "../../../packages/ashyk-game/vocabulary.js?v=16.7.0.3";
import { mountAshykGame } from "./runtime.js?v=16.7.0.25";

let controller=null;
let disposeGame=null;
let sessionActive=false;
let activeRoomId=null;
let onlineAdapter=null;


function hasQuestionSource(words){
  try{
    const deck=createAshykQuestionDeck(words);
    return deck.size>0&&Boolean(deck.next());
  }catch{
    return false;
  }
}

async function loadAshykWords(signal){
  let collection=await getCompleteDictionaryWords({signal});
  if(hasQuestionSource(collection))return collection;
  const refreshed=await refreshDictionary({signal,force:true});
  collection=Array.isArray(refreshed?.words)?refreshed.words:[];
  if(!hasQuestionSource(collection))throw new Error('ASHYK_DICTIONARY_INCOMPLETE');
  return collection;
}

export async function mount(context){
  controller=new AbortController();
  sessionActive=false;
  context.shell.setHeaderContent?.({title:msg("practice.ashyk")});
  context.root.innerHTML='<section class="view ashykView"><div class="ashykHost" data-ashyk-host></div></section>';
  const host=context.root.querySelector('[data-ashyk-host]');
  const settings=getUserSettings();
  const auth=getCurrentAuthState();
  const userId=String(auth?.session?.user?.id||'');
  const access=ashykAccessForUser(userId);
  if(access.locked){
    host.innerHTML=`<div class="ashykAccessLock"><h1>${msg("practice.ashyk")}</h1><p>${socialMessage(settings.interface_language_code,'ashykRegisteredOnly')}</p><button class="btn actionPrimary" type="button" data-ashyk-sign-in>${socialMessage(settings.interface_language_code,'signInAction')}</button></div>`;
    host.querySelector('[data-ashyk-sign-in]')?.addEventListener('click',()=>context.router.navigate('account.home'),{signal:controller.signal});
    return;
  }
  let words=[];
  let supabaseClient=null;
  let social={friends:[]};
  try{
    [words,supabaseClient,social]=await Promise.all([
      loadAshykWords(controller.signal),
      getSupabaseClient().catch(()=>null),
      fetchFriendsSnapshot().catch(()=>({friends:[]})),
    ]);
  }catch(error){
    if(controller.signal.aborted||!host)return;
    console.error('Ashyk dictionary load failed',error);
    host.innerHTML=`<div class="ashykAccessLock"><h1>${msg("practice.ashyk")}</h1><p>${msg("settings.ne_udalos_obnovit_slovar")}</p></div>`;
    return;
  }
  if(controller.signal.aborted||!host)return;
  const pending=takePendingAshykInvite();
  onlineAdapter=supabaseClient&&userId?createAshykOnlineAdapter(supabaseClient):null;
  const recovered=pending?.room||(onlineAdapter?await onlineAdapter.getActiveRoom().catch(()=>null):null);
  activeRoomId=recovered?.id||null;
  disposeGame=mountAshykGame(host,{
    words,
    locale:settings.interface_language_code,
    supabaseClient,
    userId,
    friends:Array.isArray(social?.friends)?social.friends:[],
    initialRoom:recovered||null,
    onSessionActiveChange(active){sessionActive=Boolean(active);},
    onRoomChange(room){activeRoomId=room?.id||null;},
    onExit(){history.back();},
  });
}

export async function onLeave(){
  if(sessionActive&&activeRoomId&&onlineAdapter)await onlineAdapter.leaveRoom(activeRoomId).catch(()=>{});
}

export function unmount(){
  controller?.abort();
  controller=null;
  sessionActive=false;
  disposeGame?.();
  disposeGame=null;
  activeRoomId=null;
  onlineAdapter=null;
}

export function canLeave(){return !sessionActive;}
