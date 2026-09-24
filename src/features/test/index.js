import { msg } from "../../shared/i18n/index.js?v=16.8.0.3";
import { getWords } from "../../shared/data/word-repository.js?v=16.8.0.3";
import { wordFavorites } from "../../shared/state/word-favorites.js?v=16.8.0.3";
import { resumeTestSession, suspendTestForResume } from "./engine.js?v=16.8.0.3";
import { clearTestSession, testState } from "./state.js?v=16.8.0.3";
import { renderTestMenu, renderTestResults, renderTestSession } from "./view.js?v=16.8.0.3";

let controller=null;
export async function mount(context,params={}){
  controller=new AbortController();wordFavorites.reload();const words=await getWords();let screen=params.screen||"menu";
  if(screen==="menu"&&!testState.session.inProgress&&resumeTestSession(words)){await context.router.replace("test.session",{},{force:true});return;}
  if(screen==="session"&&(!testState.session.inProgress||!testState.items.length)){if(resumeTestSession(words)){screen="session";}else{await context.router.replace("test.menu",{},{force:true});return;}}
  if(screen==="results"&&!testState.session.completed){await context.router.replace("test.menu",{},{force:true});return;}
  testState.currentScreen=screen;const titles={menu:msg("test.prover_znaniya"),session:msg("test.prover_znaniya"),results:msg("test.rezultaty_testa")};context.shell.setHeaderContent?.({title:titles[screen]||msg("test.prover_znaniya"),logo:true,brand:false});
  if(screen==="menu")renderTestMenu(context,words,controller.signal);else if(screen==="session")renderTestSession(context,controller.signal);else if(screen==="results")renderTestResults(context,controller.signal);else context.router.replace("test.menu",{},{force:true});
}
export function onLeave(reason="route_change"){
  if(testState.currentScreen!=="session")return;const tracker=testState.session.tracker;if(tracker?.getStatus()==="active"){const total=testState.items.length;tracker.abandon(reason,{items_total:total,items_completed:testState.index,questions_total:total,questions_answered:testState.index,progress_percent:Math.round((testState.index/Math.max(1,total))*100),correct_count:testState.correct,wrong_count:Math.max(0,testState.index-testState.correct)});}suspendTestForResume();
}
export function unmount(){controller?.abort();controller=null;if(testState.currentScreen==="session")clearTestSession();}
export function canLeave(){return !(testState.currentScreen==="session"&&testState.session.inProgress&&!testState.session.completed);}