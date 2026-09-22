begin;

update public.content_structure as c
set name_ru = v.name_ru,
    name_en = v.name_en,
    name_tr = v.name_tr
from (
  values
    ($q$beginner-01$q$, $q$Первый шаг$q$, $q$First Step$q$, $q$İlk Adım$q$),
    ($q$beginner-02$q$, $q$Центр города$q$, $q$City Center$q$, $q$Şehir Merkezi$q$),
    ($q$beginner-03$q$, $q$Старый квартал$q$, $q$Old Quarter$q$, $q$Eski Mahalle$q$),
    ($q$beginner-04$q$, $q$Городской рынок$q$, $q$City Market$q$, $q$Şehir Pazarı$q$),
    ($q$beginner-05$q$, $q$Городской парк$q$, $q$City Park$q$, $q$Şehir Parkı$q$),
    ($q$beginner-06$q$, $q$Окраина города$q$, $q$City Outskirts$q$, $q$Şehir Çeperi$q$),
    ($q$beginner-07$q$, $q$Мост через реку$q$, $q$River Bridge$q$, $q$Nehir Köprüsü$q$),
    ($q$beginner-08$q$, $q$Кафе у дороги$q$, $q$Roadside Café$q$, $q$Yol Kenarı Kafesi$q$),
    ($q$beginner-09$q$, $q$Проезжая через посёлок$q$, $q$Passing Through Town$q$, $q$Kasabadan Geçerken$q$),
    ($q$beginner-10$q$, $q$Школа$q$, $q$School$q$, $q$Okul$q$),
    ($q$beginner-11$q$, $q$Последние дома$q$, $q$Last Houses$q$, $q$Son Evler$q$),
    ($q$beginner-12$q$, $q$Панорама$q$, $q$Panorama$q$, $q$Panorama$q$),
    ($q$beginner-13$q$, $q$Путь продолжается$q$, $q$The Journey Continues$q$, $q$Yolculuk Devam Ediyor$q$),
    ($q$beginner-14$q$, $q$Цветущие поля$q$, $q$Flowering Fields$q$, $q$Çiçekli Tarlalar$q$),
    ($q$beginner-15$q$, $q$Отара на дороге$q$, $q$Flock on the Road$q$, $q$Yoldaki Sürü$q$),
    ($q$beginner-16$q$, $q$Уютное село$q$, $q$Cozy Village$q$, $q$Şirin Köy$q$),
    ($q$beginner-17$q$, $q$Заправка$q$, $q$Gas Station$q$, $q$Benzin İstasyonu$q$),
    ($q$beginner-18$q$, $q$Кафе у озера$q$, $q$Lakeside Café$q$, $q$Göl Kenarı Kafesi$q$),
    ($q$beginner-19$q$, $q$Предгорная равнина$q$, $q$Foothill Plain$q$, $q$Dağ Eteği Ovası$q$),
    ($q$beginner-20$q$, $q$Ещё одно озеро$q$, $q$Another Lake$q$, $q$Bir Göl Daha$q$),
    ($q$beginner-21$q$, $q$Луг$q$, $q$Meadow$q$, $q$Çayır$q$),
    ($q$beginner-22$q$, $q$Остановка у родника$q$, $q$Stop by the Spring$q$, $q$Pınar Başında Mola$q$),
    ($q$beginner-23$q$, $q$Пасека у дороги$q$, $q$Roadside Apiary$q$, $q$Yol Kenarında Arılık$q$),
    ($q$beginner-24$q$, $q$Лесная опушка$q$, $q$Forest Edge$q$, $q$Orman Kenarı$q$),
    ($q$beginner-25$q$, $q$Мост через горную реку$q$, $q$Bridge over a Mountain River$q$, $q$Dağ Nehri Üzerindeki Köprü$q$),
    ($q$beginner-26$q$, $q$Въезд в ущелье$q$, $q$Entrance to the Gorge$q$, $q$Boğaza Giriş$q$),
    ($q$beginner-27$q$, $q$Тоннель в скале$q$, $q$Rock Tunnel$q$, $q$Kaya Tüneli$q$),
    ($q$beginner-28$q$, $q$Под нависающими скалами$q$, $q$Under the Overhanging Cliffs$q$, $q$Sarkan Kayalıkların Altında$q$),
    ($q$beginner-29$q$, $q$Орлы в вышине$q$, $q$Eagles High Above$q$, $q$Yükseklerde Kartallar$q$),
    ($q$beginner-30$q$, $q$Древнее поселение$q$, $q$Ancient Settlement$q$, $q$Kadim Yerleşim$q$)
) as v(entity_id, name_ru, name_en, name_tr)
where c.entity_type = 'set'
  and c.entity_id = v.entity_id;

update public.dictionary_metadata
set current_version = '2026.09.22.2'
where dictionary_key = 'main';

do $validation$
declare
  localized_count integer;
begin
  select count(*) into localized_count
  from public.content_structure
  where entity_type = 'set'
    and entity_id like 'beginner-%'
    and name_ru is not null
    and name_en is not null
    and name_tr is not null;

  if localized_count <> 30 then
    raise exception 'Expected 30 localized beginner sets, got %', localized_count;
  end if;
end
$validation$;

notify pgrst, 'reload schema';
commit;
