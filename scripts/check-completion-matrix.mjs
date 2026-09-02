import fs from 'node:fs';

const matrix = JSON.parse(fs.readFileSync('docs/COMPLETION_MATRIX.json', 'utf8'));
const allowed = new Set(['PASS', 'FAIL', 'DEVICE_REQUIRED']);
const directions = [];

for (const direction of matrix.directions || []) {
  const criteria = direction.criteria || [];
  if (!criteria.length) throw new Error(`Direction ${direction.id} has no criteria`);
  const ids = new Set();
  for (const item of criteria) {
    if (!item.id || ids.has(item.id)) throw new Error(`Duplicate/missing criterion in direction ${direction.id}`);
    ids.add(item.id);
    if (!allowed.has(item.status)) throw new Error(`Invalid status ${item.status} for ${item.id}`);
    if (item.status === 'PASS' && !item.verification) throw new Error(`PASS criterion ${item.id} has no verification`);
  }
  const pass = criteria.filter((x) => x.status === 'PASS').length;
  const fail = criteria.filter((x) => x.status === 'FAIL').length;
  const deviceRequired = criteria.filter((x) => x.status === 'DEVICE_REQUIRED').length;
  const codeDenominator = pass + fail;
  const totalDenominator = pass + fail + deviceRequired;
  const codeReadiness = Number(((pass / Math.max(1, codeDenominator)) * 100).toFixed(1));
  const totalReadiness = Number(((pass / Math.max(1, totalDenominator)) * 100).toFixed(1));
  directions.push({
    id: direction.id,
    name: direction.name,
    pass,
    fail,
    device_required: deviceRequired,
    total: criteria.length,
    code_readiness: codeReadiness,
    total_readiness: totalReadiness,
  });
}

if (directions.length !== 10) throw new Error(`Expected 10 directions, got ${directions.length}`);
console.table(directions);

const foundation = directions.filter((x) => x.id <= 4);
const codeGate = foundation.every((x) => x.fail === 0);
const totalGate = foundation.every((x) => x.fail === 0 && x.device_required === 0);
const foundationPass = foundation.reduce((sum, x) => sum + x.pass, 0);
const foundationFail = foundation.reduce((sum, x) => sum + x.fail, 0);
const foundationDevice = foundation.reduce((sum, x) => sum + x.device_required, 0);
const foundationCodeReadiness = Number(((foundationPass / Math.max(1, foundationPass + foundationFail)) * 100).toFixed(1));
const foundationTotalReadiness = Number(((foundationPass / Math.max(1, foundationPass + foundationFail + foundationDevice)) * 100).toFixed(1));

console.log(`FOUNDATION_CODE_GATE=${codeGate ? 'PASS' : 'FAIL'}`);
console.log(`FOUNDATION_TOTAL_GATE=${totalGate ? 'PASS' : 'DEVICE_REQUIRED'}`);
console.log(`FOUNDATION_CODE_READINESS=${foundationCodeReadiness}%`);
console.log(`FOUNDATION_TOTAL_READINESS=${foundationTotalReadiness}%`);

const status = {
  generated_at: new Date().toISOString(),
  reference: matrix.reference,
  directions,
  foundation: {
    pass: foundationPass,
    fail: foundationFail,
    device_required: foundationDevice,
    code_readiness: foundationCodeReadiness,
    total_readiness: foundationTotalReadiness,
    code_gate: codeGate ? 'PASS' : 'FAIL',
    total_gate: totalGate ? 'PASS' : 'DEVICE_REQUIRED',
  },
};
fs.writeFileSync('docs/COMPLETION_STATUS.json', JSON.stringify(status, null, 2) + '\n');

if (!codeGate) process.exitCode = 1;
