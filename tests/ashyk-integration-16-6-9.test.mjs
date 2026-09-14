import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const practice=fs.readFileSync(new URL('../src/features/practice/index.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../src/features/practice/practice.css',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../supabase/migrations/20260914_ashyk_online_rooms.sql',import.meta.url),'utf8');

test('web Practice exposes Ashyk as an embedded Alan Til activity',()=>{
  assert.match(practice,/data-ashyk-game/);
  assert.match(practice,/Ашыкъ оюн/);
  assert.match(practice,/3d-5lcon9\.v2\.appdeploy\.ai/);
  assert.match(practice,/subscribeToAuth/);
  assert.match(practice,/ashyk-auth-request/);
  assert.match(practice,/alantil-auth/);
  assert.match(css,/\.ashykGameOverlay/);
  assert.match(css,/\.ashykGameHeader/);
});

test('online room migration enforces member read and active-turn writes',()=>{
  assert.match(migration,/alter table public\.ashyk_rooms enable row level security/i);
  assert.match(migration,/grant select on public\.ashyk_rooms to authenticated/i);
  assert.match(migration,/auth\.uid\(\).*host_user_id/s);
  assert.match(migration,/uid <> room\.active_user_id/i);
  assert.match(migration,/room\.revision <> expected_revision/i);
  assert.match(migration,/alter publication supabase_realtime add table public\.ashyk_rooms/i);
});
