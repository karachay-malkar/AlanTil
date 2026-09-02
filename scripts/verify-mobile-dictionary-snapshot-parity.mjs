import fs from 'node:fs/promises';
import { DICTIONARY_CONTENT_TABLE, DICTIONARY_KEY, DICTIONARY_METADATA_TABLE, DICTIONARY_PAGE_SIZE, DICTIONARY_STORIES_TABLE } from '../packages/alantil-core/dictionary-contract.js';

const SUPABASE_URL=process.env.ALANTIL_SUPABASE_URL||'https://pybrzgedqjmosbmilcea.supabase.co';
const SUPABASE_KEY=process.env.ALANTIL_SUPABASE_KEY||'sb_publishable_11TY-fBEAogA9JKnAku3vg_hjRxTa_a';
async function rest(table,params){const query=new URLSearchParams(params);const response=await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`,{headers:{apikey:SUPABASE_KEY,Accept:'application/json'}});if(!response.ok)throw new Error(`${table} parity fetch failed (${response.status}): ${await response.text()}`);return response.json();}
function stable(value){if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map((key)=>[key,stable(value[key])]));return value;}
function fingerprint(value){return JSON.stringify(stable(value));}
function assert(condition,message){if(!condition)throw new Error(message);}

const bundled=JSON.parse(await fs.readFile('mobile/data/dictionary-snapshot.json','utf8'));
const metadata=await rest(DICTIONARY_METADATA_TABLE,{select:'current_version',dictionary_key:`eq.${DICTIONARY_KEY}`,limit:'1'});
const version=String(metadata?.[0]?.current_version||'').trim();
const words=[];for(let offset=0;;offset+=DICTIONARY_PAGE_SIZE){const page=await rest(DICTIONARY_CONTENT_TABLE,{select:'*',order:'global_order.asc',offset:String(offset),limit:String(DICTIONARY_PAGE_SIZE)});words.push(...page);if(page.length<DICTIONARY_PAGE_SIZE)break;}
const stories=await rest(DICTIONARY_STORIES_TABLE,{select:'*',order:'story_order.asc'});

assert(version&&bundled.version===version,`version mismatch bundled=${bundled.version} production=${version}`);
assert(Number(bundled.word_count)===words.length,`word_count mismatch bundled=${bundled.word_count} production=${words.length}`);
assert(Number(bundled.story_count)===stories.length,`story_count mismatch bundled=${bundled.story_count} production=${stories.length}`);
const bundledIds=(bundled.words||[]).map((row)=>String(row.word_id));const productionIds=words.map((row)=>String(row.word_id));
assert(new Set(bundledIds).size===bundledIds.length,'bundled duplicate word_id');
assert(fingerprint(bundledIds)===fingerprint(productionIds),'word_id set/order mismatch');
assert(fingerprint((bundled.words||[]).map((row)=>Number(row.global_order)))===fingerprint(words.map((row)=>Number(row.global_order))),'global_order mismatch');
assert(fingerprint(bundled.words||[])===fingerprint(words),'full word rows/hierarchy/critical fields mismatch');
assert(fingerprint(bundled.stories||[])===fingerprint(stories),'stories mismatch');
console.log(`PRODUCTION_SNAPSHOT_PARITY=PASS version=${version} words=${words.length} stories=${stories.length}`);
