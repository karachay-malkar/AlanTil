import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  ashykAvailableStoryScopes,
  ashykEligibleWords,
  ashykStoryScopeLabel,
  createAshykQuestionDeck,
} from '../packages/ashyk-game/vocabulary.js';
import {createAshykGameStore} from '../packages/ashyk-game/store.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(ROOT,file),'utf8');

function storyWords({storyId,dictionaryId,nameRu,start=1}){
  return Array.from({length:5},(_,index)=>({
    id:`${storyId}-${index+start}`,
    word:`алан-${storyId}-${index}`,
    trans:`рус-${storyId}-${index}`,
    pos:'noun',
    usedInTest:true,
    story_id:storyId,
    dictionary_id:dictionaryId,
    storyNameRu:nameRu,
    storyNameEn:`${nameRu} EN`,
    storyNameTr:`${nameRu} TR`,
  }));
}

const understanding=storyWords({storyId:'understanding',dictionaryId:'beginner',nameRu:'Начать понимать'});
const roots=storyWords({storyId:'roots',dictionaryId:'intermediate',nameRu:'Возвращение к истокам',start:20});
const pathways=storyWords({storyId:'pathways',dictionaryId:'animals',nameRu:'Тропы',start:40});
const words=[...understanding,...roots,...pathways];

test('Ashyk word scopes come from visible curriculum words and use content-provided names',()=>{
  const scopes=ashykAvailableStoryScopes(words);
  assert.deepEqual(scopes.map((scope)=>scope.id),['understanding','roots']);
  assert.deepEqual(scopes.map((scope)=>ashykStoryScopeLabel(scope,'ru')),['Начать понимать','Возвращение к истокам']);
  assert.equal(scopes.some((scope)=>scope.id==='pathways'),false);
});

test('question pool follows selected story checkboxes',()=>{
  assert.deepEqual(new Set(ashykEligibleWords(words,{storyIds:['understanding']}).map((word)=>word.story_id)),new Set(['understanding']));
  assert.equal(ashykEligibleWords(words,{storyIds:[]}).length,0);
  const deck=createAshykQuestionDeck(words,{storyIds:['roots']});
  for(let index=0;index<4;index+=1)assert.match(deck.next().id,/^roots-/);
});

test('store defaults to every currently available curriculum story and rebuilds the deck on selection',()=>{
  const engine={reset(){},clearSelection(){}};
  const store=createAshykGameStore({engine,words,setTimer:()=>1,clearTimer(){},setRepeater:()=>0,clearRepeater(){}});
  assert.deepEqual(store.getState().selectedStoryIds,['understanding','roots']);
  assert.deepEqual(store.getState().availableStoryScopes.map(({id})=>id),['understanding','roots']);
  store.setWordStories(['understanding']);
  assert.deepEqual(store.getState().selectedStoryIds,['understanding']);
  store.setWordStories([]);
  assert.equal(store.startComputer('normal'),false);
  store.setWordStories(['roots']);
  assert.equal(store.startComputer('normal'),true);
  store.handleEngineEvent({type:'shotSettled',result:{success:true,hitAny:true,attackerFace:'АЛЧИ',targetFace:'АЛЧИ',remainingPieces:9}});
  assert.match(store.getState().question?.id||'',/^roots-/);
  store.destroy();
});

test('Web and Native setup render dynamic word-section checkboxes from the store contract',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx');
  const mobile=read('mobile/screens/ashyk.js');
  const css=read('src/features/ashyk/ashyk.css');
  assert.match(web,/m\.wordSections/);
  assert.match(web,/type="checkbox"/);
  assert.match(web,/ashykStoryScopeLabel/);
  assert.match(web,/store\.setWordStories/);
  assert.doesNotMatch(web,/Начать понимать|Возвращение к истокам/);
  assert.match(mobile,/m\.wordSections/);
  assert.match(mobile,/accessibilityRole="checkbox"/);
  assert.match(mobile,/ashykStoryScopeLabel/);
  assert.match(mobile,/store\.setWordStories/);
  assert.doesNotMatch(mobile,/Начать понимать|Возвращение к истокам/);
  assert.match(css,/ashykWordScopes/);
});

test('the dictionary source for Ashyk is visibility-filtered by the shared v_words_app contract',()=>{
  const repo=read('src/shared/data/word-repository.js');
  const contract=read('packages/alantil-core/dictionary-contract.js');
  const migration=read('supabase/migrations/20260930115701_alantil_16_8_content_visibility.sql');
  assert.match(contract,/DICTIONARY_CONTENT_TABLE = 'v_words_app'/);
  assert.match(repo,/getCompleteDictionaryWords/);
  assert.match(migration,/where story\.is_visible[\s\S]*dict\.is_visible[\s\S]*sec\.is_visible[\s\S]*set_node\.is_visible/);
});
