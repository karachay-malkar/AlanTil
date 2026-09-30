import {normalizePos} from '../alantil-core/word-normalizer.js';
import {hasWordConflict,practiceEligibleWords,shuffle} from '../alantil-core/word-selection.js';

const ASHYK_CURRICULUM_DICTIONARIES=Object.freeze(new Set(['beginner','intermediate','advanced']));

function idOf(word){return String(word?.id||word?.word_id||'').trim();}
function dictionaryId(word){return String(word?.dictionary_id||word?.dictionaryId||'').trim();}
function storyId(word){return String(word?.story_id||word?.storyId||'').trim();}
function alan(word){return String(word?.word||word?.wordAlanCyrillic||'').trim();}
function ru(word){return String(word?.trans||word?.translationRu||'').trim();}
function text(value){return String(value||'').trim();}
function storyName(word,locale){
  if(locale==='en')return text(word?.storyNameEn||word?.story_name_en);
  if(locale==='tr')return text(word?.storyNameTr||word?.story_name_tr);
  return text(word?.storyNameRu||word?.story_name_ru||word?.story_name);
}

export function ashykEligibleWords(words=[],{storyIds=null}={}){
  const selected=Array.isArray(storyIds)?new Set(storyIds.map((value)=>String(value||'').trim()).filter(Boolean)):null,seen=new Set();
  return practiceEligibleWords(words).filter((word)=>{
    const id=idOf(word),dictionary=dictionaryId(word),story=storyId(word),pos=normalizePos(word?.pos);
    if(!ASHYK_CURRICULUM_DICTIONARIES.has(dictionary)||!story||!id||!alan(word)||!ru(word)||!pos||seen.has(id))return false;
    if(selected&&!selected.has(story))return false;
    seen.add(id);
    return true;
  });
}

export function ashykAvailableStoryScopes(words=[]){
  const scopes=new Map();
  for(const word of ashykEligibleWords(words)){
    const id=storyId(word);
    if(!scopes.has(id))scopes.set(id,{id,names:{ru:storyName(word,'ru'),en:storyName(word,'en'),tr:storyName(word,'tr')},count:0});
    const scope=scopes.get(id);
    scope.count+=1;
    for(const locale of['ru','en','tr'])if(!scope.names[locale])scope.names[locale]=storyName(word,locale);
  }
  return Array.from(scopes.values(),(scope)=>Object.freeze({id:scope.id,names:Object.freeze({...scope.names}),count:scope.count}));
}

export function ashykStoryScopeLabel(scope,locale='ru'){
  const code=locale==='en'||locale==='tr'?locale:'ru';
  return text(scope?.names?.[code]||scope?.names?.ru||scope?.names?.en||scope?.names?.tr||scope?.id);
}

function optionText(word){return ru(word);}
function buildOptions(item,pool){const targetPOS=normalizePos(item?.pos),samePOS=pool.filter((candidate)=>idOf(candidate)!==idOf(item)&&normalizePos(candidate?.pos)===targetPOS),options=[{id:idOf(item),text:optionText(item)}],selected=[],texts=new Set([optionText(item)]);for(const candidate of shuffle(samePOS.slice())){if(options.length>=4)break;if(hasWordConflict(candidate,[item,...selected]))continue;const text=optionText(candidate);if(!text||texts.has(text))continue;selected.push(candidate);texts.add(text);options.push({id:idOf(candidate),text});}return options.length===4?shuffle(options):null;}

export function createAshykQuestionDeck(words=[],{storyIds=null}={}){
  const pool=ashykEligibleWords(words,{storyIds});let asked=new Set();
  function reset(){asked=new Set();}
  function next(){let candidates=pool.filter((word)=>!asked.has(idOf(word)));for(let pass=0;pass<2;pass+=1){for(const item of shuffle(candidates.slice())){const options=buildOptions(item,pool);if(!options)continue;asked.add(idOf(item));return{id:idOf(item),prompt:alan(item),answer:optionText(item),answerId:idOf(item),pos:normalizePos(item.pos),options};}reset();candidates=pool.slice();}throw new Error('ASHYK_QUESTION_POOL_TOO_SMALL');}
  return{size:pool.length,next,reset,getAskedCount:()=>asked.size};
}
