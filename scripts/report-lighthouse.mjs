import {readFile,writeFile,mkdir} from 'node:fs/promises';

const scenarios=[
  {file:'guest-onboarding',label:'New guest — onboarding',expect:'features/onboarding/index.js'},
  {file:'returning-path-oblivion-cold',label:'Returning — Path, cold',expect:'styles/feature/path.css'},
  {file:'returning-practice-cold',label:'Returning — Practice, cold',expect:'styles/feature/practice.css'},
  {file:'returning-profile-cold',label:'Returning — Profile, cold',expect:'styles/feature/profile.css'},
  {file:'returning-friends-cold',label:'Returning — Friends, cold',expect:'styles/feature/friends.css'},
  {file:'returning-path-oblivion-warm',label:'Returning — Path, warm',expect:'styles/feature/path.css'},
];
const fmtMs=value=>Number.isFinite(value)?(value/1000).toFixed(2)+' s':'—';
const fmtKb=value=>Number.isFinite(value)?(value/1024).toFixed(0)+' KB':'—';
const rows=[],details=[];
let missing=0,routeMismatch=0,httpErrors=0;
for(const scenario of scenarios){
 let lhr;
 try{lhr=JSON.parse(await readFile('perf-results/'+scenario.file+'.report.json','utf8'));}
 catch(error){
  missing++;
  rows.push('| '+scenario.label+' | FAILED | — | — | — | — | — | — | — |');
  details.push('- '+scenario.file+': report missing: '+error.message);
  continue;
 }
 const requests=lhr.audits?.['network-requests']?.details?.items||[];
 const transfer=requests.reduce((total,item)=>total+(Number(item.transferSize)||0),0);
 const failed=requests.filter(item=>Number(item.statusCode)>=400);
 const errors=lhr.audits?.['errors-in-console']?.details?.items||[];
 httpErrors+=failed.length+errors.length;
 const observed=requests.some(item=>String(item.url||'').includes(scenario.expect));
 if(!observed){
  routeMismatch++;
  details.push('- '+scenario.file+': expected asset '+scenario.expect+' NOT found; route may not have mounted');
 }
 const score=lhr.categories?.performance?.score;
 const metrics=[
  fmtMs(lhr.audits?.['first-contentful-paint']?.numericValue),
  fmtMs(lhr.audits?.['largest-contentful-paint']?.numericValue),
  fmtMs(lhr.audits?.['total-blocking-time']?.numericValue),
  Number(lhr.audits?.['cumulative-layout-shift']?.numericValue??0).toFixed(3),
 ];
 rows.push('| '+scenario.label+' | '+(score==null?'—':Math.round(score*100))+' | '+metrics.join(' | ')+' | '+requests.length+' | '+fmtKb(transfer)+' | '+(failed.length+errors.length)+' |');
 if(failed.length)details.push('- '+scenario.file+': HTTP >=400: '+failed.map(item=>item.statusCode+' '+item.url).join('; '));
 if(errors.length)details.push('- '+scenario.file+': console errors: '+errors.length);
 if(lhr.runtimeError)details.push('- '+scenario.file+': Lighthouse error '+lhr.runtimeError.message);
}
const report=[
 '# AlanTil 16.7.14 — mobile Lighthouse scenarios',
 '',
 'Chrome/Lighthouse on localhost with mobile emulation. These are laboratory measurements, not production-origin timings.',
 'New guest is measured separately from returning guest with scoped setup-completed data.',
 'Cold = fresh browser cache (or cleared cache for the reused Chrome instance). Warm = repeat visit in the same Chrome instance with storage reset disabled.',
 'INP requires real user data; TBT is a lab metric and not INP.',
 '',
 '| Scenario | Score /100 | FCP | LCP | TBT | CLS | Requests | Transfer | Errors |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
 ...rows,'','## Diagnostics','',...(details.length?details:['- No HTTP errors or route mismatches detected.']),'',
].join('\n');
await mkdir('perf-results',{recursive:true});
await writeFile('perf-results/SUMMARY.md',report,'utf8');
console.log(report);
if(missing||routeMismatch||httpErrors)process.exitCode=1;
