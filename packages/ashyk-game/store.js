import {DIFFICULTIES} from './constants.js';
import {faceValue} from './faces.js';
import {createAshykQuestionDeck} from './vocabulary.js';
import {ASHYK_FEATURE_FLAGS} from '../alantil-core/ashyk-access.js';

const clone=(state)=>({...state,scores:[...state.scores],question:state.question?{...state.question,options:state.question.options.map((item)=>({...item}))}:null,questionReview:state.questionReview?{...state.questionReview,question:state.questionReview.question?{...state.questionReview.question,options:state.questionReview.question.options.map((item)=>({...item}))}:null}:null,lastOutcome:state.lastOutcome?{...state.lastOutcome}:null,scorePulse:state.scorePulse?{...state.scorePulse}:null,onlineRoom:state.onlineRoom?{...state.onlineRoom}:null,onlineAction:state.onlineAction?{...state.onlineAction}:null});
const actionId=()=>globalThis.crypto?.randomUUID?.()||`ashyk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const transientId=(prefix)=>`${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
const remainingSeconds=(deadline,nowMs)=>{const end=Date.parse(String(deadline||''));return Number.isFinite(end)?Math.max(0,Math.ceil((end-nowMs)/1000)):null;};
const activeRoomStatus=(status)=>status==='waiting'||status==='preparing'||status==='playing';

export function createAshykGameStore({engine,words=[],random=Math.random,setTimer=globalThis.setTimeout?.bind(globalThis),clearTimer=globalThis.clearTimeout?.bind(globalThis),setRepeater=globalThis.setInterval?.bind(globalThis),clearRepeater=globalThis.clearInterval?.bind(globalThis),now=()=>Date.now()}={}){
  let deck=createAshykQuestionDeck(words),computerTimer=0,ticker=0,listeners=new Set();
  let state={gameMode:'computer',selectedDifficulty:'normal',difficulty:null,status:'setup',player:1,localPlayer:1,scores:[0,0],phase:'first-shot',question:null,questionLocked:false,wrongAnswerId:null,questionReview:null,remoteQuestionSelectedId:null,remoteQuestionSubmitting:false,remoteShotMode:null,shotSeconds:0,questionSeconds:0,winner:null,winByKyt:false,remainingAshyks:10,ready:false,selectedId:null,selectedFace:null,outcome:null,lastOutcome:null,scorePulse:null,statusCode:'statusChoose',onlineRoom:null,onlineAction:null};
  const emit=()=>{const value=clone(state);listeners.forEach((listener)=>listener(value));};
  const patch=(next)=>{state={...state,...next};emit();};
  const config=()=>DIFFICULTIES[state.difficulty||state.selectedDifficulty]||DIFFICULTIES.normal;
  const isComputerTurn=()=>state.gameMode==='computer'&&state.player===2;
  const isLocalTurn=()=>state.gameMode==='local'?true:state.gameMode==='computer'?state.player===1:state.localPlayer!==null&&state.player===state.localPlayer;
  const isHumanTurn=isLocalTurn;
  const makeOnlineAction=(type,id=null)=>state.gameMode==='online'&&type?{id:String(id||actionId()),type}:null;
  const bindOutcome=(action,actorPlayer=state.player)=>action&&state.lastOutcome?{...state.lastOutcome,actionId:action.id,actorPlayer}:state.lastOutcome;
  function clearComputerTimer(){if(computerTimer&&clearTimer)clearTimer(computerTimer);computerTimer=0;}
  function stopTicker(){if(ticker&&clearRepeater)clearRepeater(ticker);ticker=0;}
  function ensureTicker(){if(ticker||!setRepeater)return;ticker=setRepeater(()=>tick(),1000);}
  function showOutcome(code,payload={},canonical=true){const id=transientId('outcome'),entry={id,code,...payload},next={outcome:entry};if(canonical)next.lastOutcome={code,...payload};patch(next);if(setTimer)setTimer(()=>{if(state.outcome?.id===id)patch({outcome:null});},1800);return entry;}
  function showQuestionReview(question,selectedOptionId,resultCode){if(!question||!['correct','wrong'].includes(resultCode))return;const id=transientId('review'),review={id,question:{...question,options:question.options.map((item)=>({...item}))},selectedOptionId:String(selectedOptionId||''),correctOptionId:String(question.answerId||''),resultCode};patch({questionReview:review});if(setTimer)setTimer(()=>{if(state.questionReview?.id===id)patch({questionReview:null});},760);}
  function pulseScore(player){if(player!==1&&player!==2)return;const id=transientId('score');patch({scorePulse:{id,player}});if(setTimer)setTimer(()=>{if(state.scorePulse?.id===id)patch({scorePulse:null});},760);}
  function startTurn(player,actionType=null,actionIdOverride=null){clearComputerTimer();const actor=state.player,action=makeOnlineAction(actionType,actionIdOverride),local=state.gameMode==='local'?true:state.gameMode==='computer'?player===1:player===state.localPlayer,seconds=config().humanShotSeconds;patch({player,phase:'first-shot',question:null,questionLocked:false,wrongAnswerId:null,remoteQuestionSelectedId:null,remoteQuestionSubmitting:false,remoteShotMode:null,shotSeconds:local?seconds:0,questionSeconds:0,selectedId:null,selectedFace:null,statusCode:state.gameMode==='computer'&&player===2?'statusComputer':local?'statusChoosePiece':'statusOpponent',lastOutcome:bindOutcome(action,actor),onlineAction:action});engine?.clearSelection?.();scheduleComputer();}
  function finish(finalScores,forcedWinner=null,actionType=null,actionIdOverride=null){clearComputerTimer();const actor=state.player,action=makeOnlineAction(actionType,actionIdOverride),winner=forcedWinner??(finalScores[0]===finalScores[1]?'draw':finalScores[0]>finalScores[1]?1:2);patch({scores:finalScores,status:'finished',winner,winByKyt:forcedWinner!==null,phase:'first-shot',question:null,questionLocked:true,shotSeconds:0,questionSeconds:0,statusCode:'statusFinished',lastOutcome:bindOutcome(action,actor),onlineAction:action});}
  function onShotSettled(result,shotId=null){
    if(state.status!=='playing')return;const current=state.player,next=current===1?2:1,actionType='shot_result';
    if(!result.success){
      if(!result.hitAny){const scores=[...state.scores];scores[current-1]-=1;patch({scores});pulseScore(current);showOutcome('miss',{delta:-1});}
      else showOutcome(result.reasonCode==='third_piece'?'thirdTouched':'faceMismatch',{delta:0});
      startTurn(next,actionType,shotId);return;
    }
    const remaining=result.remainingPieces??Math.max(1,state.remainingAshyks-1);
    if(result.attackerFace==='КЪЫТ'&&result.targetFace==='КЪЫТ'){showOutcome('capture',{face:'КЪЫТ',delta:0,instant:true});finish([...state.scores],current,actionType,shotId);return;}
    const points=faceValue(result.attackerFace),scores=[...state.scores];scores[current-1]+=points;patch({scores,remainingAshyks:remaining});pulseScore(current);showOutcome('capture',{face:result.attackerFace,delta:points});
    if(remaining<=1){finish(scores,null,actionType,shotId);return;}
    if(state.phase==='first-shot'){
      let question=null;try{question=deck.next();}catch(error){showOutcome('questionPoolError',{message:String(error?.message||'ASHYK_QUESTION_POOL_TOO_SMALL')});startTurn(next,actionType,shotId);return;}
      const action=makeOnlineAction(actionType,shotId);patch({phase:'bonus-question',question,questionLocked:false,wrongAnswerId:null,remoteQuestionSelectedId:null,remoteQuestionSubmitting:false,questionSeconds:isLocalTurn()?config().humanQuestionSeconds:0,shotSeconds:0,statusCode:isComputerTurn()?'statusComputer':isLocalTurn()?'translate':'statusOpponent',lastOutcome:bindOutcome(action,current),onlineAction:action});scheduleComputer();return;
    }
    startTurn(next,actionType,shotId);
  }
  function submitAnswer(optionId){
    if(state.status!=='playing'||state.phase!=='bonus-question'||!state.question||state.questionLocked||(!isLocalTurn()&&state.gameMode==='online'))return false;
    const current=state.player,next=current===1?2:1,question=state.question,selected=String(optionId),correct=selected===String(question.answerId);
    if(correct){const scores=[...state.scores];scores[current-1]+=3;showQuestionReview(question,selected,'correct');showOutcome('correct',{delta:3,selectedOptionId:selected,correctOptionId:String(question.answerId)});pulseScore(current);const action=makeOnlineAction('answer_correct');patch({scores,questionLocked:true,wrongAnswerId:null,phase:'bonus-shot',shotSeconds:isLocalTurn()?config().humanShotSeconds:0,questionSeconds:0,statusCode:'statusBonusShot',lastOutcome:bindOutcome(action,current),onlineAction:action});scheduleComputer();return true;}
    const scores=[...state.scores];scores[current-1]-=1;showQuestionReview(question,selected,'wrong');patch({scores,questionLocked:true,wrongAnswerId:selected});showOutcome('wrong',{delta:-1,selectedOptionId:selected,correctOptionId:String(question.answerId)});pulseScore(current);if(state.gameMode==='online')startTurn(next,'answer_wrong');else if(setTimer)setTimer(()=>startTurn(next),650);else startTurn(next);return false;
  }
  function skipQuestion(){if(state.status!=='playing'||state.phase!=='bonus-question'||state.questionLocked||!isLocalTurn())return;showOutcome('noPenalty',{delta:0});startTurn(state.player===1?2:1,state.gameMode==='online'?'skip':null);}
  function scheduleComputer(){clearComputerTimer();if(!setTimer||state.status!=='playing'||!isComputerTurn())return;if(state.phase==='bonus-question'&&state.question&&!state.questionLocked){computerTimer=setTimer(()=>{computerTimer=0;const correct=random()<config().computerAnswerAccuracy,wrong=state.question.options.filter((item)=>String(item.id)!==String(state.question.answerId)),choice=correct?state.question.answerId:(wrong[Math.floor(random()*wrong.length)]?.id??state.question.answerId);submitAnswer(choice);},700);return;}if(state.ready&&state.phase!=='bonus-question'){computerTimer=setTimer(()=>{computerTimer=0;engine?.launchComputer?.(config().computerShotAccuracy);},650);}}
  function tick(){if(state.status!=='playing'||!isLocalTurn())return;if(state.gameMode==='online'){const seconds=remainingSeconds(state.onlineRoom?.phase_deadline_at,now());if(state.phase==='bonus-question'&&state.question&&!state.questionLocked){const next=seconds??Math.max(0,state.questionSeconds-1);if(next!==state.questionSeconds)patch({questionSeconds:next});return;}const next=seconds??Math.max(0,state.shotSeconds-1);if(next!==state.shotSeconds)patch({shotSeconds:next});return;}if(state.phase==='bonus-question'&&state.question&&!state.questionLocked){if(state.questionSeconds<=1){showOutcome('timeout',{},false);startTurn(state.player===1?2:1);}else patch({questionSeconds:state.questionSeconds-1});return;}if(state.ready&&state.phase!=='bonus-question'){if(state.shotSeconds<=1){showOutcome('timeout',{},false);startTurn(state.player===1?2:1);}else patch({shotSeconds:state.shotSeconds-1});}}
  function handleEngineEvent(event){if(event.type==='ready'){patch({ready:Boolean(event.ready)});scheduleComputer();return;}if(event.type==='selection'){patch({selectedId:event.selectedId??null,selectedFace:event.face??null,statusCode:event.selectedId!==null?'statusSelected':isLocalTurn()?'statusChoosePiece':'statusOpponent'});return;}if(event.type==='shot')patch({ready:false,selectedId:null,selectedFace:null});if(event.type==='shotSettled')onShotSettled(event.result,event.shotId||null);}
  function startComputer(level=state.selectedDifficulty){const difficulty=DIFFICULTIES[level]?level:'normal';clearComputerTimer();deck.reset();engine?.reset?.();patch({gameMode:'computer',selectedDifficulty:difficulty,difficulty,status:'playing',player:1,localPlayer:1,scores:[0,0],phase:'first-shot',question:null,questionLocked:false,wrongAnswerId:null,questionReview:null,remoteQuestionSelectedId:null,remoteQuestionSubmitting:false,remoteShotMode:null,shotSeconds:DIFFICULTIES[difficulty].humanShotSeconds,questionSeconds:0,winner:null,winByKyt:false,remainingAshyks:10,ready:false,selectedId:null,selectedFace:null,outcome:null,lastOutcome:null,scorePulse:null,statusCode:'statusSettling',onlineRoom:null,onlineAction:null});ensureTicker();}
  function startLocal(level=state.selectedDifficulty){if(!ASHYK_FEATURE_FLAGS.allowLocalSameDevice)return false;const difficulty=DIFFICULTIES[level]?level:'normal';clearComputerTimer();deck.reset();engine?.reset?.();patch({gameMode:'local',selectedDifficulty:difficulty,difficulty,status:'playing',player:1,localPlayer:1,scores:[0,0],phase:'first-shot',question:null,questionLocked:false,wrongAnswerId:null,questionReview:null,remoteQuestionSelectedId:null,remoteQuestionSubmitting:false,remoteShotMode:null,shotSeconds:DIFFICULTIES[difficulty].humanShotSeconds,questionSeconds:0,winner:null,winByKyt:false,remainingAshyks:10,ready:false,selectedId:null,selectedFace:null,outcome:null,lastOutcome:null,scorePulse:null,statusCode:'statusSettling',onlineRoom:null,onlineAction:null});ensureTicker();}
  function serverOutcome(room,stateData,localPlayer){
    const actionType=String(room.last_action_type||''),actorPlayer=room.last_action_actor_user_id===room.host_user_id?1:room.last_action_actor_user_id===room.guest_user_id?2:null,actionId=String(room.last_action_id||'');
    if(!actionId)return null;
    if(actionType==='timeout')return{actionId,actorPlayer:null,code:'timeout'};
    if(actionType==='resign')return{actionId,actorPlayer,code:actorPlayer&&actorPlayer!==localPlayer?'opponentResigned':'resigned'};
    if(actionType==='forfeit')return{actionId,actorPlayer,code:'opponentDisconnected'};
    const raw=stateData.lastOutcome&&typeof stateData.lastOutcome==='object'?stateData.lastOutcome:null;
    if(!raw)return null;
    return{...raw,actionId,actorPlayer};
  }
  function hydrateOnline(room,userId){
    if(!room)return;
    const previous=state,localPlayer=room.host_user_id===userId?1:room.guest_user_id===userId?2:null,stateData=room.game_state||{},difficulty=DIFFICULTIES[stateData.difficulty]?stateData.difficulty:state.selectedDifficulty,player=room.active_user_id===room.host_user_id?1:2,local=player===localPlayer,phase=room.phase==='bonus-question'||room.phase==='bonus-shot'?room.phase:stateData.phase==='bonus-question'||stateData.phase==='bonus-shot'?stateData.phase:'first-shot',question=phase==='bonus-question'&&stateData.question?{...stateData.question,options:Array.isArray(stateData.question.options)?stateData.question.options.map((item)=>({...item})):[]}:null,localQuestion=room.status==='playing'&&local&&phase==='bonus-question',localShot=room.status==='playing'&&local&&phase!=='bonus-question',deadlineSeconds=remainingSeconds(room.phase_deadline_at,now()),statusCode=room.status==='waiting'||room.status==='preparing'?'statusWaiting':room.status==='finished'?'statusFinished':phase==='bonus-question'?(local?'translate':'statusOpponent'):phase==='bonus-shot'?(local?'statusBonusShot':'statusOpponent'):local?'statusChoosePiece':'statusOpponent',previousSeq=Number(previous.onlineRoom?.phase_seq||0),incomingSeq=Number(room.phase_seq||0),sameRoom=Boolean(previous.onlineRoom?.id&&String(previous.onlineRoom.id)===String(room.id)),scores=Array.isArray(stateData.scores)?stateData.scores:[0,0],incomingOutcome=serverOutcome(room,stateData,localPlayer),newOutcome=Boolean(sameRoom&&incomingOutcome?.actionId&&incomingOutcome.actionId!==previous.lastOutcome?.actionId),remoteOutcome=newOutcome&&(incomingOutcome.actorPlayer===null||incomingOutcome.actorPlayer!==localPlayer);
    if(stateData.field)engine?.applyAuthoritativeSnapshot?.(stateData.field);
    if(incomingSeq!==previousSeq){engine?.setRemoteSelection?.(null);engine?.setRemoteAim?.(null);}
    let review=previous.questionReview;
    if(remoteOutcome&&['correct','wrong'].includes(incomingOutcome.code)&&previous.question){review={id:`review:${incomingOutcome.actionId}`,question:{...previous.question,options:previous.question.options.map((item)=>({...item}))},selectedOptionId:String(incomingOutcome.selectedOptionId||previous.remoteQuestionSelectedId||''),correctOptionId:String(incomingOutcome.correctOptionId||previous.question.answerId||''),resultCode:incomingOutcome.code};}
    let outcome=previous.outcome;
    if(remoteOutcome)outcome={id:`remote:${incomingOutcome.actionId}`,...incomingOutcome};
    const changedScore=sameRoom?(scores[0]!==previous.scores[0]?1:scores[1]!==previous.scores[1]?2:null):null;
    patch({gameMode:'online',selectedDifficulty:difficulty,difficulty,status:room.status==='finished'||room.status==='abandoned'?'finished':'playing',player,localPlayer,scores,phase,question,questionLocked:Boolean(stateData.questionLocked),wrongAnswerId:stateData.wrongAnswerId??null,questionReview:review,remoteQuestionSelectedId:incomingSeq!==previousSeq?null:previous.remoteQuestionSelectedId,remoteQuestionSubmitting:incomingSeq!==previousSeq?false:previous.remoteQuestionSubmitting,remoteShotMode:incomingSeq!==previousSeq?null:previous.remoteShotMode,shotSeconds:localShot?(deadlineSeconds??DIFFICULTIES[difficulty].humanShotSeconds):0,questionSeconds:localQuestion?(deadlineSeconds??DIFFICULTIES[difficulty].humanQuestionSeconds):0,winner:stateData.winner??null,winByKyt:Boolean(stateData.winByKyt),remainingAshyks:Number.isFinite(stateData.remainingAshyks)?stateData.remainingAshyks:10,selectedId:null,selectedFace:null,statusCode,onlineRoom:room,onlineAction:null,lastOutcome:incomingOutcome||previous.lastOutcome,outcome});
    if(changedScore)pulseScore(changedScore);
    if(remoteOutcome&&setTimer){const id=`remote:${incomingOutcome.actionId}`;setTimer(()=>{if(state.outcome?.id===id)patch({outcome:null});},1800);}
    if(remoteOutcome&&review&&setTimer){const id=review.id;setTimer(()=>{if(state.questionReview?.id===id)patch({questionReview:null});},760);}
    ensureTicker();
  }
  function applyRemoteVisual(type,payload={}){
    if(state.gameMode!=='online'||state.status!=='playing')return false;
    if(type==='shot-mode'&&(payload.mode==='flat'||payload.mode==='hop')){patch({remoteShotMode:payload.mode});return true;}
    if(type==='question-select'){patch({remoteQuestionSelectedId:String(payload.optionId||''),remoteQuestionSubmitting:false});return true;}
    if(type==='question-submit'){patch({remoteQuestionSelectedId:String(payload.optionId||state.remoteQuestionSelectedId||''),remoteQuestionSubmitting:true});return true;}
    if(type==='question-skip'){patch({remoteQuestionSubmitting:true});return true;}
    return false;
  }
  function onlineGameState(){return{field:engine?.snapshot?.()||{pieces:[]},scores:[...state.scores],currentPlayer:state.player,remainingAshyks:state.remainingAshyks,winner:state.winner,winByKyt:state.winByKyt,difficulty:state.difficulty||state.selectedDifficulty,phase:state.phase,question:state.question?{...state.question,options:state.question.options.map((item)=>({...item}))}:null,questionLocked:state.questionLocked,wrongAnswerId:state.wrongAnswerId,lastOutcome:state.lastOutcome?{...state.lastOutcome}:null};}
  function restart(){clearComputerTimer();deck.reset();engine?.reset?.();patch({difficulty:null,status:'setup',player:1,localPlayer:1,scores:[0,0],phase:'first-shot',question:null,questionLocked:false,wrongAnswerId:null,questionReview:null,remoteQuestionSelectedId:null,remoteQuestionSubmitting:false,remoteShotMode:null,shotSeconds:0,questionSeconds:0,winner:null,winByKyt:false,remainingAshyks:10,ready:false,selectedId:null,selectedFace:null,outcome:null,lastOutcome:null,scorePulse:null,statusCode:'statusChoose',onlineRoom:null,onlineAction:null});}
  function setWords(next){deck=createAshykQuestionDeck(next||[]);}
  function setMode(mode){if(state.status!=='setup')return;const next=mode==='online'&&ASHYK_FEATURE_FLAGS.allowOnlineFriend?'online':mode==='local'&&ASHYK_FEATURE_FLAGS.allowLocalSameDevice?'local':'computer';patch({gameMode:next});}
  function setDifficulty(level){if(state.status!=='setup'||!DIFFICULTIES[level])return;patch({selectedDifficulty:level});}
  function subscribe(listener){listeners.add(listener);listener(clone(state));return()=>listeners.delete(listener);}
  function destroy(){clearComputerTimer();stopTicker();listeners.clear();}
  ensureTicker();
  return{subscribe,getState:()=>clone(state),setWords,setMode,setDifficulty,startComputer,startLocal,hydrateOnline,applyRemoteVisual,onlineGameState,restart,skipQuestion,submitAnswer,handleEngineEvent,startTurn,finish,destroy,isLocalTurn,isHumanTurn,isComputerTurn};
}
