-- AlanTil 17.2: admin-authored manual Common 100 stone placements.
-- Isolated from tower_game tables, analytics, study sessions and favorites.
create table if not exists public.masonry_editor_sections (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
 title text not null check (char_length(btrim(title)) between 1 and 120),
 status text not null default 'draft' check (status in ('draft','ready','approved','published')),
 cells integer[] not null check (
  array_length(cells,1)=3 and cells[1] between 1 and 32 and
  cells[2] between 1 and 32 and cells[3] between 1 and 32
 ),
 recipe jsonb not null check (
  recipe->>'version'='common100-manual-1' and
  recipe->>'cellMeters'='0.25' and
  jsonb_typeof(recipe->'stones')='array' and
  jsonb_array_length(recipe->'stones')<=1500 and
  jsonb_typeof(recipe->'cells')='array' and
  jsonb_array_length(recipe->'cells')=3 and
  recipe->'cells'=to_jsonb(cells)
 ),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists masonry_editor_sections_owner_updated_idx
 on public.masonry_editor_sections(user_id,updated_at desc);
create or replace function public.masonry_editor_touch_updated_at()
 returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now();return new;end;
$$;
drop trigger if exists masonry_editor_touch_updated_at on public.masonry_editor_sections;
create trigger masonry_editor_touch_updated_at
 before update on public.masonry_editor_sections
 for each row execute function public.masonry_editor_touch_updated_at();
alter table public.masonry_editor_sections enable row level security;
revoke all on table public.masonry_editor_sections from public,anon,authenticated;
grant select,insert,update on table public.masonry_editor_sections to authenticated;
drop policy if exists masonry_editor_read on public.masonry_editor_sections;
create policy masonry_editor_read on public.masonry_editor_sections
 for select to authenticated using (
  user_id=auth.uid() and exists (
   select 1 from public.profiles p where p.user_id=auth.uid() and p.activity_access is true
  )
 );
drop policy if exists masonry_editor_create on public.masonry_editor_sections;
create policy masonry_editor_create on public.masonry_editor_sections
 for insert to authenticated with check (
  user_id=auth.uid() and status in ('draft','ready') and exists (
   select 1 from public.profiles p where p.user_id=auth.uid() and p.activity_access is true
  )
 );
drop policy if exists masonry_editor_modify on public.masonry_editor_sections;
create policy masonry_editor_modify on public.masonry_editor_sections
 for update to authenticated using (
  user_id=auth.uid() and status in ('draft','ready') and exists (
   select 1 from public.profiles p where p.user_id=auth.uid() and p.activity_access is true
  )
 ) with check (
  user_id=auth.uid() and status in ('draft','ready') and exists (
   select 1 from public.profiles p where p.user_id=auth.uid() and p.activity_access is true
  )
 );
comment on table public.masonry_editor_sections is
 'Admin-only manual Common100 section recipes. Reviewed exports must be promoted to assets separately.';
