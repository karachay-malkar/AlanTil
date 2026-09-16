import fs from 'node:fs';

const files=[
  'mobile/screens/ashyk.js',
  'packages/ashyk-game/web/Game.jsx',
];
const from=`const modes=[["computer",sm('computer')],["local",sm('local')],...(userId?[["online",sm('friend')]]:[])];`;
const to=`const modes=[["computer",sm('computer')],...(userId?[["local",sm('local')],["online",sm('friend')]]:[])];`;

for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  if(source.includes(to)) continue;
  if(!source.includes(from)) throw new Error(`Expected Ashyk modes expression not found in ${file}`);
  const next=source.replace(from,to);
  fs.writeFileSync(file,next);
  console.log(`Updated ${file}`);
}
