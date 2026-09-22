begin;

alter table public.content_structure
add column if not exists icon_name text;

update public.content_structure
set icon_name = v.icon_name
from (
  values
    ('beginner-01', 'Set_stone_icon_6.png'),
    ('beginner-02', 'Set_stone_icon_1.png'),
    ('beginner-03', 'Set_stone_icon_4.png'),
    ('beginner-04', 'Set_stone_icon_6.png'),
    ('beginner-05', 'Set_stone_icon_2.png'),
    ('beginner-06', 'Set_stone_icon_7.png'),
    ('beginner-07', 'Set_stone_icon_6.png'),
    ('beginner-08', 'Set_stone_icon_6.png'),
    ('beginner-09', 'Set_stone_icon_5.png'),
    ('beginner-10', 'Set_stone_icon_2.png'),
    ('beginner-11', 'Set_stone_icon_3.png'),
    ('beginner-12', 'Set_stone_icon_5.png'),
    ('beginner-13', 'Set_stone_icon_2.png'),
    ('beginner-14', 'Set_stone_icon_1.png'),
    ('beginner-15', 'Set_stone_icon_3.png'),
    ('beginner-16', 'Set_stone_icon_7.png'),
    ('beginner-17', 'Set_stone_icon_2.png'),
    ('beginner-18', 'Set_stone_icon_7.png'),
    ('beginner-19', 'Set_stone_icon_5.png'),
    ('beginner-20', 'Set_stone_icon_3.png'),
    ('beginner-21', 'Set_stone_icon_4.png'),
    ('beginner-22', 'Set_stone_icon_1.png'),
    ('beginner-23', 'Set_stone_icon_5.png'),
    ('beginner-24', 'Set_stone_icon_4.png'),
    ('beginner-25', 'Set_stone_icon_1.png'),
    ('beginner-26', 'Set_stone_icon_2.png'),
    ('beginner-27', 'Set_stone_icon_3.png'),
    ('beginner-28', 'Set_stone_icon_1.png'),
    ('beginner-29', 'Set_stone_icon_4.png'),
    ('beginner-30', 'Set_stone_icon_7.png')
) as v(entity_id, icon_name)
where public.content_structure.entity_type = 'set'
  and public.content_structure.entity_id = v.entity_id;

do $$
begin
  if (
    select count(*)
    from public.content_structure
    where entity_type = 'set'
      and entity_id in (
        'beginner-01','beginner-02','beginner-03','beginner-04','beginner-05',
        'beginner-06','beginner-07','beginner-08','beginner-09','beginner-10',
        'beginner-11','beginner-12','beginner-13','beginner-14','beginner-15',
        'beginner-16','beginner-17','beginner-18','beginner-19','beginner-20',
        'beginner-21','beginner-22','beginner-23','beginner-24','beginner-25',
        'beginner-26','beginner-27','beginner-28','beginner-29','beginner-30'
      )
      and icon_name is not null
  ) <> 30 then
    raise exception 'Expected icon_name for all 30 beginner sets';
  end if;
end;
$$;

notify pgrst, 'reload schema';
commit;
