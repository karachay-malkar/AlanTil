import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyLearnWordResults,
  applyMatchWordResults,
  applyTestWordResults,
  normalizeWordProgressState,
  summarizeWordProgress,
  buildProblemWordRows,
  wordProgressMapFromState,
} from '../../packages/alantil-core/word-progress.js';

const PROGRESS_KEY='alantil:16.1:word-progress';
const ACTIVITY_KEY='alantil:16.1:activity';
const STATION_ATTEMPTS_KEY='alantil:16.1:station-attempts';
async function readJson(key,fallback){try{const raw=await AsyncStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
async function writeJson(key,value){await AsyncStorage.setItem(key,JSON.stringify(value));}
async function queueCloud(state){try{const {queueNativeWordProgressSnapshot}=await import('./cloud-sync.js');await queueNativeWordProgressSnapshot(state);}catch{}}
export async function loadNativeWordProgressState(){return normalizeWordProgressState(await readJson(PROGRESS_KEY,{}));}
export async function loadNativeWordProgressMap(){return wordProgressMapFromState(await loadNativeWordProgressState());}
export async function saveNativeWordProgressState(state){const normalized=normalizeWordProgressState(state);await writeJson(PROGRESS_KEY,normalized);return normalized;}
async function bumpActivity({type,correct=0,total=0,startedAt,endedAt=new Date().toISOString()}={}){const current=await readJson(ACTIVITY_KEY,{sessions:0,learnSessions:0,testSessions:0,matchSessions:0,correct:0,total:0,activeSeconds:0});current.sessions+=1;if(type==='learn')current.learnSessions+=1;if(type==='test'||type==='station_test')current.testSessions+=1;if(type==='match')current.matchSessions+=1;current.correct+=Math.max(0,Number(correct)||0);current.total+=Math.max(0,Number(total)||0);const start=Date.parse(startedAt||'')||0,end=Date.parse(endedAt||'')||0;if(start&&end>start)current.activeSeconds+=Math.min(6*60*60,Math.round((end-start)/1000));await writeJson(ACTIVITY_KEY,current);return current;}
async function appendStationAttempt({stationKey,accuracy,requiredAccuracy,completedAt,sessionId}){if(!stationKey)return;const rows=await readJson(STATION_ATTEMPTS_KEY,[]);rows.unshift({stationKey:String(stationKey),percent:Math.max(0,Math.min(100,Number(accuracy)||0)),requiredAccuracy:Math.max(0,Number(requiredAccuracy)||80),date:completedAt,sessionId:String(sessionId||'')});await writeJson(STATION_ATTEMPTS_KEY,rows.slice(0,120));}
export async function recordNativeLearnSession({sessionId,words,startedAt,completedAt=new Date().toISOString()}={}){const state=await loadNativeWordProgressState();const applied=applyLearnWordResults(state,sessionId,words,completedAt);if(applied){await saveNativeWordProgressState(state);await bumpActivity({type:'learn',startedAt,endedAt:completedAt});await queueCloud(state);}return applied;}
export async function recordNativeTestSession({sessionId,answers,accuracy,requiredAccuracy=80,updateMastery=false,startedAt,completedAt=new Date().toISOString(),type='test',stationKey=''}={}){const state=await loadNativeWordProgressState();const result=applyTestWordResults(state,{sessionId,answers,accuracy,requiredAccuracy,updateMastery,completedAt});if(result.applied){await saveNativeWordProgressState(state);await bumpActivity({type,correct:(answers||[]).filter((row)=>row.result==='correct'||row.isCorrect===true).length,total:(answers||[]).length,startedAt,endedAt:completedAt});if(type==='station_test')await appendStationAttempt({stationKey,accuracy,requiredAccuracy,completedAt,sessionId});await queueCloud(state);}return result;}
export async function recordNativeMatchSession({sessionId,words,startedAt,completedAt=new Date().toISOString()}={}){const state=await loadNativeWordProgressState();const applied=applyMatchWordResults(state,sessionId,words,completedAt);if(applied){await saveNativeWordProgressState(state);await bumpActivity({type:'match',startedAt,endedAt:completedAt});await queueCloud(state);}return applied;}
export async function getNativeProgressSummary(words=[]){const state=await loadNativeWordProgressState();const map=wordProgressMapFromState(state);const mastery=summarizeWordProgress(words,map);const difficult=buildProblemWordRows(words,map,12);const activity=await readJson(ACTIVITY_KEY,{sessions:0,learnSessions:0,testSessions:0,matchSessions:0,correct:0,total:0,activeSeconds:0});return {...mastery,difficult,activity:{...activity,accuracy:activity.total?Math.round((activity.correct/activity.total)*100):0}};}
export async function getNativeStationStatistics(station){const words=Array.isArray(station?.words)?station.words:[],state=await loadNativeWordProgressState(),map=wordProgressMapFromState(state),summary=summarizeWordProgress(words,map),problems=buildProblemWordRows(words,map,7),all=await readJson(STATION_ATTEMPTS_KEY,[]),attempts=all.filter((row)=>row.stationKey===String(station?.key||''));const best=attempts.reduce((value,row)=>Math.max(value,Number(row.percent||0)),0);return {summary,problems,attempts,recent:attempts.slice(0,3),best};}
