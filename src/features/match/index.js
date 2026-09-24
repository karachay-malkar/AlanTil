import { msg } from "../../shared/i18n/index.js?v=16.8.0.3";
import { getWords } from "../../shared/data/word-repository.js?v=16.8.0.3";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=16.8.0.3";
import { resumeMatchSession, suspendMatchForResume } from "./engine.js?v=16.8.0.3";
import { clearMatchSession, matchState } from "./state.js?v=16.8.0.3";
import { renderMatchGame, renderMatchMenu, renderMatchResult } from "./view.js?v=16.8.0.3";

let controller=null;
export async function mount(context,params={}){
  controller=new AbortController();wordFavorites.reload();const words=await getWords();let screen=params.screen||"menu";
  if(screen==="menu"&&!matchState.session.inProgress&&resumeMatchSession(words)){await context.router.replace("match.game",{},{force:true});return;}
  if(screen==="game"&&(!matchState.session.inProgress||!matchState.total)){if(resumeMatchSession(words)){screen="game";}else{await context.router.replace("match.menu",{},{force:true});return;}}
  if(screen==="results"&&!matchState.session.completed){await context.router.replace("match.menu",{},{force:true});return;}
  matchState.currentScreen=screen;const titles={menu:msg("match.sopostav_slova"),game:msg("match.sopostav_slova"),results:msg("match.rezultat_igry")};context.shell.setHeaderContent?.({title:titles[screen]||msg("match.sopostav_slova"),logo:true,brand:false});
  if(screen==="menu")renderMatchMenu(context,words,controller.signal);else if(screen==="game")renderMatchGame(context,words,controller.signal);else if(screen==="results")renderMatchResult(context,words,controller.signal);else context.router.replace("match.menu",{},{force:true});
}
export function onLeave(reason="route_change"){
  if(matchState.currentScreen!=="game")return;const tracker=matchState.session.tracker;if(tracker?.getStatus()==="active")tracker.abandon(reason,{items_total:matchState.total,items_completed:matchState.solvedCount,pairs_total:matchState.total,pairs_completed:matchState.solvedCount,progress_percent:Math.round((matchState.solvedCount/Math.max(1,matchState.total))*100),errors_count:matchState.errorsCount});suspendMatchForResume();
}
export function unmount(){controller?.abort();controller=null;if(matchState.currentScreen==="game")clearMatchSession();}
export function canLeave(){return !(matchState.currentScreen==="game"&&matchState.session.inProgress&&!matchState.session.completed);}