import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const bootstrap=await readFile(path.join(projectRoot,'src/app/bootstrap.js'),'utf8');
const webSnapshot=JSON.parse(await readFile(path.join(projectRoot,'src/data/dictionary-snapshot.json'),'utf8'));
const mobileSnapshot=JSON.parse(await readFile(path.join(projectRoot,'mobile/data/dictionary-snapshot.json'),'utf8'));
const starterDictionarySource=await readFile(path.join(projectRoot,'src/data/starter-dictionary.js'),'utf8');
const guideSource=await readFile(path.join(projectRoot,'src/features/onboarding/guide.js'),'utf8');

function snapshotWords(snapshot){return Array.isArray(snapshot?.words)?snapshot.words:[];}
function hiddenAdvancedWords(snapshot){
  return snapshotWords(snapshot).filter((word)=>String(word?.story_id||'')==='ascent'||String(word?.dictionary_id||'')==='advanced');
}

test('dictionary update refreshes an already-open Path screen',()=>{
  assert.doesNotMatch(
    bootstrap,
    /if\s*\(route\s*===\s*["']path\.home["']\)\s*return\s*;/,
    'path.home must rebuild after alantil:dictionary-updated',
  );
});

test('bundled Web dictionary does not ship hidden Advanced content',()=>{
  assert.equal(hiddenAdvancedWords(webSnapshot).length,0);
});

test('bundled Mobile dictionary does not ship hidden Advanced content',()=>{
  assert.equal(hiddenAdvancedWords(mobileSnapshot).length,0);
});

test('emergency starter does not expose hidden Advanced content',()=>{
  assert.doesNotMatch(starterDictionarySource,/Восхождение|advanced|ascent/);
});

test('guided help derives story steps from currently rendered Path stories',()=>{
  assert.match(guideSource,/function\s+availableStorySequence\s*\(/);
  assert.match(guideSource,/querySelectorAll\(\["']?\[data-story-tab\]/);
  assert.doesNotMatch(guideSource,/const\s+STORY_SEQUENCE\s*=\s*\[/);
});
