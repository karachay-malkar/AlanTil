import { parseExampleGroups } from './example-groups.js';

function text(value){return String(value||'').trim();}
function splitTranslations(value){const source=text(value);if(!source)return[];return source.split(/\s*[;；]\s*|\s+\d+\.\s+/u).map((part)=>text(part)).filter(Boolean);}
function synonyms(value){const source=text(value);if(!source)return[];return source.split(/\s*[,;；]\s*/u).map((part)=>text(part)).filter(Boolean);}
export function buildLearnCardModel(word,mode='kb',settings={}){
  const item=word||{};
  const alan=text(item.word||item.wordAlanCyrillic||item.word_alan_cyrillic||item.wordAlanTurkic||item.word_alan_turkic);
  const translation=text(item.trans||item.translationRu||item.translation_ru);
  const example=text(item.example||item.examples||item.example_alan||item.phrases_alan||item.phrasesAlan);
  const exampleTranslation=text(item.example_translation||item.example_ru||item.phrases_ru||item.phrasesRu);
  const groups=parseExampleGroups(example).map((group,index)=>({index:group.index,lines:group.lines,translationLines:parseExampleGroups(exampleTranslation).find((row)=>row.index===group.index)?.lines||[]}));
  const direction=mode==='ru'?'ru_to_alan':'alan_to_ru';
  return {
    id:String(item.id||''),direction,
    front:{primary:direction==='ru_to_alan'?translation:alan},
    back:{primary:direction==='ru_to_alan'?alan:translation,translations:splitTranslations(translation),synonyms:synonyms(item.synonyms),examples:groups},
    alan,translation,
    metadata:{dictionaryId:String(item.dictionary_id||''),sectionId:String(item.section_id||''),setId:String(item.set_id||''),textSizeCode:String(settings?.text_size_code||'medium')},
  };
}
