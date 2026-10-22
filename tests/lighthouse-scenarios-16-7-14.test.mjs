import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
test('returning guest fixture is confined to localhost QA and seeds scoped settings before app scripts',async()=>{
 const server=await read('scripts/static-preview-server.mjs');
 assert.match(server,/process\.env\.ALANTIL_PERF_QA === '1'/);
 assert.match(server,/requestUrl\.searchParams\.get\('__qa'\) === 'returning'/);
 assert.match(server,/alantil_scope_v1:guest:alantil_user_settings_v1/);
 assert.match(server,/learning_setup_completed_at/);
 assert.match(server,/\.replace\('<head>', '<head>'\+returningGuestScript\)/);
});
test('Lighthouse distinguishes onboarding, actual returning feature routes, and warm repeat',async()=>{
 const workflow=await read('.github/workflows/performance-qa.yml');
 const report=await read('scripts/report-lighthouse.mjs');
 assert.match(workflow,/ALANTIL_PERF_QA=1 node scripts\/static-preview-server\.mjs/);
 assert.match(workflow,/guest-onboarding\.report\.json/);
 assert.match(workflow,/returning-path-oblivion-cold\.report\.json/);
 assert.match(workflow,/returning-path-oblivion-warm\.report\.json/);
 assert.match(workflow,/--disable-storage-reset/);
 for(const part of ['practice','profile','friends'])assert.match(workflow,new RegExp('for page in practice profile friends'));
 assert.match(report,/routeMismatch/);
 assert.match(report,/expected asset/);
});
