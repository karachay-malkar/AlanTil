import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { buildLearningRoute } from '../../packages/alantil-core/learning-route.js';
import { buildPracticeScope, practiceScopeKey, practiceSelectedPool } from '../../packages/alantil-core/practice-scope.js';
import { buildWordsByPOSRounds } from '../../packages/alantil-core/word-selection.js';
import { createRouteProgressSnapshot, computedStationStatus, stationWordProgress, storyProgress } from '../../packages/alantil-core/route-progress.js';
import { buildLearnResultSummary, decideLearnCard, exposeCurrentLearnCard, initializeLearnState, learnCompletionSummary, undoLearnDecision } from '../../packages/alantil-core/learning.js';
import { applyStationTestAnswer, buildStationTestSessionState, stationTestActiveSnapshot, stationTestPayload, stationTestResult } from '../../packages/alantil-core/station-test.js';
import { initializeTestState, restoreTestStateSnapshot, testStateSnapshot } from '../../packages/alantil-core/test.js';
import { initializeMatchState, matchStateSnapshot, restoreMatchStateSnapshot } from '../../packages/alantil-core/match.js';
import { buildSongLyricsModel, filterSongs } from '../../packages/alantil-core/songs.js';
import { applyUserSettingsUpdate, normalizeUserSettings } from '../../packages/alantil-core/settings.js';
import { masteryLevelForPercent } from '../../packages/alantil-core/mastery.js';

const read=(path)=>fs.readFileSync(new URL(`../../${path}`,import.meta.url),'utf8');
const snapshot=JSON.parse(read('mobile/data/dictionary-snapshot.json'));
const words=snapshot.words;

function simpleWords(count=20){return Array.from({length:count},(_,index)=>({id:`w${index+1}`,word:`алан${index+1}`,trans:`рус${index+1}`,pos:index%2?'noun':'verb'}));}
function learnState(){return {currentDict:'d',currentSection:'s',currentSet:'1',mainQueue:[],repeatQueue:[],round:'main',totalPlanned:0,currentStudyId:'',swipeHistory:[],analyticsActions:[],sessionFailMap:{},studySession:{inProgress:false,completed:false,wordsPool:[],progressData:{},wordStats:{},metadata:{}}};}

test('16.5 Path route covers the complete production dictionary with unique dynamic station keys',()=>{
  const route=buildLearningRoute(words);
  const stations=route.storyOrder.flatMap((story)=>route.stories[story].stations);
  const routed=stations.reduce((sum,station)=>sum+station.words.length,0);
  assert.equal(routed,snapshot.word_count);
  assert.equal(new Set(stations.map((station)=>station.key)).size,stations.length);
  for(const station of stations){
    assert.ok(station.dictionaryId&&station.sectionId&&station.setId);
    assert.ok(station.words.length>0);
    assert.ok(station.words.every((word)=>String(word.dictionary_id)===String(station.dictionaryId)&&String(word.section_id)===String(station.sectionId)&&String(word.set_id)===String(station.setId)));
  }
});

test('16.5 Path/Station states use real progress for available, studying, mastered and review',()=>{
  const route=buildLearningRoute(words),storyType=route.storyOrder[0],station=route.stories[storyType].stations[0];
  assert.ok(station?.words?.length);
  assert.equal(computedStationStatus(station,createRouteProgressSnapshot(new Map())),'available');
  const first=String(station.words[0].id);
  assert.equal(computedStationStatus(station,createRouteProgressSnapshot(new Map([[first,{study_shown_count:1,mastery_status:'not_started'}]]))),'studying');
  const mastered=new Map(station.words.map((word)=>[String(word.id),{mastery_status:'mastered'}]));
  const masteredSnapshot=createRouteProgressSnapshot(mastered);
  assert.equal(stationWordProgress(station,masteredSnapshot).percent,100);
  assert.equal(computedStationStatus(station,masteredSnapshot),'mastered');
  mastered.set(first,{mastery_status:'review'});
  assert.equal(computedStationStatus(station,createRouteProgressSnapshot(mastered)),'review_1_due');
  const story=storyProgress(route,storyType,createRouteProgressSnapshot(mastered));
  assert.ok(story.totalWords>=station.words.length);
});

test('16.5 Station menu keeps Learn selected-only and Stage Test full-scope behavior',()=>{
  const source=read('mobile/screens/station.js');
  assert.match(source,/const activeWords = useMemo\(\(\) => words\.filter/);
  assert.match(source,/onLearn\(activeWords, direction\)/);
  assert.match(source,/onTest\(station, direction\)/);
  assert.match(source,/loadNativeHiddenWords/);
  assert.match(source,/getNativeStationStatistics/);
});

test('16.5 Learn supports unknown-repeat, undo and result problem rows through shared core',()=>{
  const source=simpleWords(4),state=learnState();
  initializeLearnState(state,source,'kb',{});
  const first=exposeCurrentLearnCard(state,{countShow:true}).item;
  assert.ok(first);
  decideLearnCard(state,false);
  assert.equal(state.repeatQueue.length,1);
  assert.equal(state.studySession.progressData.unknown,1);
  assert.ok(undoLearnDecision(state));
  assert.equal(state.repeatQueue.length,0);
  assert.equal(state.studySession.progressData.undo,1);
  const item=exposeCurrentLearnCard(state,{countShow:true}).item;
  decideLearnCard(state,false);
  const summary=buildLearnResultSummary(state,source);
  assert.equal(summary.problemWords[0].id,item.id);
  assert.equal(summary.leftSwipesTotal,1);
  const completion=learnCompletionSummary(state);
  assert.equal(completion.items_total,4);
});

test('16.5 Learn and Stage Test persist on Back and restore interrupted state',()=>{
  const learn=read('mobile/screens/learn.js'),stage=read('mobile/screens/station-test.js');
  assert.match(learn,/BackHandler\.addEventListener/);assert.match(learn,/saveNativeSessionSnapshot\('learn'/);assert.match(learn,/loadNativeSessionSnapshot\('learn'\)/);assert.match(learn,/undoLearnDecision/);
  assert.match(stage,/BackHandler\.addEventListener/);assert.match(stage,/stationTestActiveSnapshot/);assert.match(stage,/loadNativeSessionSnapshot\('station-test'\)/);
});

test('16.5 Stage Test restores exact question order and enforces 80/90/100 mastery boundaries',()=>{
  const source=simpleWords(10),station={key:'story::dict::section::set',dictionaryId:'dict',catalogId:'dict',groupId:'section',sourceSetId:'set',storyType:'story',requiredAccuracy:80,words:source};
  let session=buildStationTestSessionState({station,optionWords:source,mode:'kb',id:'stage-1',startedAt:'2026-09-02T10:00:00.000Z'});
  for(let index=0;index<3;index+=1)applyStationTestAnswer(session,String(session.questions[session.index].item.id));
  const active=JSON.parse(JSON.stringify(stationTestActiveSnapshot(session)));
  const restored=buildStationTestSessionState({station,optionWords:source,mode:'kb',interrupted:active,id:'new',startedAt:'2026-09-02T11:00:00.000Z'});
  assert.equal(restored.id,'stage-1');assert.equal(restored.index,3);assert.deepEqual(restored.questions.map((q)=>q.item.id),session.questions.map((q)=>q.item.id));
  session=buildStationTestSessionState({station,optionWords:source,mode:'kb',id:'stage-2',startedAt:'2026-09-02T10:00:00.000Z'});
  while(session.index<session.questions.length){const question=session.questions[session.index];const shouldCorrect=session.index<8;const answer=shouldCorrect?String(question.item.id):String(question.options.find((option)=>String(option.id)!==String(question.item.id))?.id||question.item.id);applyStationTestAnswer(session,answer);}
  session.completed=true;const result=stationTestResult(session,stationTestPayload(session,'2026-09-02T10:01:00.000Z',Date.parse('2026-09-02T10:01:00.000Z')));
  assert.equal(result.payload.accuracy,80);assert.equal(result.passed,true);assert.equal(result.masteryLevel,1);
  assert.deepEqual([[79,0],[80,1],[89,1],[90,2],[99,2],[100,3]].map(([p])=>masteryLevelForPercent(p)),[0,1,1,2,2,3]);
});

test('16.5 every production Practice dictionary/section scope has exact 20/40/80 selection capacity',()=>{
  const scope=buildPracticeScope(words);
  assert.ok(scope.length>0);
  for(const dictionary of scope){
    const dictKeys=new Set(dictionary.sections.map((section)=>practiceScopeKey(dictionary.id,section.id)));
    const dictPool=practiceSelectedPool(words,dictKeys);
    assert.equal(dictPool.length,dictionary.count);
    for(const limit of [20,40,80])assert.equal(buildWordsByPOSRounds(dictPool,limit).items.length,Math.min(limit,dictPool.length));
    for(const section of dictionary.sections){
      const sectionPool=practiceSelectedPool(words,new Set([practiceScopeKey(dictionary.id,section.id)]));
      assert.equal(sectionPool.length,section.count);
      for(const limit of [20,40,80])assert.equal(buildWordsByPOSRounds(sectionPool,limit).items.length,Math.min(limit,sectionPool.length));
    }
  }
});

test('16.5 Test and Match shared engines produce and restore exact selected counts',()=>{
  const pool=simpleWords(100);
  for(const limit of [20,40,80]){
    const testState={session:{id:`test-${limit}`,startedAt:'2026-09-02T10:00:00.000Z'}};initializeTestState(testState,pool,'kb',limit,{},pool);assert.equal(testState.items.length,limit);
    testState.index=2;const restoredTest=restoreTestStateSnapshot(JSON.parse(JSON.stringify(testStateSnapshot(testState))),pool,pool);assert.equal(restoredTest.items.length,limit);assert.equal(restoredTest.index,2);
    const matchState={session:{id:`match-${limit}`,startedAt:'2026-09-02T10:00:00.000Z'}};initializeMatchState(matchState,pool,limit,{});assert.equal(matchState.total,limit);assert.equal(matchState.rounds.flat().length,limit);
    const restoredMatch=restoreMatchStateSnapshot(JSON.parse(JSON.stringify(matchStateSnapshot(matchState))),pool);assert.equal(restoredMatch.total,limit);assert.equal(restoredMatch.rounds.flat().length,limit);
  }
});

test('16.5 Practice Back saves resumable Test/Match and result flows use real progress recording',()=>{
  const source=read('mobile/screens/practice-games.js');
  assert.match(source,/BackHandler\.addEventListener/);assert.match(source,/saveNativeSessionSnapshot\('test'/);assert.match(source,/saveNativeSessionSnapshot\('match'/);assert.match(source,/recordNativeTestSession/);assert.match(source,/recordNativeMatchSession/);assert.match(source,/clearNativeSessionSnapshot\('test'\)/);assert.match(source,/clearNativeSessionSnapshot\('match'\)/);
});

test('16.5 Favorites selected scope supports Learn, Test, Match and isolated resumable game namespaces',()=>{
  const favorites=read('mobile/screens/favorites.js'),app=read('mobile/AppRoot.js'),store=read('mobile/platform/session-store.js');
  assert.match(favorites,/onLearn\(activeRows, direction\)/);assert.match(favorites,/onTest\?\.\(activeRows\)/);assert.match(favorites,/onMatch\?\.\(activeRows\)/);assert.match(favorites,/showAll/);assert.match(favorites,/hideAll/);
  assert.match(app,/setNativeSessionNamespace\(type, scopeId\)/);assert.match(app,/openPracticeGame\('test', rows, 'favorites', 'favorites'\)/);assert.match(app,/openPracticeGame\('match', rows, 'favorites', 'favorites'\)/);
  assert.match(store,/namespaces=new Map/);assert.match(store,/namespace\?`:\$\{namespace\}`:''/);
});

test('16.5 Songs search covers title artist lyrics and lyric tokens resolve dictionary words',()=>{
  const songs=[{id:'1',title:'Тау',artist:'Автор',lyrics:'тау барам',translation:'иду в горы'}];
  assert.equal(filterSongs(songs,{searchQuery:'тау',searchMode:'title'}).length,1);
  assert.equal(filterSongs(songs,{searchQuery:'автор',searchMode:'artist'}).length,1);
  assert.equal(filterSongs(songs,{searchQuery:'барам',searchMode:'lyrics'}).length,1);
  const dictionary=[{id:'w1',word:'тау',wordAlanCyrillic:'тау',wordAlanTurkic:'taw',trans:'гора'}];
  const model=buildSongLyricsModel('тау барам','гора иду',dictionary);
  assert.equal(model[0].originalLines[0].tokens.find((token)=>token.token==='тау').word.id,'w1');
});

test('16.5 Songs persists search/navigation state and exposes runtime audio errors',()=>{
  const source=read('mobile/screens/songs.js');
  assert.match(source,/const \[query, setQuery\] = useState\(''\)/);assert.match(source,/const \[mode, setMode\] = useState\('title'\)/);assert.match(source,/query=\{query\} mode=\{mode\}/);assert.match(source,/activeSongId/);assert.match(source,/loadNativeSessionSnapshot\('songs-ui'\)/);assert.match(source,/saveNativeSessionSnapshot\('songs-ui'/);assert.match(source,/status\?\.error/);assert.match(source,/buildSongLyricsModel/);
});

test('16.5 Profile Statistics Settings are real-data backed and expose all persisted settings plus versions',()=>{
  const profile=read('mobile/screens/profile-main.js'),progress=read('mobile/platform/progress.js'),storage=read('mobile/platform/storage.js');
  assert.match(profile,/getNativeProgressSummary/);assert.match(profile,/loadNativeWordProgressMap/);assert.match(profile,/summary\.activity\?\.sessions/);assert.match(profile,/summary\.difficult/);assert.match(profile,/dictionaryPathProgress/);
  assert.match(profile,/interface_language_code/);assert.match(profile,/alan_script_code/);assert.match(profile,/alan_dialect_code/);assert.match(profile,/text_size_code/);assert.match(profile,/getNativeDictionaryDiagnostics/);assert.match(profile,/16\.5\.0/);
  assert.match(progress,/mastered/);assert.match(progress,/activeSeconds/);assert.match(progress,/sessions/);assert.match(progress,/buildProblemWordRows/);assert.match(storage,/saveNativeSettings/);assert.match(storage,/queuePreferences/);
  const settings=normalizeUserSettings(applyUserSettingsUpdate({}, {interface_language_code:'tr',alan_script_code:'turkic',text_size_code:'large'}));
  assert.equal(settings.interface_language_code,'tr');assert.equal(settings.alan_script_code,'turkic');assert.equal(settings.text_size_code,'large');
});

test('16.5 Expo Web bootstrap cannot remain permanently on BootScreen after one rejected dependency',()=>{
  const source=read('mobile/AppRoot.js');
  const boot=source.slice(source.indexOf('useEffect(() => {'),source.indexOf('const setFavorites ='));
  assert.match(boot,/Promise\.allSettled/);assert.doesNotMatch(boot,/Promise\.all\(\[/);assert.match(boot,/setBootstrapped\(true\)/);assert.match(boot,/\.catch\(\(\) => \{/);
  const app=JSON.parse(read('mobile/app.json')),pkg=JSON.parse(read('mobile/package.json'));
  assert.equal(app.expo.version,'16.5.0');assert.equal(pkg.version,'16.5.0');assert.equal(app.expo.web.bundler,'metro');
});
