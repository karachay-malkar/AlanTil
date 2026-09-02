import assert from 'node:assert/strict';
import test from 'node:test';
import { FAVORITES_HIDDEN_CONTEXT, hiddenSelectionIds, hiddenSelectionKey, LEGACY_HIDDEN_CONTEXT, setHiddenSelectionIds, stationHiddenSelectionContext } from '../../packages/alantil-core/hidden-selection.js';
import { stationMilestoneCount } from '../../packages/alantil-core/route-progress.js';
import { buildTestOptions, initializeTestState, restoreTestStateSnapshot, testStateSnapshot } from '../../packages/alantil-core/test.js';
import { buildStationTestSessionState, stationTestActiveSnapshot, stationTestDistractors, stationTestPayload } from '../../packages/alantil-core/station-test.js';

const words = [
  { id: 'n1', word: 'тау', trans: 'гора', pos: 'noun', synonyms: ['вершина'] },
  { id: 'n2', word: 'таш', trans: 'камень', pos: 'noun', synonyms: ['скала'] },
  { id: 'n3', word: 'къая', trans: 'скала', pos: 'noun', synonyms: ['утёс'] },
  { id: 'n4', word: 'баш', trans: 'вершина', pos: 'noun', synonyms: ['пик'] },
  { id: 'n5', word: 'тауъ', trans: 'гора', pos: 'noun', synonyms: ['хребет'] },
  { id: 'v1', word: 'бар', trans: 'иди', pos: 'verb', synonyms: [] },
  { id: 'a1', word: 'бийик', trans: 'высокий', pos: 'adjective', synonyms: [] },
];

function state(mode='kb') {
  const value={session:{id:'test-1',startedAt:'2026-09-02T10:00:00.000Z'}};
  initializeTestState(value,words,mode,20,{dictionaryCount:2,sectionCount:3,selectedSources:['d::s'],direction:mode,scopeKeys:['d::s']},words);
  return value;
}

test('16.6.1 General Test distractors stay same-POS, conflict-safe and may return fewer than four options',()=>{
  for(const mode of ['kb','ru']){
    const value=state(mode),item=words[0],options=buildTestOptions(value,item);
    assert.equal(options.filter((option)=>option.id===item.id).length,1);
    assert.equal(new Set(options.map((option)=>option.text)).size,options.length);
    assert.ok(options.length<4,'fixture intentionally leaves fewer than four safe noun options');
    assert.ok(options.every((option)=>option.id===item.id||words.find((word)=>word.id===option.id)?.pos==='noun'));
    assert.ok(!options.some((option)=>option.id==='n5'),'same translation conflict must be excluded');
    assert.ok(!options.some((option)=>option.id==='v1'||option.id==='a1'),'other POS fallback must not be used');
  }
});

test('16.6.1 General Test snapshot restores metadata and stays compatible with old snapshots',()=>{
  const value=state('kb'),snapshot=JSON.parse(JSON.stringify(testStateSnapshot(value)));
  assert.deepEqual(snapshot.metadata,{dictionaryCount:2,sectionCount:3,selectedSources:['d::s'],direction:'kb',scopeKeys:['d::s']});
  assert.deepEqual(restoreTestStateSnapshot(snapshot,words,words).session.metadata,snapshot.metadata);
  delete snapshot.metadata;
  assert.deepEqual(restoreTestStateSnapshot(snapshot,words,words).session.metadata,{});
});

test('16.6.1 Stage Test distractors stay same-POS and reject lexical, translation and synonym conflicts',()=>{
  const item={id:'q',word:'къаяла',trans:'скала',pos:'noun',synonyms:['утёс']};
  const pool=[
    item,
    {id:'safe',word:'таш',trans:'камень',pos:'noun',synonyms:['валун']},
    {id:'translation',word:'таш2',trans:'скала',pos:'noun',synonyms:[]},
    {id:'synonym',word:'таш3',trans:'обрыв',pos:'noun',synonyms:['утёс']},
    {id:'stem',word:'къаялар',trans:'горы',pos:'noun',synonyms:[]},
    {id:'verb',word:'бар',trans:'иди',pos:'verb',synonyms:[]},
  ];
  const distractors=stationTestDistractors(item,pool,3,'kb');
  assert.deepEqual(distractors.map((word)=>word.id),['safe']);
});

test('16.6.1 Stage Test phase survives active snapshot, restore and final payload',()=>{
  const station={key:'story::dict::section::set',dictionaryId:'dict',catalogId:'dict',groupId:'section',sourceSetId:'set',storyType:'story',requiredAccuracy:80,words:words.slice(0,4)};
  const first=buildStationTestSessionState({station,optionWords:words,mode:'kb',id:'stage-1',startedAt:'2026-09-02T10:00:00.000Z',phase:'review_1'});
  assert.equal(first.phase,'review_1');
  const snapshot=JSON.parse(JSON.stringify(stationTestActiveSnapshot(first)));
  assert.equal(snapshot.phase,'review_1');
  const restored=buildStationTestSessionState({station,optionWords:words,mode:'kb',interrupted:snapshot,id:'stage-2',startedAt:'2026-09-02T11:00:00.000Z',phase:'first_test'});
  assert.equal(restored.id,'stage-1');
  assert.equal(restored.phase,'review_1');
  assert.equal(stationTestPayload(restored).phase,'review_1');
});

test('16.6.1 hidden selection is contextual and Favorites cannot leak into Station',()=>{
  const stationA=stationHiddenSelectionContext({key:'story::d::s::set-a',dictionaryId:'d',sectionId:'s',sourceSetId:'set-a'});
  const stationB=stationHiddenSelectionContext({key:'story::d::s::set-b',dictionaryId:'d',sectionId:'s',sourceSetId:'set-b'});
  assert.notEqual(hiddenSelectionKey(stationA),hiddenSelectionKey(stationB));
  assert.notEqual(hiddenSelectionKey(stationA),hiddenSelectionKey(FAVORITES_HIDDEN_CONTEXT));
  let map={};
  map=setHiddenSelectionIds(map,stationA,new Set(['n1']));
  map=setHiddenSelectionIds(map,FAVORITES_HIDDEN_CONTEXT,new Set(['n2']));
  assert.deepEqual([...hiddenSelectionIds(map,stationA)],['n1']);
  assert.deepEqual([...hiddenSelectionIds(map,stationB)],[]);
  assert.deepEqual([...hiddenSelectionIds(map,FAVORITES_HIDDEN_CONTEXT)],['n2']);
  assert.equal(hiddenSelectionKey(LEGACY_HIDDEN_CONTEXT),'legacy:default:default');
});

test('16.6.1 Path milestone contract allows at most four marks',()=>{
  assert.deepEqual([0,19,20,39,40,59,60,79,80,120].map(stationMilestoneCount),[0,0,1,1,2,2,3,3,4,4]);
});
