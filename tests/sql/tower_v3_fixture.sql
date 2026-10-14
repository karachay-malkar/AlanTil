\set ON_ERROR_STOP on
create schema if not exists auth;
create schema if not exists private;
do $$begin if not exists(select from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;end$$;
grant usage on schema private,public,auth to authenticated;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable set search_path='' as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table private.tower_accounts(user_id uuid primary key references auth.users(id),revision bigint not null default 0,silver bigint default 0,gold bigint default 0,elements jsonb not null default '[]');
create table private.tower_v2_elements(user_id uuid not null references auth.users(id),id uuid not null,data jsonb not null,created_at timestamptz default now(),primary key(user_id,id));
insert into auth.users(id) values('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into private.tower_accounts(user_id,silver,gold,elements) values('11111111-1111-4111-8111-111111111111',35,4,'[]'),('22222222-2222-4222-8222-222222222222',60,6,'[]');
