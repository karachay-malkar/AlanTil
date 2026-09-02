function normalized(value,fallback=''){return String(value??fallback).trim();}
export const LEGACY_HIDDEN_CONTEXT={dictionaryId:'legacy',sectionId:'default',setId:'default'};
export const FAVORITES_HIDDEN_CONTEXT={dictionaryId:'favorites',sectionId:'favorites',setId:'favorites'};
export function hiddenSelectionContext({dictionaryId='',sectionId='',groupId='',setId='',selectionSet='',stationKey=''}={}){return{dictionaryId:normalized(dictionaryId),sectionId:normalized(sectionId||groupId),setId:normalized(setId||selectionSet||stationKey)};}
export function hiddenSelectionKey(context={}){const value=hiddenSelectionContext(context);return `${value.dictionaryId}:${value.sectionId}:${value.setId}`;}
export function stationHiddenSelectionContext(station={}){return hiddenSelectionContext({dictionaryId:station.dictionaryId||station.catalogId,sectionId:station.sectionId||station.groupId,setId:station.sourceSetId||station.setId||station.selectionSet||station.key});}
export function hiddenSelectionIds(map,context={}){const key=hiddenSelectionKey(context),values=map&&typeof map==='object'?map[key]:null;return new Set((Array.isArray(values)?values:[]).map((id)=>String(id)).filter(Boolean));}
export function setHiddenSelectionIds(map,context,ids){const next={...(map&&typeof map==='object'?map:{})},key=hiddenSelectionKey(context),values=Array.from(new Set(Array.from(ids||[]).map((id)=>String(id)).filter(Boolean)));if(values.length)next[key]=values;else delete next[key];return next;}
