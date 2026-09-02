import fs from 'node:fs';
const matrix=JSON.parse(fs.readFileSync(new URL('../docs/VISUAL_PARITY_16_6.json',import.meta.url),'utf8'));
const screens=matrix.screens||[];
const required=['path','station','learn','stage-test','practice','test','match','favorites','songs','profile','statistics','settings','account','onboarding'];
const ids=new Set(screens.map((row)=>row.id));
const missing=required.filter((id)=>!ids.has(id));
const fail=screens.filter((row)=>row.status!=='PASS');
if(missing.length||fail.length){console.error(`VISUAL_PARITY_16_6=FAIL missing=${missing.join(',')} fail=${fail.map((row)=>row.id).join(',')}`);process.exit(1);}
console.log(`VISUAL_PARITY_16_6=PASS screens=${screens.length} device_required=${matrix.device_required?.length||0}`);
