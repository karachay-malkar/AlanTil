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
async function readJson(key,fallback){try{const raw=await AsyncStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch{return fallback;}}
async function writeJson(key,value){await AsyncStorage.setItem(key,JSON.stringify(value));}
async function queueCloud(state){try{const {queueNativeWordProgressSnapshot}=await import('./cloud-sync.js');await queueNativeWordProgressSnapshot(state);}catch{}}
export async function loadNativeWordProgressState(){return normalizeWordProgressState(await readJson(PROGRESS_KEY,{}));}
export async function loadNativeWordProgressMap(){return wordProgressMapFromState(await loadNativeWordProgressState());}
export async function saveNativeWordProgressState(state){const normalized=normalizeWordProgressState(state);await writeJson(PROGRESS_KEY,normalized);return normalized;}
async function bumpActivity({type,correct=0,total=0,startedAt,endedAt=new Date().toISOString()}={}){const current=await readJson(ACTIVITY_KEY,{sessions:0,learnSessions:0,testSessions:0,matchSessions:0,correct:0,total:0,activeSeconds:0});current.sessions+=1;if(type==='learn')current.learnSessions+=1;if(type==='test'||type==='station_test')current.testSessions+=1;if(type==='match')current.matchSessions+=1;current.correct+=Math.max(0,Number(correct)||0);current.total+=Math.max(0,Number(total)||0);const start=Date.parse(startedAt||'')||0,end=Date.parse(endedAt||'')||0;if(start&&end>start)current.activeSeconds+=Math.min(6*60*60,Math.round((end-start)/1000));await writeJson(ACTIVITY_KEY,current);return current;}
export async function recordNativeLearnSession({sessionId,words,startedAt,completedAt=new Date().toISOString()}={}){const state=await loadNativeWordProgressState();const applied=applyLearnWordResults(state,sessionId,words,completedAt);if(applied){await saveNativeWordProgressState(state);await bumpActivity({type:'learn',startedAt,endedAt:completedAt});await queueCloud(state);}return applied;}
export async function recordNativeTestSession({sessionId,answers,accuracy,requiredAccuracy=80,updateMastery=false,startedAt,completedAt=new Date().toISOString(),type='test'}={}){const state=await loadNativeWordProgressState();const result=applyTestWordResults(state,{sessionId,answers,accuracy,requiredAccuracy,updateMastery,completedAt});if(result.applied){await saveNativeWordProgressState(state);await bumpActivity({type,correct:(answers||[]).filter((row)=>row.result==='correct'||row.isCorrect===true).length,total:(answers||[]).length,startedAt,endedAt:completedAt});await queueCloud(state);}return result;}
export async function recordNativeMatchSession({sessionId,words,startedAt,completedAt=new Date().toISOString()}={}){const state=await loadNativeWordProgressState();const applied=applyMatchWordResults(state,sessionId,words,completedAt);if(applied){await saveNativeWordProgressState(state);await bumpActivity({type:'match',startedAt,endedAt:completedAt});await queueCloud(state);}return applied;}
export async function getNativeProgressSummary(words=[]){const state=await loadNativeWordProgressState();const map=wordProgressMapFromState(state);const mastery=summarizeWordProgress(words,map);const difficult=buildProblemWordRows(words,map,12);const activity=await readJson(ACTIVITY_KEY,{sessions:0,learnSessions:0,testSessions:0,matchSessions:0,correct:0,total:0,activeSeconds:0});return {...mastery,difficult,activity:{...activity,accuracy:activity.total?Math.round((activity.correct/activity.total)*100):0}};}
