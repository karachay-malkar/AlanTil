import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const migrationDir=path.join(root,'supabase','migrations');
const migrations=()=>fs.readdirSync(migrationDir).filter((name)=>name.endsWith('.sql')).map((name)=>({name,sql:fs.readFileSync(path.join(migrationDir,name),'utf8')}));

test('Part 4 server alignment migration enforces 20/15 and closes guest player snapshot RPC',()=>{
  const match=migrations().find(({sql})=>/when p_phase='bonus-question' then 15 else 20 end/.test(sql)&&/revoke all on function public\.ashyk_players_snapshot\(\) from public,\s*anon/i.test(sql));
  assert.ok(match,'expected one final server-alignment migration containing both timing and RPC hardening');
  assert.match(match.sql,/grant execute on function public\.ashyk_players_snapshot\(\) to authenticated/i);
});
