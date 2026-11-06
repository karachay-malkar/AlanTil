import { msg } from "../../shared/i18n/index.js?v=16.8.0.3";
import { getWords } from "../../shared/data/word-repository.js?v=16.8.0.3";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=16.8.0.3";
import { resumeMatchSession, suspendMatchForResume } from "./engine.js?v=16.8.0.3";
import { clearMatchSession, matchState } from "./state.js?v=16.8.0.3";
import { renderMatchGame, renderMatchMenu, renderMatchResult } from "./view.js?v=16.8.0.3";

let controller=null;
let skipAutoResumeOnce=false;
export function mount(context, params = {}) {
  controller = new AbortController();
  const signal = controller.signal;
  if (params.screen && params.screen !== "menu") return mountScreen(context, params, signal);
  context.root.innerHTML = `<div class="screenState">${msg("common.otkryvaem")}</div>`;
  void mountScreen(context, params, signal).catch(error => {
    if (signal.aborted) return;
    console.warn("match loading failed", error);
    context.root.innerHTML = `<div class="errorState">${msg("common.ne_udalos_otkryt_razdel")}</div>`;
  });
}
async function mountScreen(context,params,signal){wordFavorites.reload();const words=await getWords();
  if (signal.aborted) return;let screen=params.screen||"menu";
  if(screen==="menu"){
    if(skipAutoResumeOnce)skipAutoResumeOnce=false;
    else if(!matchState.session.inProgress&&resumeMatchSession(words)){screen="game";context.router.canonicalize?.("match.game",{});}
    else if(matchState.session.completed)clearMatchSession();
  }
  if(screen==="game"&&(!matchState.session.inProgress||!matchState.total)){
    if(resumeMatchSession(words))screen="game";
    else{screen="menu";context.router.canonicalize?.("match.menu",{});}
  }
  if(screen==="results"&&!matchState.session.completed){screen="menu";context.router.canonicalize?.("match.menu",{});}
  matchState.currentScreen=screen;const titles={menu:msg("match.sopostav_slova"),game:msg("match.sopostav_slova"),results:msg("match.rezultat_igry")};context.shell.setHeaderContent?.({title:titles[screen]||msg("match.sopostav_slova"),logo:true,brand:false});
  if(screen==="menu")renderMatchMenu(context,words,controller.signal);else if(screen==="game")renderMatchGame(context,words,controller.signal);else if(screen==="results")renderMatchResult(context,words,controller.signal);else context.router.replace("match.menu",{},{force:true});
}
export function onLeave(reason="route_change"){
  if(matchState.currentScreen!=="game")return;
  const wasInProgress=matchState.session.inProgress&&!matchState.session.completed;
  const tracker=matchState.session.tracker;
  if(tracker?.getStatus()==="active")tracker.abandon(reason,{items_total:matchState.total,items_completed:matchState.solvedCount,pairs_total:matchState.total,pairs_completed:matchState.solvedCount,progress_percent:Math.round((matchState.solvedCount/Math.max(1,matchState.total))*100),errors_count:matchState.errorsCount});
  if(wasInProgress){if(reason==="back")skipAutoResumeOnce=true;suspendMatchForResume();}
}
export function unmount(){controller?.abort();controller=null;if(matchState.currentScreen==="game"&&!matchState.session.completed)clearMatchSession();}
export function canLeave(){return !(matchState.currentScreen==="game"&&matchState.session.inProgress&&!matchState.session.completed);}