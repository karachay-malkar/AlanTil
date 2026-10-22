import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root = new URL('../../', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const write = (path, value) => writeFile(new URL(path, root), value, 'utf8');
const config = JSON.parse(await read('release.json'));
const {branch, version, released_at: date, android_version_code: versionCode} = config;
if (!/^\d+\.\d+$/.test(branch) || !/^\d+\.\d+\.\d+$/.test(version)
  || !version.startsWith(branch + '.') || !/^\d{4}-\d\d-\d\d$/.test(date)
  || !Number.isInteger(versionCode) || versionCode < 1) {
  throw new Error('Invalid branch-version mapping in release.json');
}
const declaredBranch = process.env.GITHUB_REF_NAME || '';
let actualBranch = declaredBranch;
if (!actualBranch) {
  try { actualBranch = execFileSync('git', ['branch', '--show-current'], {cwd: root, encoding:'utf8'}).trim(); }
  catch {}
}
if (actualBranch && actualBranch !== branch) throw new Error('Release branch mismatch: '+actualBranch+' !== '+branch);
function replaceOne(source, regex, replacement, path) {
  const matches = source.match(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')) || [];
  if(matches.length !== 1) throw new Error('Expected exactly one match for '+regex+' in '+path+', got '+matches.length);
  return source.replace(regex,replacement);
}
const target = {};
async function set(path, transform) { target[path] = transform(await read(path)); }
await set('index.html',original=>{
  let s=original;
  for(const [name,value] of [['alantil-app-version',version],['alantil-build',version],['alantil-pages-branch',branch]]) {
    s=replaceOne(s,new RegExp('(<meta name="'+name+'" content=")[^"]+'),'$1'+value,'index.html');
  }
  s=replaceOne(s,/(const targetVersion = ")[^"]+/,'$1'+version,'index.html');
  s=replaceOne(s,/(href="\/src\/shared\/styles\/app\.css\?v=)[^"]+/,'$1'+version,'index.html');
  s=replaceOne(s,/(src="\/src\/app\/bootstrap\.js\?v=)[^"]+/,'$1'+version,'index.html');
  s=replaceOne(s,/const versions = (\[[^\n;]*\]);/,(whole,arraySource)=>{
    const versions=JSON.parse(arraySource);
    if(versions.includes(version)) return whole;
    return 'const versions = '+arraySource.slice(0,-1)+',"'+version+'"];';
  },'index.html');
  return s;
});
await set('packages/alantil-core/release.js',()=>[
  'export const APP_VERSION = "'+version+'";',
  'export const RELEASE_DATE = "'+date+'";',
  'export const WEB_BUILD_VERSION = "'+version+'";',
  'export const WEB_DEPLOY_REPOSITORY = "karachay-malkar/AlanTil";',
  'export const WEB_DEPLOY_BRANCH = "'+branch+'";',''
].join('\n'));
await set('src/app/bootstrap.js',original=>{
  let s=replaceOne(original,/(const ASSET_VERSION = ")[^"]+/,'$1'+version,'src/app/bootstrap.js');
  s=replaceOne(s,/(alantil-core\/release\.js\?v=)[0-9.]+/,'$1'+version,'src/app/bootstrap.js');
  return replaceOne(s,/(from "\.\/router\.js\?v=)[0-9.]+/,'$1'+version,'src/app/bootstrap.js');
});
await set('src/app/router.js',s=>replaceOne(s,/(const ASSET_VERSION = ")[^"]+/,'$1'+version,'src/app/router.js'));
await set('service-worker.js',original=>{
  let s=replaceOne(original,/(const VERSION = ")[^"]+/,'$1'+version,'service-worker.js');
  for(const path of ['/src/app/bootstrap.js','/src/app/router.js','/src/shared/styles/app.css','/src/features/path/feature.js','/src/data/path-set-metadata.js','/src/features/path/story-stele.js']){
    const pattern=new RegExp('("'+path.replaceAll('.','\\.').replaceAll('/','\\/')+'\\?v=)[^"]+');
    s=replaceOne(s,pattern,'$1'+version,'service-worker.js');
  }
  return s;
});
for(const p of ['src/config/analytics.js','src/features/settings/version.js']){
 await set(p,s=>replaceOne(s,/(alantil-core\/release\.js\?v=)[0-9.]+/,'$1'+version,p));
}
await set('src/features/path/feature.js',source=>{
  let s=replaceOne(source,/(path-route-index\.json\.gz\?v=)[0-9.]+/,'$1'+version,'src/features/path/feature.js');
  s=replaceOne(s,/(path-route-index\.json\?v=)[0-9.]+/,'$1'+version,'src/features/path/feature.js');
  s=replaceOne(s,/(story-stele\.js\?v=)[0-9.]+/,'$1'+version,'src/features/path/feature.js');
  s=replaceOne(s,/(path-set-metadata\.js\?v=)[0-9.]+/,'$1'+version,'src/features/path/feature.js');
  return s;
});
await set('src/features/path/story-stele.js',s=>{
  s=replaceOne(s,/(story-stele-640\.webp\?v=)[0-9.]+/,'$1'+version,'src/features/path/story-stele.js');
  s=replaceOne(s,/(story-stele-932\.webp\?v=)[0-9.]+/,'$1'+version,'src/features/path/story-stele.js');
  return s;
});
await set('mobile/app.json',s=>{
 const app=JSON.parse(s);
 app.expo.version=version; app.expo.android.versionCode=versionCode;
 app.expo.ios.buildNumber=String(versionCode); app.expo.extra.releaseVersion=version;
 return JSON.stringify(app,null,2)+'\n';
});
await set('mobile/package.json',s=>{
 const pkg=JSON.parse(s); pkg.version=version;
 return JSON.stringify(pkg,null,2)+'\n';
});
let drift=0;
for(const [path,expected] of Object.entries(target)){
 const current=await read(path);
 if(current===expected)continue;
 if(process.argv.includes('--check')){console.error('Release mismatch: '+path);drift++;}
 else{await write(path,expected);console.log('Synchronized '+path);}
}
if(drift)process.exitCode=1;
else console.log('AlanTil '+version+' branch '+branch+' — '+(process.argv.includes('--check')?'verified':'synchronized'));
