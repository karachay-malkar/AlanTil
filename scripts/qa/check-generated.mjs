import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT, tempDir} from './lib.mjs';

async function verifyAshykRuntime() {
  const {buildAshykRuntime} = await import(pathToFileURL(path.join(ROOT, 'tools/ashyk-web/build.mjs')).href);
  const dir = tempDir('alantil-ashyk-');
  const out = path.join(dir, 'runtime.js');
  await buildAshykRuntime(out);
  const committed = path.join(ROOT, 'src/features/ashyk/runtime.js');
  if (!fs.existsSync(committed) || !fs.readFileSync(out).equals(fs.readFileSync(committed))) {
    throw new Error('Generated Ashyk runtime is stale. Run node tools/ashyk-web/build.mjs and commit src/features/ashyk/runtime.js.');
  }
  const source = fs.readFileSync(committed, 'utf8');
  const required = [
    'ashyk_invite_create','ashyk_invite_accept','ashyk_room_ready','ashyk_room_ping',
    'ashyk_active_room','ashyk_submit_action','ashyk_resolve_timeout','ashyk_claim_forfeit',
    'ashyk-shot:','openVisualStream','beginRemotePlayback','question-select','realtime',
    'walnut_veneer_02_diff_1k.jpg','walnut_veneer_02_nor_gl_1k.jpg',
  ];
  for (const token of required) if (!source.includes(token)) throw new Error(`Generated Ashyk runtime is missing ${token}`);
  for (const forbidden of ['launchRemote', 'ashyk_join_room']) if (source.includes(forbidden)) throw new Error(`Generated Ashyk runtime still contains legacy token ${forbidden}`);
  for (const asset of ['walnut_veneer_02_diff_1k.jpg','walnut_veneer_02_nor_gl_1k.jpg','walnut_veneer_02_rough_1k.jpg','walnut_veneer_02_ao_1k.jpg']) {
    const file = path.join(ROOT, 'assets/ashyk/materials/walnut-veneer-02', asset);
    if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Missing Ashyk PBR asset ${asset}`);
  }
}

try {
  if (!process.argv.includes('--ashyk')) throw new Error('No generated runtime target selected.');
  await verifyAshykRuntime();
  console.log('Generated Ashyk runtime verified without modifying the worktree.');
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
