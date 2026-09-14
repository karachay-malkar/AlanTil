import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

const practice=fs.readFileSync(new URL('../src/features/practice/index.js',import.meta.url),'utf8');
const gamePath=new URL('../assets/ashyk-game/index.html',import.meta.url);
const mobileGamePath=new URL('../mobile/assets/ashyk-game/index.html',import.meta.url);
const migration=fs.readFileSync(new URL('../supabase/migrations/20260914_ashyk_online_rooms.sql',import.meta.url),'utf8');
const hash=(bytes)=>crypto.createHash('sha256').update(bytes).digest('hex');

test('web Practice opens the repository-owned Ashyk bundle',()=>{
  assert.match(practice,/data-ashyk-game/);
  assert.match(practice,/Ашыкъ оюн/);
  assert.match(practice,/\/assets\/ashyk-game\/index\.html/);
  assert.doesNotMatch(practice,/appdeploy\.ai/i);
  assert.match(practice,/subscribeToAuth/);
  assert.match(practice,/ashyk-auth-request/);
  assert.match(practice,/alantil-auth/);
  const embedded=fs.readFileSync(gamePath);
  assert.ok(embedded.length>100000,'embedded game must be a real self-contained build');
  assert.doesNotMatch(embedded.toString('utf8'),/3d-5lcon9\.v2\.appdeploy\.ai/i);
  assert.equal(hash(embedded),hash(fs.readFileSync(mobileGamePath)),'web and mobile must ship the identical game engine');
});

test('online room migration keeps member-only realtime state and active-turn writes',()=>{
  assert.match(migration,/alter table public\.ashyk_rooms enable row level security/i);
  assert.match(migration,/grant select on public\.ashyk_rooms to authenticated/i);
  assert.match(migration,/auth\.uid\(\).*host_user_id/s);
  assert.match(migration,/uid <> room\.active_user_id/i);
  assert.match(migration,/room\.revision <> expected_revision/i);
  assert.match(migration,/alter publication supabase_realtime add table public\.ashyk_rooms/i);
});
