// Rebuild a compact, read-only path map from the exact shipped dictionary.
// The full dictionary remains authoritative for study, tests and word lists.
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync,constants as zlibConstants} from 'node:zlib';
import {normalizeSupabaseWordEntry} from '../../src/shared/domain/word-structure-compat.js';
import {getDisplayedWordCollection} from '../../packages/alantil-core/alan-display.js';
import {buildLearningRoute} from '../../packages/alantil-core/learning-route.js';

const source=new URL('../../src/data/dictionary-snapshot.json',import.meta.url);
const destination=new URL('../../src/data/path-route-index.json',import.meta.url);
const snapshot=JSON.parse(await readFile(source,'utf8'));
if(!String(snapshot.version||'').trim()||!Array.isArray(snapshot.words)||!snapshot.words.length)throw new Error('Dictionary snapshot missing');
const storyMap=new Map();
(snapshot.stories||[]).slice().sort((a,b)=>Number(a.story_order||0)-Number(b.story_order||0)).forEach(story=>{
  (Array.isArray(story.dictionary_ids)?story.dictionary_ids:[]).forEach(id=>{
    id=String(id||'').trim();
    if(id&&!storyMap.has(id))storyMap.set(id,story);
  });
});
const normalized=snapshot.words.map(row=>normalizeSupabaseWordEntry(row,storyMap.get(String(row?.dictionary_id||'').trim())||null)).filter(Boolean)
 .sort((a,b)=>Number(a.global_order||0)-Number(b.global_order||0));
if(normalized.length!==snapshot.words.length)throw new Error('Normalization unexpectedly discarded words');
const ids=new Set();
const stationKeys=new Set();
const essential=['id','story_id','dictionary_id','section_id','set_id','global_order','dict_order','required_accuracy'];
const names=['storyNameRu','storyNameEn','storyNameTr','storyIntroRu','storyIntroEn','storyIntroTr','dictionaryNameRu','dictionaryNameEn','dictionaryNameTr','sectionNameRu','sectionNameEn','sectionNameTr','setNameRu','setNameEn','setNameTr','setNameAlanCyrillic','setNameAlanTurkic'];
const minimal=normalized.map(word=>{
  if(!word.id||!word.story_id||!word.dictionary_id||!word.section_id||!word.set_id)throw new Error('Invalid route coordinates');
  if(ids.has(word.id))throw new Error('Duplicate word ID '+word.id);
  ids.add(word.id);
  const key=[word.story_id,word.dictionary_id,word.section_id,word.set_id].join('::');
  const first=!stationKeys.has(key);
  stationKeys.add(key);
  const result={};
  for(const field of essential)if(word[field]!==undefined&&word[field]!==null&&word[field]!=='')result[field]=word[field];
  if(first)for(const field of names)if(word[field]!==undefined&&word[field]!==null&&word[field]!=='')result[field]=word[field];
  return result;
});
function signature(route){
 const result={order:route.storyOrder,labels:route.storyLabels,stories:{}};
 for(const type of route.storyOrder){
  const story=route.stories[type];
  result.stories[type]={intro:story.intro,stations:story.stations.map(s=>({
   key:s.key,slug:s.slug,name:s.name,section:s.sectionName,catalog:s.catalogName,ids:s.words.map(w=>w.id)
  }))};
 }
 return JSON.stringify(result);
}
for(const language of ['ru','en','tr']){
 for(const script of ['cyrillic','turkic']){
  const settings={interface_language_code:language,translation_language_code:language,alan_script_code:script,alan_dialect_code:'canonical'};
  const full=signature(buildLearningRoute(getDisplayedWordCollection(normalized,settings)));
  const condensed=signature(buildLearningRoute(getDisplayedWordCollection(minimal,settings)));
  if(full!==condensed)throw new Error('Path index parity mismatch for '+language+' / '+script);
 }
}
const json=JSON.stringify({version:snapshot.version,word_count:minimal.length,words:minimal})+'\n';
if(json.length>= (await readFile(source,'utf8')).length)throw new Error('Route index did not reduce the dictionary transfer size');
await writeFile(destination,json);
const gzipped=gzipSync(Buffer.from(json),{level:9,strategy:zlibConstants.Z_DEFAULT_STRATEGY});
if(gzipped.length >= Buffer.byteLength(json)*0.6)throw new Error('Compressed route index unexpectedly large');
await writeFile(new URL('../../src/data/path-route-index.json.gz',import.meta.url),gzipped);
console.log('Route index: '+minimal.length+' words / '+stationKeys.size+' stations / '+Buffer.byteLength(json)+' bytes, gzip '+gzipped.length+' bytes; all language parity checks passed');
