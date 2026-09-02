import fs from 'node:fs';

const read=(path)=>fs.readFileSync(path,'utf8');
const registry=JSON.parse(read('docs/WEB_ORIGIN_16_4.json'));
const mobileReimplementations=(registry.entries||[]).filter((entry)=>entry.status==='MOBILE_REIMPLEMENTATION');
const undocumentedPlatform=(registry.entries||[]).filter((entry)=>entry.status==='PLATFORM_ONLY'&&!String(entry.reason||'').trim());
const failures=[];
if(mobileReimplementations.length)failures.push(...mobileReimplementations.map((entry)=>`MOBILE_REIMPLEMENTATION: ${entry.function}`));
if(undocumentedPlatform.length)failures.push(...undocumentedPlatform.map((entry)=>`PLATFORM_ONLY missing reason: ${entry.function}`));

const checks=[
  ['mobile/screens/practice-games.js',/function\s+(?:scopeKey|buildScope|testSnapshot|restoreTestSnapshot|matchSnapshot|restoreMatchSnapshot)\s*\(/,'local Practice/Test/Match portable duplicate'],
  ['src/features/test/view.js',/function\s+(?:scopeKey|buildScope|dictionaryId|sectionId)\s*\(/,'Web Test local practice scope duplicate'],
  ['src/features/match/view.js',/function\s+(?:scopeKey|buildScope|dictionaryId|sectionId)\s*\(/,'Web Match local practice scope duplicate'],
  ['mobile/platform/profile-api.js',/\[['"]male['"],['"]female['"]\]\.includes/,'local avatar gender normalization duplicate'],
];
for(const [path,pattern,label] of checks){const source=read(path);if(pattern.test(source))failures.push(`${label}: ${path}`);}

for(const path of ['mobile/screens/practice-games.js','mobile/screens/station.js','packages/alantil-core/station-test.js','src/features/test/view.js']){
  const source=read(path);
  if(/>=\s*100[\s\S]{0,100}>=\s*90[\s\S]{0,100}>=\s*80/.test(source))failures.push(`local mastery threshold duplicate: ${path}`);
}

const requiredShared=[
  ['packages/alantil-core/practice-scope.js','buildPracticeScope'],
  ['packages/alantil-core/test.js','restoreTestStateSnapshot'],
  ['packages/alantil-core/match.js','restoreMatchStateSnapshot'],
  ['packages/alantil-core/mastery.js','masteryLevelForPercent'],
  ['packages/alantil-core/profile.js','normalizeAvatarGender'],
];
for(const [path,token] of requiredShared)if(!read(path).includes(token))failures.push(`missing shared source ${token}: ${path}`);

console.log(`MOBILE_REIMPLEMENTATION=${mobileReimplementations.length}`);
console.log(`KNOWN_PORTABLE_DUPLICATES=${failures.length}`);
if(failures.length){for(const failure of failures)console.error(failure);process.exit(1);}
