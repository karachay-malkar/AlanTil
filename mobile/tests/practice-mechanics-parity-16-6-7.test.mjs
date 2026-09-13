import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPracticeScope, practiceScopeKey, practiceSelectedPool } from '../../packages/alantil-core/practice-scope.js';
import { practiceEligibleWords } from '../../packages/alantil-core/word-selection.js';
import { restoreTestStateSnapshot } from '../../packages/alantil-core/test.js';
import { restoreMatchStateSnapshot } from '../../packages/alantil-core/match.js';
import { BUNDLED_SONG_CATALOG, isSongsCacheFresh, normalizeSupabaseSongs } from '../../packages/alantil-core/song-supabase.js';

const words=[
  {id:'1',word:'a',trans:'A',pos:'noun',dictionary_id:'d1',dictionary_name:'D1',section_id:'s1',section_name:'S1',usedInTest:true},
  {id:'2',word:'b',trans:'B',pos:'noun',dictionary_id:'d1',dictionary_name:'D1',section_id:'s1',section_name:'S1',usedInTest:false},
  {id:'3',word:'c',trans:'C',pos:'noun',dictionary_id:'d1',dictionary_name:'D1',section_id:'s2',section_name:'S2',usedInTest:true},
];

test('Practice scope and pool exclude usedInTest=false on every platform',()=>{
  assert.deepEqual(practiceEligibleWords(words).map(w=>w.id),['1','3']);
  const scope=buildPracticeScope(words);
  assert.equal(scope[0].count,2);
  assert.deepEqual(scope[0].sections.map(section=>[section.id,section.count]),[['s1',1],['s2',1]]);
  const pool=practiceSelectedPool(words,new Set([practiceScopeKey('d1','s1')]));
  assert.deepEqual(pool.map(w=>w.id),['1']);
});

test('stale Test snapshot containing a disabled word is rejected',()=>{
  const snapshot={id:'t1',startedAt:'2026-09-13T00:00:00Z',mode:'kb',limit:20,metadata:{},poolIds:['1','2'],itemIds:['1','2'],index:0,correct:0,results:[]};
  assert.equal(restoreTestStateSnapshot(snapshot,words,words),null);
});

test('stale Match snapshot containing a disabled word is rejected',()=>{
  const snapshot={id:'m1',startedAt:'2026-09-13T00:00:00Z',limit:20,metadata:{},poolIds:['1','2'],rounds:[['1','2']],roundIndex:0,solvedCount:0,total:2,errorsCount:0,failMap:{},errorPairs:{},solved:[],shown:[],activeRoundIds:[],activeRightIds:[]};
  assert.equal(restoreMatchStateSnapshot(snapshot,words),null);
});

test('bundled songs catalog is available before network and cache TTL is non-blocking',()=>{
  assert.equal(BUNDLED_SONG_CATALOG.length,44);
  assert.equal(BUNDLED_SONG_CATALOG[0].id,'S0001');
  const now=1_000_000;
  assert.equal(isSongsCacheFresh(now-1000,now),true);
  assert.equal(isSongsCacheFresh(0,now),false);
});

test('Supabase song rows map multilingual fields without inventing translations',()=>{
  const [song]=normalizeSupabaseSongs([{id:'S1',title_alan_cyrillic:'Тест',title_en:null,title_tr:null,performer:'Singer',sort_order:1,playlist_id:'p',playlist_title:'P',playlist_order:1,lyrics_alan_cyrillic:'A',lyrics_ru:'Б',lyrics_en:null,lyrics_tr:null}]);
  assert.equal(song.title,'Тест');
  assert.equal(song.lyrics,'A');
  assert.equal(song.translation,'Б');
  assert.equal(song.titleEn,'');
  assert.equal(song.lyricsTr,'');
});
