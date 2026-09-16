import { masteryLevelForPercent } from './mastery.js';

export const RATING_DICTIONARY_WEIGHTS=Object.freeze({beginner:1,intermediate:2,advanced:3,thematic:1.5});
export const RATING_MASTERY_WEIGHTS=Object.freeze({0:0,1:1,2:1.5,3:2});
export const LEVEL_DICTIONARY_IDS=Object.freeze(new Set(['beginner','intermediate','advanced']));

export function dictionaryRatingWeight(dictionaryId){const id=String(dictionaryId||'').trim().toLowerCase();return LEVEL_DICTIONARY_IDS.has(id)?RATING_DICTIONARY_WEIGHTS[id]:RATING_DICTIONARY_WEIGHTS.thematic;}
export function masteryRatingWeight(percent){return RATING_MASTERY_WEIGHTS[masteryLevelForPercent(percent)]||0;}
export function ratingPointsForWord({dictionaryId,masteryPercent}={}){return dictionaryRatingWeight(dictionaryId)*masteryRatingWeight(masteryPercent);}
export function ratingScoreForWords(rows=[]){const bestByWord=new Map();for(const row of Array.isArray(rows)?rows:[]){const wordId=String(row?.wordId??row?.word_id??'').trim();if(!wordId)continue;const points=ratingPointsForWord({dictionaryId:row?.dictionaryId??row?.dictionary_id,masteryPercent:row?.masteryPercent??row?.mastery_percent});bestByWord.set(wordId,Math.max(bestByWord.get(wordId)||0,points));}return Number(Array.from(bestByWord.values()).reduce((sum,value)=>sum+value,0).toFixed(2));}
