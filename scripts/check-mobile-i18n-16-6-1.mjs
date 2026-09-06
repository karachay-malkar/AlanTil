import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const targets=['mobile/AppRoot.js','mobile/screens','mobile/ui'];
const excluded=new Set([
  'mobile/i18n.js',
]);
const allowedFragments=[
  'Alan Til','Latin','Җ','Дж','Ж','РУС → АЛАН','АЛАН → РУС','алан → рус','рус → алан',
  // Canonical Web 13.15.12 onboarding heading is intentionally multilingual and fixed.
  'Язык · Language · Dil',
  // Dataset classification fragments are not user-visible UI copy. They are used only to preserve
  // the Web rule that generic difficulty dictionaries do not render station captions.
  'началь','средн','сложн',
];
const cyrillic=/[А-Яа-яЁёҢңҒғҚқӨөҮүҖҗ]/u;
const files=[];
function walk(relative){
  const absolute=path.join(root,relative);
  if(!fs.existsSync(absolute))return;
  const stat=fs.statSync(absolute);
  if(stat.isFile()){if(/\.jsx?$/u.test(relative)&&!excluded.has(relative))files.push(relative);return;}
  for(const name of fs.readdirSync(absolute))walk(path.join(relative,name));
}
for(const target of targets)walk(target);
const violations=[];
for(const file of files){
  const lines=fs.readFileSync(path.join(root,file),'utf8').split(/\r?\n/u);
  lines.forEach((line,index)=>{
    if(!cyrillic.test(line))return;
    const stripped=allowedFragments.reduce((value,fragment)=>value.split(fragment).join(''),line);
    if(cyrillic.test(stripped))violations.push(`${file}:${index+1}: ${line.trim()}`);
  });
}
if(violations.length){
  console.error(`MOBILE_I18N_HARDCODED=${violations.length}`);
  console.error(violations.join('\n'));
  process.exit(1);
}
console.log('MOBILE_I18N_HARDCODED=0');