import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseCsvRows,normalizeGoogleSheetCsvUrl} from '../../packages/alantil-core/csv.js';
import {normalizeSongCollection} from '../../packages/alantil-core/song-catalog.js';
const source=readFileSync(new URL('../platform/songs.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
const old=[{id:'old',title:'Old'}],csv='id,title,info\nnew,New,About song';
function harness(value,{fail=false,body=csv,writeFail=false}={}){
 let stored=value===undefined?null:JSON.stringify(value),calls=0;
 const context=vm.createContext({parseCsvRows,normalizeGoogleSheetCsvUrl,normalizeSongCollection,AbortController,setTimeout,clearTimeout,Date,
 AsyncStorage:{getItem:async()=>stored,setItem:async(k,v)=>{if(writeFail)throw Error('disk');stored=v;}},
 fetch:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,text:async()=>body};}});
 vm.runInContext(source,context);return {load:context.loadNativeSongs,get calls(){return calls;},get stored(){return JSON.parse(stored);}};
}
test('fresh timestamped catalog avoids network',async()=>{const h=harness({songs:old,fetchedAt:Date.now()});assert.equal((await h.load())[0].id,'old');assert.equal(h.calls,0);});
test('legacy catalog renders immediately and is refreshed',async()=>{const h=harness(old),shown=[];const rows=await h.load({onCached:rows=>shown.push(rows[0].id)});assert.deepEqual(shown,['old']);assert.equal(rows[0].id,'new');assert.equal(h.stored.songs[0].info,'About song');assert.ok(h.stored.fetchedAt>0);});
test('expired cache survives offline and reports warning',async()=>{const h=harness({songs:old,fetchedAt:1},{fail:true});let warnings=0;assert.equal((await h.load({onWarning:()=>warnings++}))[0].id,'old');assert.equal(warnings,1);assert.equal(h.stored.fetchedAt,1);});
test('no-cache network failure is not an empty catalog',async()=>{await assert.rejects(harness(undefined,{fail:true}).load(),/offline/);});
test('invalid HTML cannot replace cached catalog',async()=>{const h=harness(old,{body:'<html>Denied</html>'});let warning=false;const rows=await h.load({onWarning:()=>warning=true});assert.equal(rows[0].id,'old');assert.equal(warning,true);assert.ok(Array.isArray(h.stored));});
test('valid empty catalog replaces obsolete entries and is cached',async()=>{const h=harness(old,{body:'id,title\n'});assert.equal((await h.load()).length,0);assert.equal(h.stored.songs.length,0);await h.load();assert.equal(h.calls,1);});
test('force refresh bypasses fresh cache',async()=>{const h=harness({songs:old,fetchedAt:Date.now()});assert.equal((await h.load({force:true}))[0].id,'new');assert.equal(h.calls,1);});
test('concurrent readers share one refresh request',async()=>{const h=harness();const [a,b]=await Promise.all([h.load(),h.load()]);assert.equal(h.calls,1);assert.equal(a[0].id,b[0].id);});
test('disk write failure does not hide downloaded songs',async()=>{assert.equal((await harness(undefined,{writeFail:true}).load())[0].id,'new');});
