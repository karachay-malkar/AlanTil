import { getWords } from "../../shared/data/word-repository.js?v=13.15.12";
import { getCurrentAuthState } from "../../shared/auth/auth-service.js?v=13.10.12";
import { getSupabaseClient } from "../../shared/auth/supabase-client.js?v=13.10.12";
import { getUserSettings } from "../../shared/settings/user-settings-store.js?v=13.15.12";
import { msg } from "../../shared/i18n/index.js?v=16.6.11";
import { mountAshykGame } from "./runtime.js?v=16.6.11";

let controller=null;
let disposeGame=null;

export async function mount(context){
  controller=new AbortController();
  context.shell.setHeaderContent?.({title:msg("practice.ashyk")});
  context.root.innerHTML='<section class="view ashykView"><div class="ashykHost" data-ashyk-host></div></section>';
  const host=context.root.querySelector('[data-ashyk-host]');
  const [words,supabaseClient]=await Promise.all([
    getWords().catch(()=>[]),
    getSupabaseClient().catch(()=>null),
  ]);
  if(controller.signal.aborted||!host)return;
  const settings=getUserSettings();
  const auth=getCurrentAuthState();
  disposeGame=mountAshykGame(host,{
    words,
    locale:settings.interface_language_code,
    supabaseClient,
    userId:String(auth?.session?.user?.id||''),
  });
}

export function unmount(){
  controller?.abort();
  controller=null;
  disposeGame?.();
  disposeGame=null;
}

export function canLeave(){return true;}
