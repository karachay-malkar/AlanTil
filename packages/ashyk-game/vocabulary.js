import {normalizePos} from '../alantil-core/word-normalizer.js';
import {hasWordConflict,practiceEligibleWords,shuffle} from '../alantil-core/word-selection.js';
function idOf(word){return String(word?.id||word?.word_id||'').trim();}
function dictionaryId(word){return String(word?.dictionary_id||word?.dictionaryId||'').trim();}
function storyId(word){return String(word?.story_id||word?.storyId||'').trim();}
function alan(word){return String(word?.word||word?.wordAlanCyrillic||'').trim();}
function ru(word){return String(word?.trans||word?.translationRu||'').trim();}
export function ashykEligibleWords(words=[]){const seen=new Set();return practiceEligibleWords(words).filter((word)=>{const id=idOf(word),pos=normalizePos(word?.pos);if(dictionaryId(word)!=='intermediate'||storyId(word)!=='roots'||!id||!alan(word)||!ru(word)||!pos||seen.has(id))return false;seen.add(id);return true;});}
function optionText(word){return ru(word);}
function buildOptions(item,pool){const targetPOS=normalizePos(item?.pos),samePOS=pool.filter((candidate)=>idOf(candidate)!==idOf(item)&&normalizePos(candidate?.pos)===targetPOS),options=[{id:idOf(item),text:optionText(item)}],selected=[],texts=new Set([optionText(item)]);for(const candidate of shuffle(samePOS.slice())){if(options.length>=4)break;if(hasWordConflict(candidate,[item,...selected]))continue;const text=optionText(candidate);if(!text||texts.has(text))continue;selected.push(candidate);texts.add(text);options.push({id:idOf(candidate),text});}return options.length===4?shuffle(options):null;}
export function createAshykQuestionDeck(words=[]){const pool=ashykEligibleWords(words);let asked=new Set();function reset(){asked=new Set();}function next(){let candidates=pool.filter((word)=>!asked.has(idOf(word)));for(let pass=0;pass<2;pass+=1){for(const item of shuffle(candidates.slice())){const options=buildOptions(item,pool);if(!options)continue;asked.add(idOf(item));return{id:idOf(item),prompt:alan(item),answer:optionText(item),answerId:idOf(item),pos:normalizePos(item.pos),options};}reset();candidates=pool.slice();}throw new Error('ASHYK_QUESTION_POOL_TOO_SMALL');}return{size:pool.length,next,reset,getAskedCount:()=>asked.size};}
