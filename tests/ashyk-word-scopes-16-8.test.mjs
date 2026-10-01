import test from 'node:test';
import assert from 'node:assert/strict';
import * as vocabulary from '../packages/ashyk-game/vocabulary.js';
import {createAshykGameStore} from '../packages/ashyk-game/store.js';
import {normalizeSupabaseWordEntry} from '../packages/alantil-core/word-normalizer.js';
import {readFileSync} from 'node:fs';

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

function wordsFor({storyId,dictionaryId,storyName,offset=0,count=5}){
  return Array.from({length:count},(_,index)=>({
    id:`${storyId}-${index+1}`,
    word:`alan-${storyId}-${index+1}`,
    trans:`translation-${storyId}-${index+1}`,
    pos:'noun',
    synonyms:[],
    usedInTest:true,
    story_id:storyId,
    storyNameRu:storyName,
    storyNameEn:`EN ${storyName}`,
    storyNameTr:`TR ${storyName}`,
    story_name:storyName,
    dictionary_id:dictionaryId,
    section_id:`${dictionaryId}-section`,
    set_id:`${dictionaryId}-set`,
    global_order:offset+index+1,
  }));
}

const understanding=wordsFor({storyId:'understanding',dictionaryId:'beginner',storyName:'Начать понимать',offset:0});
const roots=wordsFor({storyId:'roots',dictionaryId:'intermediate',storyName:'Возвращение к истокам',offset:100});
const pathways=wordsFor({storyId:'pathways',dictionaryId:'thematic',storyName:'Тропы',offset:200});
const all=[...understanding,...roots,...pathways];

test('Ashyk question pool can be restricted to the selected visible story',()=>{
  const pool=vocabulary.ashykEligibleWords(all,['understanding']);
  assert.equal(pool.length,understanding.length);
  assert.ok(pool.every((word)=>word.story_id==='understanding'));
});

test('Ashyk question scopes are derived from current eligible content and names are not hardcoded in UI',()=>{
  assert.equal(typeof vocabulary.buildAshykQuestionScopes,'function');
  if(typeof vocabulary.buildAshykQuestionScopes!=='function')return;
  assert.deepEqual(vocabulary.buildAshykQuestionScopes(all,'ru'),[
    {id:'understanding',name:'Начать понимать',count:5},
    {id:'roots',name:'Возвращение к истокам',count:5},
  ]);
  assert.deepEqual(vocabulary.buildAshykQuestionScopes(understanding,'ru'),[
    {id:'understanding',name:'Начать понимать',count:5},
  ]);
});

test('Ashyk store selects all available question stories by default and prunes a story when visibility removes it',()=>{
  const engine={reset(){},clearSelection(){}};
  const store=createAshykGameStore({engine,words:all,setTimer:null,setRepeater:null});
  assert.deepEqual(store.getState().selectedQuestionStoryIds,['understanding','roots']);
  store.setWords(understanding);
  assert.deepEqual(store.getState().selectedQuestionStoryIds,['understanding']);
  store.setWords([...understanding,...roots]);
  assert.deepEqual(store.getState().selectedQuestionStoryIds,['understanding','roots']);
  store.setQuestionStoryIds(['roots']);
  assert.deepEqual(store.getState().selectedQuestionStoryIds,['roots']);
  store.setWords(understanding);
  assert.deepEqual(store.getState().selectedQuestionStoryIds,[]);
  store.setWords([...understanding,...roots]);
  assert.deepEqual(store.getState().selectedQuestionStoryIds,[]);
  store.destroy();
});

test('current dictionary snapshot exposes only beginner and intermediate Ashyk sections',()=>{
  const snapshot=JSON.parse(read('src/data/dictionary-snapshot.json'));
  const stories=new Map(snapshot.stories.map((story)=>[story.story_id,story]));
  const words=snapshot.words.map((row)=>normalizeSupabaseWordEntry(row,stories.get(row.story_id))).filter(Boolean);
  assert.deepEqual(vocabulary.buildAshykQuestionScopes(words,'ru'),[
    {id:'understanding',name:'Начать понимать',count:900},
    {id:'roots',name:'Возвращение к истокам',count:780},
  ]);
});

test('Web and Mobile setup expose the same section checkbox selector',()=>{
  const web=read('packages/ashyk-game/web/Game.jsx');
  const mobile=read('mobile/screens/ashyk.js');
  assert.match(web,/questionScopesLabel/);
  assert.match(web,/scopeCheckbox/);
  assert.match(web,/setQuestionStoryIds/);
  assert.match(mobile,/questionScopesLabel/);
  assert.match(mobile,/Checkbox/);
  assert.match(mobile,/setQuestionStoryIds/);
  for(const source of [web,mobile]){
    assert.doesNotMatch(source,/Начать понимать/);
    assert.doesNotMatch(source,/Возвращение к истокам/);
  }
});
