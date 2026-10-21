import {readFile,writeFile,mkdir} from 'node:fs/promises';
const routes=['first-run','path-oblivion','practice','profile','friends'];
const fmtMs=value=>Number.isFinite(value)?(value/1000).toFixed(2)+' s':'—';
const fmtKb=value=>Number.isFinite(value)?(value/1024).toFixed(0)+' KB':'—';
const cell=value=>String(value??'—');
const rows=[];
const details=[];
let invalidRouteCount=0;
for(const route of routes){
 const path='perf-results/'+route+'.report.json';
 let lhr;
 try{lhr=JSON.parse(await readFile(path,'utf8'));}catch(error){
  rows.push('| '+route+' | FAILED | — | — | — | — | — | — | — |');
  details.push(route+': no valid Lighthouse report: '+error.message);
  continue;
 }
 const lcpNode=lhr.audits?.['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node;
 if(route!=='first-run' && String(lcpNode?.selector||'').includes('learningSetup')){
   details.push(route+': INVALID MEASUREMENT: setup shown instead of target route');
   invalidRouteCount++;
 }
 const requests=lhr.audits?.['network-requests']?.details?.items||[];
 const size=requests.reduce((sum,x)=>sum+(Number(x.transferSize)||0),0);
 const failed=requests.filter(x=>Number(x.statusCode)>=400);
 const errors=lhr.audits?.['errors-in-console']?.details?.items||[];
 const score=lhr.categories?.performance?.score;
 const metrics=[
  fmtMs(lhr.audits?.['first-contentful-paint']?.numericValue),
  fmtMs(lhr.audits?.['largest-contentful-paint']?.numericValue),
  fmtMs(lhr.audits?.['total-blocking-time']?.numericValue),
  Number(lhr.audits?.['cumulative-layout-shift']?.numericValue??0).toFixed(3),
 ];
 rows.push('| '+route+' | '+(score==null?'—':Math.round(score*100))+' | '+metrics.join(' | ')+' | '+requests.length+' | '+fmtKb(size)+' | '+(failed.length+errors.length)+' |');
 details.push(route+': HTTP >=400: '+failed.map(x=>cell(x.statusCode)+' '+cell(x.url)).join('; '));
 details.push(route+': console errors: '+errors.length);
 if(lhr.runtimeError)details.push(route+': Lighthouse error '+lhr.runtimeError.message);
}
const report=[
 '# AlanTil current-source mobile Lighthouse',
 '',
 'Measured from GitHub Actions Chrome against the current main source on localhost with Lighthouse mobile emulation. This is not a production-origin speed measurement.',
 'INP requires real user monitoring; Lighthouse TBT is only a lab proxy, not INP.',
 '',
 '| Route | Score /100 | FCP | LCP | TBT | CLS | Requests | Transfer | Errors |',
 '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
 ...rows,'','## Diagnostics','',...details.map(x=>'- '+x),'',
].join('\n');
await mkdir('perf-results',{recursive:true});
await writeFile('perf-results/SUMMARY.md',report,'utf8');
console.log(report);

if(invalidRouteCount){console.error(invalidRouteCount+' Lighthouse routes still show onboarding');process.exitCode=1;}
