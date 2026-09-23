begin;

with set_data(entity_id, name_alan_cyrillic, name_alan_turkic, icon_name) as (
  values
    ('intermediate-01', 'Ныгъыш', 'Nığış', '01_nygysh.webp'),
    ('intermediate-02', 'Тёре', 'Töre', '02_tyore.webp'),
    ('intermediate-03', 'Межгит', 'Mejgit', '03_mezhgit.webp'),
    ('intermediate-04', 'Чалкъычыларыбызныкъладанмыса?', 'Çalqıçılarımıznıqladanmısa?', '04_chalkychylarybyznykladanmyla.webp'),
    ('intermediate-05', 'Балкъош', 'Balqoş', '05_balkosh.webp'),
    ('intermediate-06', 'Къош', 'Qoş', '06_qosh.webp'),
    ('intermediate-07', 'Къурманлыкъ', 'Qurmanlıq', '07_kurmanlyk.webp'),
    ('intermediate-08', 'Аппаны оюнлары', 'Appanı oyunları', '08_appany_oynlary.webp'),
    ('intermediate-09', 'Чариш', 'Çariş', '09_charish.webp'),
    ('intermediate-10', 'Хычынла', 'Xıçınla', '10_khychynla.webp'),
    ('intermediate-11', 'Къой къыркъыу', 'Qoy qırqıw', '11_qoy_qyrqyiu.webp'),
    ('intermediate-12', 'Чум жыйыу', 'Çum jıyıw', '12_chum_jyyiu.webp'),
    ('intermediate-13', 'Ашыкъ оюн', 'Aşıq oyun', '13_ashyq_oyun.webp'),
    ('intermediate-14', 'Суугъа секириу', 'Suwğa sekiriw', '14_suugha_sekiriu.webp'),
    ('intermediate-15', 'Алан клиса', 'Alan klisa', '15_alan_klisa.webp'),
    ('intermediate-16', 'Таулу кийиз', 'Tawlu kiyiz', '16_taulu_kiyiz.webp'),
    ('intermediate-17', 'Сабаннга барабыз!', 'Sabanña barabız!', '17_sabannga_barabyz.webp'),
    ('intermediate-18', 'Тирмен', 'Tirmen', '18_tirmen.webp'),
    ('intermediate-19', 'Юй къалагъан', 'Üy qalağan', '19_yui_qalaghan.webp'),
    ('intermediate-20', 'Къонакъ тепси', 'Qonaq tepsi', '20_qonaq_tepsi.webp'),
    ('intermediate-21', 'Мараучу', 'Marawçu', '21_marauchu.webp'),
    ('intermediate-22', 'Кёпюр ишлеу', 'Köpür işlew', '22_kopyur_ishleu.webp'),
    ('intermediate-23', 'Темирчи', 'Temirçi', '23_temirchi.webp'),
    ('intermediate-24', 'Сют сауу', 'Süt sawu', '24_syut_sauu.webp'),
    ('intermediate-25', 'Амманы җомакълары', 'Ammanı comaqları', '25_ammany_zhomaklary.webp'),
    ('intermediate-26', 'Бешик', 'Beşik', '26_beshik.webp')
)
update public.content_structure cs
set
  name_alan_cyrillic = d.name_alan_cyrillic,
  name_alan_turkic = d.name_alan_turkic,
  icon_name = d.icon_name
from set_data d
where cs.entity_type = 'set'
  and cs.entity_id = d.entity_id;

update public.dictionary_metadata
set current_version = '2026.09.23.2'
where dictionary_key = 'main';

commit;
