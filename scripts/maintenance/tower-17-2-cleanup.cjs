/** One-shot approved-tower pruning on a full GitHub checkout.
 * Fails closed if active production modules still refer to obsolete assets.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const abs=p=>path.join(root,p);
const exists=p=>fs.existsSync(abs(p));
const read=p=>fs.readFileSync(abs(p),'utf8');
const removed=[];
function rm(p){if(exists(p)){fs.rmSync(abs(p),{recursive:true,force:true});removed.push(p);}}
function walk(dir){
 if(!exists(dir))return [];
 return fs.readdirSync(abs(dir),{withFileTypes:true}).flatMap(d=>{
  const p=dir+'/'+d.name;return d.isDirectory()?walk(p):[p];
 });
}
const approved='assets/tower/approved-library';
assert(exists(approved+'/index.json'),'Never remove or run without approved library');
const registry=JSON.parse(read(approved+'/index.json'));
assert.equal(registry.sections.length,10);
const approvedFiles=[approved+'/common100/common-100.glb',approved+'/common100/common-100.json',
 ...registry.sections.map(s=>approved+'/sections/'+s.file)];
for(const a of Object.values(registry.architecture)){
 for(const asset of [a.glb,a.stone,a.wood,...Object.values(a.joints||{})]){
  if(asset)approvedFiles.push(asset.replace(/^\//,''));
 }
}
for(const p of approvedFiles)assert(exists(p),'Required approved asset missing: '+p);
const keptTower=new Set(['index.js','repository.js','prefab-scene.js',
 'approved-section-scene.js','rock-surface.js','gate-surface.js']);
const keptPackage=new Set(['approved-prefab.mjs','prefab-layout.mjs','prefab-joints.mjs',
 'window-prefab.mjs','door-prefab.mjs','gate-prefab.mjs']);
const activeFiles=[
 ...walk('src/features/masonry').filter(x=>/\.(js|mjs)$/.test(x)),
 ...walk('src/features/tower').filter(x=>keptTower.has(path.basename(x))),
 ...walk('packages/tower-game').filter(x=>keptPackage.has(path.basename(x)))
];
for(const file of activeFiles){
 const s=read(file);
 if(/\/assets\/tower\/(?:prefabs|sections|modular_wooden_pier|derived\.json)/.test(s))
  throw Error('Production still uses deprecated asset: '+file);
}
const candidates=[
 ...walk('src/features/tower').filter(x=>/\.(?:js|mjs)$/.test(x)&&!keptTower.has(path.basename(x))),
 ...walk('packages/tower-game').filter(x=>/\.mjs$/.test(x)&&!keptPackage.has(path.basename(x)))
];
// Scan other production imports before removing old modules.
const external=walk('src').concat(walk('packages'))
 .filter(x=>/\.(?:js|mjs|ts|tsx)$/.test(x)&&!candidates.includes(x));
for(const file of candidates){
 const name=path.basename(file);
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const ownDir=path.dirname(file);
 const localRe=new RegExp("['\\\"](?:\\./|\\.\\./)*"+escaped+"(?:\\?[^'\\\"]*)?['\\\"]");
 const used=external.filter(e=>{
  const src=read(e);
  return src.includes(file)|| (path.dirname(e)===ownDir&&localRe.test(src))||
   (file.startsWith('packages/tower-game/')&&src.includes('tower-game/'+name));
 });
 if(used.length)throw Error('Cannot delete referenced module '+file+' from '+used.join(','));
}
const assetRoot='assets/tower';
for(const name of fs.readdirSync(abs(assetRoot))){
 if(name==='approved-library'||name==='materials')continue;
 rm(assetRoot+'/'+name);
}
for(const name of fs.readdirSync(abs(assetRoot+'/materials'))){
 if(name!=='balkaria-stone-v2.1')rm(assetRoot+'/materials/'+name);
}
for(const file of candidates)rm(file);
rm('assets/tower/sections'); // if an old source directory survives after file pruning
rm('scripts/qa/manual-common100-sources.test.mjs');
for(const file of walk('.github/workflows')){
 const base=path.basename(file);
 if(base.startsWith('tower-')||base==='tower-common94.yml'||base==='tower-common100.yml')rm(file);
}
for(const file of removed)console.log('REMOVED',file);
console.log('APPROVED_TOWER_CLEANUP_OK',removed.length,'paths',approvedFiles.length,'required approved assets kept');
