-- Disposable CI PostgreSQL 17 fixture only. No production customer data.
create role authenticated;
create role anon;
create schema auth;
create schema private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table private.tower_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 revision bigint not null default 0,
 silver bigint not null default 0 check(silver>=0),
 gold bigint not null default 0 check(gold>=0),
 elements jsonb not null default '[]'::jsonb,
 updated_at timestamptz not null default now()
);
create table private.tower_receipts (
 user_id uuid not null references auth.users(id),
 operation_id uuid not null,request jsonb not null,response jsonb not null,
 primary key(user_id,operation_id)
);
create function private.tower_refresh_rewards(uuid) returns void language plpgsql as $$begin return;end$$;
grant usage on schema auth,private to authenticated;
insert into auth.users(id) values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
insert into private.tower_accounts(user_id,silver,gold,elements) values
 ('00000000-0000-0000-0000-000000000001',200,10,'[["legacy-unchanged", "medium", 1,0,1,2,1,1,0,0,0,4]]'::jsonb),
 ('00000000-0000-0000-0000-000000000002',100,10,'[]'::jsonb);
