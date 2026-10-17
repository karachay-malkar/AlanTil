import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('tower UI uses Lucide and single confirmed full-clear action',()=>{
 const s=file('src/features/tower/index.js');
 assert.match(s,/uiIcon\(TOWER_ICONS\[name\]\)/);
 assert.match(s,/data-clear/);
 assert.match(s,/context\.modal\.confirm/);
 assert.match(s,/clearTowerAll\(\{revision:s\.revision,legacyRevision:s\.legacyRevision/);
 for(const c of ['✓','×','⟳','◇','⌫','⚒','⌂','◈'])
  assert.equal(s.includes(c),false,'obsolete text icon: '+c);
});
test('successful placements remain in placing mode and recover after uncertain errors',()=>{
 const s=file('src/features/tower/index.js');
 assert.match(s,/mode\(action==='place'\?'placing':'idle'\)/);
 assert.match(s,/s\.previewHit=s\.scene\.getAimHit\?\.\(\)\|\|null/);
 assert.match(s,/if\(s\.busy\)return;\s*\+\+previewSequence/);
 assert.match(s,/try\{await refreshServer\(\);\}catch/);
 assert.match(s,/if\(s\.resetAt\)\{try\{localStorage\.removeItem\(key\)/);
});
test('atomic SQL reset is owner-only, revision-bound and wallet-preserving',()=>{
 const sql=file('supabase/migrations/20261017080000_tower_clear_all_1756.sql');
 assert.match(sql,/uid uuid:=auth\.uid\(\)/);
 assert.match(sql,/legacy_rev<>p_legacy_revision OR v3_rev<>p_v3_revision/);
 for(const t of ['tower_accounts','tower_v2_elements','tower_v3_sections','tower_clear_receipts'])
  assert.ok(sql.includes(t));
 assert.match(sql,/receipt\.request<>req/);
 assert.doesNotMatch(sql,/SET silver\s*=|SET gold\s*=/i);
 assert.match(sql,/reset_at=clock_timestamp\(\)/);
 assert.match(sql,/REVOKE ALL ON FUNCTION private\.clear_tower_all/);
});
