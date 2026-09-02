import fs from 'node:fs/promises';
import path from 'node:path';
import { DICTIONARY_CONTENT_TABLE, DICTIONARY_KEY, DICTIONARY_METADATA_TABLE, DICTIONARY_PAGE_SIZE, DICTIONARY_STORIES_TABLE } from '../packages/alantil-core/dictionary-contract.js';

const SUPABASE_URL=process.env.ALANTIL_SUPABASE_URL||'https://pybrzgedqjmosbmilcea.supabase.co';
const SUPABASE_KEY=process.env.ALANTIL_SUPABASE_KEY||'sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a';
const target=path.resolve('mobile/data/dictionary-snapshot.json');
async function rest(table,params){const query=new URLSearchParams(params);const response=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`,{headers:{apikey:SUPABASE_KEY,Accept:'application/json'}});if(!response.ok)throw new Error(`${table} failed (${response.status}): ${await response.text()}`);return response.json();}
function canonical(snapshot){return JSON.stringify({version:snapshot?.version||'',source:snapshot?.source||'',word_count:Number(snapshot?.word_count||0),story_count:Number(snapshot?.story_count||0),words:Array.isArray(snapshot?.words)?snapshot.words:[],stories:Array.isArray(snapshot?.stories)?snapshot.stories:[]});}
async function readExisting(){try{return JSON.parse(await fs.readFile(target,'utf8'));}catch{return null;}}

const metadata=await rest(DICTIONARY_METADATA_TABLE,{select:'current_version',dictionary_key:`eq.${DICTIONARY_KEY}`,limit:'1'}),version=String(metadata?.[0]?.current_version||'').trim();if(!version)throw new Error('dictionary_metadata current_version missing');
const words=[];for(let offset=0;;offset+=DICTIONARY_PAGE_SIZE){const page=await rest(DICTIONARY_CONTENT_TABLE,{select:'*',order:'global_order.asc',offset:String(offset),limit:String(DICTIONARY_PAGE_SIZE)});words.push(...page);if(page.length<DICTIONARY_PAGE_SIZE)break;}
const stories=await rest(DICTIONARY_STORIES_TABLE,{select:'*',order:'story_order.asc'});
if(!words.length)throw new Error('v_words_app is empty');const ids=new Set();for(const row of words){const id=String(row?.word_id||'').trim();if(!id)throw new Error('word_id missing');if(ids.has(id))throw new Error(`duplicate word_id ${id}`);ids.add(id);for(const field of ['dictionary_id','section_id','set_id'])if(!String(row?.[field]||'').trim())throw new Error(`${field} missing for ${id}`);if(!String(row?.translation_ru||'').trim())throw new Error(`translation_ru missing for ${id}`);if(!String(row?.word_alan_cyrillic||row?.word_alan_turkic||'').trim())throw new Error(`Alan word missing for ${id}`);}
const orders=words.map((row)=>Number(row.global_order||0)).filter(Number.isFinite);if(orders.length!==words.length||Math.min(...orders)!==1||Math.max(...orders)!==words.length||new Set(orders).size!==words.length)throw new Error(`global_order is not contiguous unique 1..${words.length}`);
const next={version,source:'v_words_app+content_stories+dictionary_metadata',word_count:words.length,story_count:stories.length,words,stories},existing=await readExisting();
if(existing&&canonical(existing)===canonical(next)){console.log(`dictionary snapshot already current ${version}: ${words.length} words, ${stories.length} stories`);process.exit(0);}
const output={version,generated_at:new Date().toISOString(),...next};await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,`${JSON.stringify(output)}\n`,'utf8');console.log(`dictionary snapshot updated ${version}: ${words.length} words, ${stories.length} stories`);
