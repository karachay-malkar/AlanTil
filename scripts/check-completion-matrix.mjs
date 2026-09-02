import fs from 'node:fs';
const matrix=JSON.parse(fs.readFileSync('docs/COMPLETION_MATRIX.json','utf8'));
const allowed=new Set(['PASS','FAIL','BLOCKED']);
const result=[];
for(const direction of matrix.directions||[]){const criteria=direction.criteria||[];if(!criteria.length)throw new Error(`Direction ${direction.id} has no criteria`);const ids=new Set();for(const item of criteria){if(!item.id||ids.has(item.id))throw new Error(`Duplicate/missing criterion in direction ${direction.id}`);ids.add(item.id);if(!allowed.has(item.status))throw new Error(`Invalid status ${item.status}`);}const pass=criteria.filter((x)=>x.status==='PASS').length,fail=criteria.filter((x)=>x.status==='FAIL').length,blocked=criteria.filter((x)=>x.status==='BLOCKED').length,percent=Number(((pass/criteria.length)*100).toFixed(1));result.push({id:direction.id,name:direction.name,pass,total:criteria.length,fail,blocked,percent});}
if(result.length!==10)throw new Error(`Expected 10 directions, got ${result.length}`);
console.table(result);
const foundation=result.filter((x)=>x.id<=4);const gate=foundation.every((x)=>x.fail===0&&x.blocked===0);console.log(`FOUNDATION_GATE=${gate?'PASS':'NOT_COMPLETE'}`);
fs.writeFileSync('docs/COMPLETION_STATUS.json',JSON.stringify({generated_at:new Date().toISOString(),reference:matrix.reference,directions:result,foundation_gate:gate?'PASS':'NOT_COMPLETE'},null,2)+'\n');
