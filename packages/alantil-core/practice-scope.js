function dictionaryId(word){return String(word?.dictionary_id||word?.dictionaryId||'').trim();}
function dictionaryName(word){return String(word?.dictionary_name||word?.dictionaryName||dictionaryId(word)).trim();}
function sectionId(word){return String(word?.section_id||word?.sectionId||'').trim();}
function sectionName(word){return String(word?.section_name||word?.sectionName||sectionId(word)).trim();}
export function practiceScopeKey(dictionary,section){return `${String(dictionary||'').trim()}||${String(section||'').trim()}`;}
export function practiceWordScopeKey(word){return practiceScopeKey(dictionaryId(word),sectionId(word));}
export function buildPracticeScope(words=[]){const dictionaries=new Map();for(const word of Array.isArray(words)?words:[]){const dictId=dictionaryId(word),wordSectionId=sectionId(word);if(!dictId||!wordSectionId)continue;if(!dictionaries.has(dictId))dictionaries.set(dictId,{id:dictId,name:dictionaryName(word),count:0,sections:new Map()});const dictionary=dictionaries.get(dictId);dictionary.count+=1;if(!dictionary.sections.has(wordSectionId))dictionary.sections.set(wordSectionId,{id:wordSectionId,name:sectionName(word),count:0});dictionary.sections.get(wordSectionId).count+=1;}return Array.from(dictionaries.values()).map((dictionary)=>({...dictionary,sections:Array.from(dictionary.sections.values())}));}
export function practiceSelectedPool(words=[],selectedKeys=new Set()){const keys=selectedKeys instanceof Set?selectedKeys:new Set(selectedKeys||[]);return (Array.isArray(words)?words:[]).filter((word)=>keys.has(practiceWordScopeKey(word)));}
