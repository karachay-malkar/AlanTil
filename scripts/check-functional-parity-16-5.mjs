import fs from 'node:fs';
const matrix=JSON.parse(fs.readFileSync(new URL('../docs/COMPLETION_MATRIX.json',import.meta.url),'utf8'));
const directions=(matrix.directions||[]).filter((direction)=>direction.id>=5&&direction.id<=9);
if(directions.length!==5){console.error(`FUNCTIONAL_PARITY_GATE=FAIL directions=${directions.length}`);process.exit(1);}
let pass=0,fail=0,device=0;
for(const direction of directions){
  for(const criterion of direction.criteria||[]){
    if(!criterion.verification||/not complete|incomplete|not fully audited|not run/i.test(criterion.verification)){console.error(`FUNCTIONAL_PARITY_GATE=FAIL ${criterion.id} verification=${criterion.verification||'missing'}`);process.exit(1);}
    if(criterion.status==='PASS')pass+=1;else if(criterion.status==='FAIL')fail+=1;else if(criterion.status==='DEVICE_REQUIRED')device+=1;else{console.error(`FUNCTIONAL_PARITY_GATE=FAIL ${criterion.id} invalid-status=${criterion.status}`);process.exit(1);}
  }
}
const code=pass+fail?pass/(pass+fail)*100:0,total=pass+fail+device?pass/(pass+fail+device)*100:0;
console.log(`FUNCTIONAL_PARITY_PASS=${pass}`);
console.log(`FUNCTIONAL_PARITY_FAIL=${fail}`);
console.log(`FUNCTIONAL_PARITY_DEVICE_REQUIRED=${device}`);
console.log(`FUNCTIONAL_PARITY_CODE_READINESS=${code.toFixed(1)}%`);
console.log(`FUNCTIONAL_PARITY_TOTAL_READINESS=${total.toFixed(1)}%`);
if(fail){console.error('FUNCTIONAL_PARITY_GATE=FAIL');process.exit(1);}
console.log('FUNCTIONAL_PARITY_GATE=PASS');
