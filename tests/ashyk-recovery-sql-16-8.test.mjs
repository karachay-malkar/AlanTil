import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const migration=fs.readdirSync(path.join(root,'supabase/migrations')).find(p=>p.endsWith('_alantil_16_8_ashyk_connection_recovery.sql'));
const sql=()=>read('supabase/migrations/'+migration);
test('recovery migration restores complete canonical definitions in one transaction',()=>{
 const canonical=read('supabase/migrations/20260925100000_alantil_16_8_ashyk_single_room_state.sql');
 const funcs=sql().match(/create or replace function [\s\S]*?\n\$\$;/g);
 assert.equal(funcs.length,14);
 for(const fn of funcs.filter(fn=>!fn.includes('function public.ashyk_room_not_ready')))assert.ok(canonical.includes(fn),fn.split('\n')[0]);
 assert.match(sql(),/begin;/);assert.match(sql(),/commit;\s*$/);
});
test('Postgres: retry invite, repeated Ready, heartbeat, commit and single-room guards',{skip:!process.env.ASHYK_SQL_TEST_DEPS},async()=>{
 const require=createRequire(path.join(process.env.ASHYK_SQL_TEST_DEPS,'package.json'));
 const {PGlite}=require('@electric-sql/pglite');const db=new PGlite();
 const host='00000000-0000-4000-8000-000000000001',guest='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003';
 try{
 await db.exec(`create schema auth; create schema private; create role anon; create role authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key);
 create function private.social_are_friends(uuid,uuid) returns boolean language sql as $$select true$$;
 create function private.social_blocked(uuid,uuid) returns boolean language sql as $$select false$$;`);
 // Use the actual table definitions and additive columns from historical migrations.
 const tables=read('supabase/migrations/20260914_ashyk_online_rooms.sql');await db.exec(tables.slice(0,tables.indexOf('alter table')));
 await db.exec('alter table public.ashyk_rooms alter column code drop not null;');
 const invites=read('supabase/migrations/20260916170100_alantil_16_7_ashyk_invites.sql');await db.exec(invites.slice(invites.indexOf('create table'),invites.indexOf('alter table')));
 const authority=read('supabase/migrations/20260921104928_alantil_16_7_ashyk_authoritative_turns.sql');await db.exec(authority.slice(authority.indexOf('alter table'),authority.indexOf('alter table public.ashyk_action_log')));
 await db.exec(authority.match(/create or replace function private\.ashyk_clean_state[\s\S]*?\$\$;/)[0]);
 await db.exec(`alter table public.ashyk_rooms add column host_ready_at timestamptz,add column guest_ready_at timestamptz,add column host_seen_at timestamptz,add column guest_seen_at timestamptz,add column started_at timestamptz,add column ended_at timestamptz;`);
 const commit=read('supabase/migrations/20260924165000_alantil_16_8_ashyk_shot_commit.sql');await db.exec(commit.slice(commit.indexOf('alter table'),commit.indexOf('drop trigger')));
 await db.exec(sql());await db.exec(sql()); // Safe to reapply after a lost migration response.
 await db.query('insert into auth.users values ($1),($2),($3)',[host,guest,other]);
 const actor=uid=>db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);
 await actor(host);
 const create=()=>db.query('select public.ashyk_invite_create($1) as result',[guest]);
 const first=(await create()).rows[0].result,again=(await create()).rows[0].result;
 assert.equal(first.room.id,again.room.id);assert.equal(first.invite.id,again.invite.id);
 const ready=()=>db.query('select * from public.ashyk_room_ready($1)',[first.room.id]);
 assert.equal((await ready()).rows[0].status,'waiting');
 await db.query('select public.ashyk_room_not_ready($1)',[first.room.id]);
 await actor(guest);await db.query('select public.ashyk_invite_accept($1)',[first.invite.id]);
 assert.equal((await ready()).rows[0].status,'waiting');
 await actor(host);
 const playing=(await ready()).rows[0];assert.equal(playing.status,'playing');
 const repeated=(await ready()).rows[0];assert.equal(repeated.phase_seq,playing.phase_seq);assert.equal(+repeated.phase_deadline_at,+playing.phase_deadline_at);
 await actor(other);await assert.rejects(()=>ready(),/not a room member/);
 await actor(host);await assert.rejects(()=>db.query('select public.ashyk_invite_create($1)',[other]),/active game exists/);
 await db.query("update public.ashyk_rooms set host_seen_at=now()-interval '1 minute' where id=$1",[first.room.id]);
 const committed=(await db.query('select * from public.ashyk_shot_commit($1,$2,$3,$4)',[first.room.id,playing.revision,playing.phase_seq,'shot'])).rows[0];
 assert.equal(committed.shot_in_flight_id,'shot');assert.equal(committed.phase_deadline_at,null);assert.ok(Date.now()-Date.parse(committed.host_seen_at)<5000);
 await assert.rejects(()=>db.query("update public.ashyk_rooms set last_action_type='shot_result',last_action_id='wrong',phase_seq=phase_seq+1 where id=$1",[first.room.id]),/shot result does not match/);
 await actor(guest);const heartbeat=(await db.query('select * from public.ashyk_room_ping($1)',[first.room.id])).rows[0];assert.ok(Date.now()-Date.parse(heartbeat.guest_seen_at)<5000);
 }finally{await db.close();}
});
