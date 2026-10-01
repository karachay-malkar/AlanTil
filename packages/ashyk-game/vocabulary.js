import {normalizePos} from '../alantil-core/word-normalizer.js';
import {hasWordConflict,practiceEligibleWords,shuffle} from '../alantil-core/word-selection.js';

export const ASHYK_QUESTION_DICTIONARY_IDS=Object.freeze(['beginner','intermediate']);
const ALLOWED_DICTIONARIES=new Set(ASHYK_QUESTION_DICTIONARY_IDS);

function idOf(word){return String(word?.id||word?.word_id||'').trim();}
function dictionaryId(word){return String(word?.dictionary_id||word?.dictionaryId||'').trim();}
function storyId(word){return String(word?.story_id||word?.storyId||word?.story_type||'').trim();}
function alan(word){return String(word?.word||word?.wordAlanCyrillic||'').trim();}
function ru(word){return String(word?.trans||word?.translationRu||'').trim();}
function orderOf(word,index=0){const value=Number(word?.global_order??word?.globalOrder??word?.dict_order);return Number.isFinite(value)?value:index;}
function localeCode(locale){return locale==='en'||locale==='tr'?locale:'ru';}
function storyName(word,locale='ru'){
  const code=localeCode(locale);
  const localized=code==='en'
    ? word?.storyNameEn||word?.story_name_en
    : code==='tr'
      ? word?.storyNameTr||word?.story_name_tr
      : word?.storyNameRu||word?.story_name_ru||word?.story_name;
  return String(localized||word?.storyNameRu||word?.story_name_ru||word?.story_name||storyId(word)).trim();
}
function allowedStorySelection(selectedStoryIds){
  if(selectedStoryIds===undefined||selectedStoryIds===null)return null;
  return new Set((selectedStoryIds instanceof Set?[...selectedStoryIds]:Array.isArray(selectedStoryIds)?selectedStoryIds:[]).map((id)=>String(id||'').trim()).filter(Boolean));
}
function baseEligibleWords(words=[]){
  const seen=new Set();
  return practiceEligibleWords(words).filter((word)=>{
    const id=idOf(word),pos=normalizePos(word?.pos),story=storyId(word);
    if(!ALLOWED_DICTIONARIES.has(dictionaryId(word))||!story||!id||!alan(word)||!ru(word)||!pos||seen.has(id))return false;
    seen.add(id);
    return true;
  });
}

export function ashykEligibleWords(words=[],selectedStoryIds=null){
  const selected=allowedStorySelection(selectedStoryIds);
  return baseEligibleWords(words).filter((word)=>!selected||selected.has(storyId(word)));
}

export function buildAshykQuestionScopes(words=[],locale='ru'){
  const scopes=new Map();
  baseEligibleWords(words).forEach((word,index)=>{
    const id=storyId(word);
    if(!scopes.has(id))scopes.set(id,{id,name:storyName(word,locale),count:0,order:orderOf(word,index)});
    const scope=scopes.get(id);
    scope.count+=1;
    scope.order=Math.min(scope.order,orderOf(word,index));
    if(!scope.name)scope.name=storyName(word,locale);
  });
  return [...scopes.values()].sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)).map(({id,name,count})=>({id,name,count}));
}

export function ashykQuestionStoryIds(words=[]){return buildAshykQuestionScopes(words).map((scope)=>scope.id);}

function optionText(word){return ru(word);}
function buildOptions(item,pool){const targetPOS=normalizePos(item?.pos),samePOS=pool.filter((candidate)=>idOf(candidate)!==idOf(item)&&normalizePos(candidate?.pos)===targetPOS),options=[{id:idOf(item),text:optionText(item)}],selected=[],texts=new Set([optionText(item)]);for(const candidate of shuffle(samePOS.slice())){if(options.length>=4)break;if(hasWordConflict(candidate,[item,...selected]))continue;const text=optionText(candidate);if(!text||texts.has(text))continue;selected.push(candidate);texts.add(text);options.push({id:idOf(candidate),text});}return options.length===4?shuffle(options):null;}
export function createAshykQuestionDeck(words=[],selectedStoryIds=null){const pool=ashykEligibleWords(words,selectedStoryIds);let asked=new Set();function reset(){asked=new Set();}function next(){let candidates=pool.filter((word)=>!asked.has(idOf(word)));for(let pass=0;pass<2;pass+=1){for(const item of shuffle(candidates.slice())){const options=buildOptions(item,pool);if(!options)continue;asked.add(idOf(item));return{id:idOf(item),prompt:alan(item),answer:optionText(item),answerId:idOf(item),pos:normalizePos(item.pos),options};}reset();candidates=pool.slice();}throw new Error('ASHYK_QUESTION_POOL_TOO_SMALL');}return{size:pool.length,next,reset,getAskedCount:()=>asked.size};}
