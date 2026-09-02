import fs from 'node:fs/promises';

const targets=[
  'mobile/screens/practice-games.js',
  'mobile/screens/station.js',
  'packages/alantil-core/station-test.js',
  'src/features/test/view.js',
  'src/features/match/view.js',
];
for(const path of targets){
  const before=await fs.readFile(path,'utf8');
  const seen=new Set();
  const lines=before.split('\n');
  const after=lines.filter((line)=>{
    if(!line.startsWith('import '))return true;
    if(!/packages\/alantil-core|\.\/mastery\.js/.test(line))return true;
    if(seen.has(line))return false;
    seen.add(line);return true;
  }).join('\n');
  if(after!==before){await fs.writeFile(path,after,'utf8');console.log(`${path}: cleaned`);}else console.log(`${path}: already clean`);
}
