/** Smoke checks independent of application bootstrap; run: node --test scripts/qa/manual-masonry.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=(path)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const withoutImports=s=>s.replace(/^import[\s\S]*?;\s*$/gm,'').replace(/\bexport (?=(?:async )?(?:function|const|let|class))/g,'');

test('Common 100 source has exactly 100 known authored models',()=>{
 const m=JSON.parse(source('assets/tower/approved-library/common100/common-100.json'));
 assert.equal(m.count,100);assert.equal(m.models.length,100);
 assert.deepEqual(m.counts,{main:72,large:10,chinking:12,lintel:6});
 assert.equal(new Set(m.models.map(x=>x.name)).size,100);
});

test('Manual authoring format preserves free coordinates and precise quaternion',()=>{
 const lib=withoutImports(source('src/features/masonry/library.js'));
 const {makeRecipe,validateRecipe}=new Function(lib+'\nreturn {makeRecipe,validateRecipe};')();
 const manifest=JSON.parse(source('assets/tower/approved-library/common100/common-100.json'));
 const section=makeRecipe([3,3,3]);
 section.libraryVersion=manifest.version;section.librarySha256=manifest.glbSHA256;
 section.stones.push({id:'unique-stone',name:manifest.models[0].name,
  position:[-1.67,3.141592,99.999999],quaternion:[0,0.38268343,0,0.92387953],scale:[1,1.25,.75]});
 assert.equal(validateRecipe(section,manifest),section);
 assert.equal(section.stones[0].position[0],-1.67);
 section.stones.push({...section.stones[0]});
 assert.throws(()=>validateRecipe(section,manifest),/ID/);
 section.stones.pop();section.stones[0].name='FAKE_ROCK';
 assert.throws(()=>validateRecipe(section,manifest),/модель/);
});

test('All proposed cube sizes map to 25-cm cells',()=>{
 const {makeRecipe}=new Function(withoutImports(source('src/features/masonry/library.js'))+'\nreturn {makeRecipe};')();
 for(const cells of [[1,1,1],[2,2,2],[2,2,3],[2,3,4],[3,3,3],[4,4,4],[10,2,3]]){
  const r=makeRecipe(cells);assert.deepEqual(r.cells,cells);assert.equal(r.cellMeters,.25);
 }
});

test('Router recognizes the new guarded practice route and preserves tower paths',()=>{
 const s=withoutImports(source('src/app/router.js'));
 const o=new Function('msg','setAnalyticsContext','trackEvent','trackPageView','EVENTS','initializeAuth',
  'hasActivityAccess','whenActivityAccessReady','screenStyleDependencies',s+'\nreturn {parsePathname,buildPath};')
  (()=>'',()=>{},()=>{},()=>{},{},()=>{},()=>false,()=>Promise.resolve(),()=>[]);
 assert.equal(o.parsePathname('/practice/masonry').route,'practice.masonry');
 assert.equal(o.buildPath('practice.masonry'),'/practice/masonry');
 assert.equal(o.parsePathname('/practice/tower').route,'practice.tower');
 assert.equal(o.buildPath('practice.tower'),'/practice/tower');
 assert.equal(o.parsePathname('/learn/favorites').route,'learn.set');
 assert.match(s,/manualMasonry && !target\.route\.startsWith/);
});

test('Database restricts authoring to logged-in admin and separates game state',()=>{
 const sql=source('supabase/migrations/20261018150000_masonry_editor_common100.sql');
 assert.match(sql,/alter table public\.masonry_editor_sections enable row level security/);
 assert.match(sql,/p\.activity_access is true/g);
 assert.match(sql,/user_id=auth\.uid\(\)/g);
 assert.match(sql,/status in \('draft','ready'\)/);
 assert.doesNotMatch(sql,/\bdrop table\b/i);
 assert.doesNotMatch(sql,/\b(?:update|delete from|alter table)\s+public\.tower/i);
});
