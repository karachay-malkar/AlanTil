begin;

alter table public.content_structure
add column if not exists icon_name text;

update public.content_structure as c
set icon_name = v.icon_name
from (
  values
    ('beginner-01', '01_first_step.webp'),
    ('beginner-02', '02_city_center.webp'),
    ('beginner-03', '03_old_quarter.webp'),
    ('beginner-04', '04_city_market.webp'),
    ('beginner-05', '05_city_park.webp'),
    ('beginner-06', '06_city_outskirts.webp'),
    ('beginner-07', '07_river_bridge.webp'),
    ('beginner-08', '08_roadside_cafe.webp'),
    ('beginner-09', '09_suburban_houses.webp'),
    ('beginner-10', '10_rural_school.webp'),
    ('beginner-11', '11_last_houses.webp'),
    ('beginner-12', '12_city_view.webp'),
    ('beginner-13', '13_open_road.webp'),
    ('beginner-14', '14_flowery_fields.webp'),
    ('beginner-15', '15_sheep_herd_on_road.webp'),
    ('beginner-16', '16_cozy_village.webp'),
    ('beginner-17', '17_gas_station_after_village.webp'),
    ('beginner-18', '18_tourist_cafes.webp'),
    ('beginner-19', '19_foothill_plain.webp'),
    ('beginner-20', '20_second_lake.webp'),
    ('beginner-21', '21_foothill_meadow.webp'),
    ('beginner-22', '22_mountain_spring.webp'),
    ('beginner-23', '23_mobile_apiary.webp'),
    ('beginner-24', '24_forest_glade.webp'),
    ('beginner-25', '25_river_bridge.webp'),
    ('beginner-26', '26_gorge_entrance.webp'),
    ('beginner-27', '27_rock_tunnel.webp'),
    ('beginner-28', '28_overhanging_cliffs.webp'),
    ('beginner-29', '29_eagles_above.webp'),
    ('beginner-30', '30_old_mountain_village.webp')
) as v(entity_id, icon_name)
where c.entity_type = 'set'
  and c.entity_id = v.entity_id;

do $validation$
declare
  mapped_count integer;
begin
  select count(*) into mapped_count
  from public.content_structure
  where entity_type = 'set'
    and entity_id like 'beginner-%'
    and icon_name ~ '^(0[1-9]|[12][0-9]|30)_[a-z0-9_]+[.]webp$';

  if mapped_count <> 30 then
    raise exception 'Expected 30 beginner WebP icon mappings, got %', mapped_count;
  end if;
end
$validation$;

notify pgrst, 'reload schema';
commit;
