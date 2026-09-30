import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const bootstrap=await readFile(path.join(projectRoot,'src/app/bootstrap.js'),'utf8');
const webSnapshot=JSON.parse(await readFile(path.join(projectRoot,'src/data/dictionary-snapshot.json'),'utf8'));
const mobileSnapshot=JSON.parse(await readFile(path.join(projectRoot,'mobile/data/dictionary-snapshot.json'),'utf8'));

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
