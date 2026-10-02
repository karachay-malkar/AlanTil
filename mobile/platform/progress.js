import AsyncStorage from '@react-native-async-storage/async-storage';
import { EVENTS, WORD_RESULTS, WORD_SOURCES } from '../../packages/alantil-core/analytics.js';
import { ACTIVITY_HISTORY_LIMIT, buildStationLearningStatistics, upsertActivityHistory } from '../../packages/alantil-core/statistics.js';
import {
  applyLearnWordResults, applyMatchWordResults, applyTestWordResults, normalizeWordProgressState,
  summarizeWordProgress, buildProblemWordRows, wordProgressMapFromState,
} from '../../packages/alantil-core/word-progress.js';
import { trackNativeEvent } from './analytics.js';
import { getNativeStorageScope, migrateLegacyNativeValueToGuest, nativeScopedStorageKey } from './storage-scope.js';

const PROGRESS_KEY='alantil:16.1:word-progress',ACTIVITY_KEY='alantil:16.1:activity',STATION_ATTEMPTS_KEY='alantil:16.1:station-attempts',STATION_HISTORY_KEY='alantil:16.1:station-history';
async function key(base,scope=getNativeStorageScope()){const captured=nativeScopedStorageKey(base,scope);await migrateLegacyNativeValueToGuest(base);return captured;}
async function readJson(base,fallback,scope=getNativeStorageScope()){try{const raw=await AsyncStorage.getItem(await key(base,scope));return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
async function writeJson(base,value,scope=getNativeStorageScope()){await AsyncStorage.setItem(await key(base,scope),JSON.stringify(value));}
async function queueCloud(state,scope){try{const {queueNativeWordProgressSnapshot}=await import('./cloud-sync.js');if(getNativeStorageScope()===scope)await queueNativeWordProgressSnapshot(state);}catch{}}
async function analyticsActivity(type,payload={}){await trackNativeEvent(EVENTS.ACTIVITY_COMPLETE,{activity:type,...payload}).catch(()=>{});}
export async function loadNativeWordProgressState(scope=getNativeStorageScope()){return normalizeWordProgressState(await readJson(PROGRESS_KEY,{},scope));}
export async function loadNativeWordProgressMap(){return wordProgressMapFromState(await loadNativeWordProgressState());}
export async function saveNativeWordProgressState(state,scope=getNativeStorageScope()){const normalized=normalizeWordProgressState(state);await writeJson(PROGRESS_KEY,normalized,scope);return normalized;}
async function bumpActivity({type,correct=0,total=0,startedAt,endedAt=new Date().toISOString()}={},scope=getNativeStorageScope()){const current=await readJson(ACTIVITY_KEY,{sessions:0,learnSessions:0,testSessions:0,matchSessions:0,correct:0,total:0,activeSeconds:0},scope);current.sessions+=1;if(type==='learn')current.learnSessions+=1;if(type==='test'||type==='station_test')current.testSessions+=1;if(type==='match')current.matchSessions+=1;current.correct+=Math.max(0,Number(correct)||0);current.total+=Math.max(0,Number(total)||0);const start=Date.parse(startedAt||'')||0,end=Date.parse(endedAt||'')||0;if(start&&end>start)current.activeSeconds+=Math.min(21600,Math.round((end-start)/1000));await writeJson(ACTIVITY_KEY,current,scope);return current;}
async function appendStationAttempt({stationKey,accuracy,requiredAccuracy,completedAt,sessionId},scope=getNativeStorageScope()){if(!stationKey)return;const rows=await readJson(STATION_ATTEMPTS_KEY,[],scope);rows.unshift({stationKey:String(stationKey),percent:Math.max(0,Math.min(100,Number(accuracy)||0)),requiredAccuracy:Math.max(0,Number(requiredAccuracy)||80),date:completedAt,sessionId:String(sessionId||'')});await writeJson(STATION_ATTEMPTS_KEY,rows.slice(0,120),scope);}
async function appendStationHistory(type,payload,scope=getNativeStorageScope()){const current=await readJson(STATION_HISTORY_KEY,[],scope),next=upsertActivityHistory(current,type,payload,ACTIVITY_HISTORY_LIMIT);if(!next.entry)return false;await writeJson(STATION_HISTORY_KEY,next.rows,scope);return true;}
export async function recordNativeLearnSession({sessionId,words,startedAt,completedAt=new Date().toISOString(),dictionaryId='',sectionId='',setId=''}={}){
  const scope=getNativeStorageScope(),state=await loadNativeWordProgressState(scope);
  const applied=applyLearnWordResults(state,sessionId,words,completedAt);
  if(applied){
    await saveNativeWordProgressState(state,scope);
    await bumpActivity({type:'learn',startedAt,endedAt:completedAt},scope);
    await appendStationHistory('learn',{id:sessionId,status:'completed',started_at:startedAt,ended_at:completedAt,dictionary_id:dictionaryId,section_id:sectionId,set_id:setId,words},scope);
    for(const row of words||[])await trackNativeEvent(EVENTS.WORD_RESULT,{word_id:String(row?.word_id||''),source:WORD_SOURCES.LEARN,result:row?.final_result==='known'?WORD_RESULTS.KNOWN:WORD_RESULTS.UNKNOWN}).catch(()=>{});
    await analyticsActivity('learn',{session_id:String(sessionId||''),items_total:(words||[]).length});
    await queueCloud(state,scope);
  }
  return applied;
}
export async function recordNativeTestSession({sessionId,answers,accuracy,requiredAccuracy=80,updateMastery=false,startedAt,completedAt=new Date().toISOString(),type='test',stationKey='',dictionaryId='',sectionId='',setId=''}={}){
  const scope=getNativeStorageScope(),state=await loadNativeWordProgressState(scope);
  const result=applyTestWordResults(state,{sessionId,answers,accuracy,requiredAccuracy,updateMastery,completedAt});
  if(result.applied){
    const correct=(answers||[]).filter((row)=>row.result==='correct'||row.isCorrect===true).length;
    const wrong=Math.max(0,(answers||[]).length-correct);
    await saveNativeWordProgressState(state,scope);
    await bumpActivity({type,correct,total:(answers||[]).length,startedAt,endedAt:completedAt},scope);
    for(const row of answers||[])await trackNativeEvent(EVENTS.WORD_RESULT,{word_id:String(row?.word_id||row?.wordId||''),source:WORD_SOURCES.TEST,result:row?.result==='correct'||row?.isCorrect===true?WORD_RESULTS.CORRECT:WORD_RESULTS.WRONG}).catch(()=>{});
    await analyticsActivity(type,{session_id:String(sessionId||''),items_total:(answers||[]).length,correct,accuracy:Math.max(0,Math.min(100,Number(accuracy)||0))});
    if(type==='station_test'){
      await appendStationAttempt({stationKey,accuracy,requiredAccuracy,completedAt,sessionId},scope);
      await appendStationHistory('station_test',{id:sessionId,status:'completed',started_at:startedAt,ended_at:completedAt,dictionary_id:dictionaryId,section_id:sectionId,set_id:setId,correct_total:correct,wrong_total:wrong,accuracy,words:answers},scope);
    }
    await queueCloud(state,scope);
  }
  return result;
}
export async function recordNativeMatchSession({sessionId,words,startedAt,completedAt=new Date().toISOString()}={}){const scope=getNativeStorageScope(),state=await loadNativeWordProgressState(scope);const applied=applyMatchWordResults(state,sessionId,words,completedAt);if(applied){await saveNativeWordProgressState(state,scope);await bumpActivity({type:'match',startedAt,endedAt:completedAt},scope);await analyticsActivity('match',{session_id:String(sessionId||''),items_total:(words||[]).length});await queueCloud(state,scope);}return applied;}
export async function getNativeProgressSummary(words=[]){const scope=getNativeStorageScope(),state=await loadNativeWordProgressState(scope),map=wordProgressMapFromState(state),mastery=summarizeWordProgress(words,map),difficult=buildProblemWordRows(words,map,12),activity=await readJson(ACTIVITY_KEY,{sessions:0,learnSessions:0,testSessions:0,matchSessions:0,correct:0,total:0,activeSeconds:0},scope);return {...mastery,difficult,activity:{...activity,accuracy:activity.total?Math.round((activity.correct/activity.total)*100):0}};}
export async function getNativeStationStatistics(station){
  const scope=getNativeStorageScope();
  const history=await readJson(STATION_HISTORY_KEY,[],scope);
  const attempts=await readJson(STATION_ATTEMPTS_KEY,[],scope);
  const knownIds=new Set(history.map((row)=>String(row?.id||'')));
  const legacy=(attempts||[]).filter((row)=>row.stationKey===String(station?.key||'')&&!knownIds.has(String(row.sessionId||''))).map((row)=>({
    id:String(row.sessionId||`legacy-${row.stationKey||'station'}-${row.date||'unknown'}`),
    type:'station_test',
    status:'completed',
    ended_at:row.date,
    dictionary_id:station?.dictionaryId||'',
    section_id:station?.sectionId||station?.groupId||'',
    set_id:station?.setId||station?.sourceSetId||'',
    accuracy:Number(row.percent)||0,
    correct_total:0,
    wrong_total:0,
    words:[],
  }));
  return buildStationLearningStatistics([...(history||[]),...legacy],station);
}
