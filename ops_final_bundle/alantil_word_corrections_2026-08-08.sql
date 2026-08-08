-- AlanTil word corrections from Alan til 11.07.26.xlsx
-- Generated 2026-08-08. Structure/IDs are not modified.
-- Guarded by current values captured from live Supabase on 2026-08-08.
begin;
do $$
declare v_count integer;
begin
  update public.content_word_texts set phrases_text = '1.1 варить обед
1.2 построить дорогу
1.3 сложить песню
1.4 сомневаться
1.5 предводительствовать', updated_at = now() where word_id = '0003' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 варить обед
1.2 построить дорогу
1.3 сложить песню
1.4 сомневаться
1.5 предводительство­вать';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 1: word_id=0003 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 посмотреть из окна
1.2 озираться, оглядеться
1.3 ухаживать за больным
1.4 следить за скотом', updated_at = now() where word_id = '0013' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 посмотреть из окна
1.2 озираться, огля­деться
1.3 ухаживать за больным
1.4 следить за скотом';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 2: word_id=0013 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 четыре места остались свободными
1.2 уснуть
1.3 попасть в беду', updated_at = now() where word_id = '0016' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 четыре места остались свобод­ными
1.2 уснуть
1.3 попасть в беду';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 3: word_id=0016 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 передняя нога
1.2 фасад дома
1.3 читай стих с начала!
1.4 вступительное слово', updated_at = now() where word_id = '0024' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 передняя нога
1.2 фасад дома
1.3 читай стих с начала!
1.4 вступи­тельное слово';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 4: word_id=0024 ru/ phrases_text'; end if;
  update public.content_word_texts set translation_text = '1. рука, кисть; 
2. балка, долина, ущелье (небольшое)', updated_at = now() where word_id = '0026' and language_code = 'ru' and script_code = '' and translation_text is not distinct from '1. рука, кисть; 
2. балка, долина, ущелье (неболь­шое)';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 5: word_id=0026 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 открыть глаза
1.2 ушко иголки
1.3 отверстие в оконной раме для стекла', updated_at = now() where word_id = '0028' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 открыть глаза
1.2 ушко иголки
1.3 отверстие в окон­ной раме для стекла';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 6: word_id=0028 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 я еле добрался до дому
1.2 ты меня не достанешь
1.3 для этой работы ему не хватает опыта', updated_at = now() where word_id = '0045' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 я еле добрался до дому
1.2 ты меня не достанешь
1.3 для этой работы ему не хватаем опыта';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 7: word_id=0045 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 меня зовут Бонд… Джеймс Бонд', updated_at = now() where word_id = '0049' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 меня зоут Бонд… Джеймс Бонд';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 8: word_id=0049 ru/ phrases_text'; end if;
  update public.content_word_texts set translation_text = 'внутренность, середина', updated_at = now() where word_id = '0055' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'внутреность, середина';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 9: word_id=0055 ru/ translation_text'; end if;
  update public.content_word_texts set translation_text = 'низ, дно, основание', updated_at = now() where word_id = '0081' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'низ, дно, оносвание';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 10: word_id=0081 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 аны акъылы теренди
1.2 акъылгъа келирге
1.3 акъылынг къалайды?', updated_at = now() where word_id = '0095' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 аны акъылы теренди
1.2 акъылггъа келирге
1.3 акъылынг къалайды?';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 11: word_id=0095 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 anı aqılı terendi
1.2 aqılğa kelirge
1.3 aqılıñ qalaydı?', updated_at = now() where word_id = '0095' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 anı aqılı terendi
1.2 aqılgğa kelirge
1.3 aqılıñ qalaydı?';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 12: word_id=0095 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 аны ючюн къайгъы этме
1.2 башыбызгъа къайгъы тюшгенди
1.3 къайгъы чыгъарыргъа', updated_at = now() where word_id = '0150' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 аны ючюн къайгъы этме
1.2 башыбызгъа къайгы тюшгенди
1.3 къайгъы чыгъарыргъа';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 13: word_id=0150 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 anı üçün qayğı etme
1.2 başıbızğa qayğı tüşgendi
1.3 qayğı çığarırğa', updated_at = now() where word_id = '0150' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 anı üçün qayğı etme
1.2 başıbızğa qaygı tüşgendi
1.3 qayğı çığarırğa';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 14: word_id=0150 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 мы дошли до середины пути
1.2 Хасанья - столица мира
1.3 пролёт моста между двумя опорами
1.4 междуречье
1.5 у нас хорошие отношения
2.1 общее достояние, общественное хозяйство
2.2 это общее дело', updated_at = now() where word_id = '0156' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 мы дошли до сере­дины пути
1.2 Хасанья - столица мира
1.3 пролёт моста между двумя опорами
1.4 междуречье
1.5 у нас хорошие отношения
2.1 общее достояние, общественное хозяйство
2.2 это общее дело';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 15: word_id=0156 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 чуругъум аягъымы къысады
1.2 столну терезе таба къыс
1.3 эшикни къысаргъа
1.4 бауну быргъагъа къысаргъа', updated_at = now() where word_id = '0157' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 чуругъум аягъымы къысады
1.2 столну терезе таба къыс
1.3 эшкини къысаргъа
1.4 бауну быргъагъа къысаргъа';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 16: word_id=0157 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 çuruğum ayağımı qısadı
1.2 stolnu tereze taba qıs
1.3 eşikni qısarğa
1.4 bawnu bırğağa qısarğa', updated_at = now() where word_id = '0157' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 çuruğum ayağımı qısadı
1.2 stolnu tereze taba qıs
1.3 eşkini qısarğa
1.4 bawnu bırğağa qısarğa';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 17: word_id=0157 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 турур къарыуу җокъду
1.2 юй сатыб алыргъа аны къарыуу җокъду', updated_at = now() where word_id = '0224' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 турур къарыуу җокъду
1.2 юй сатыб алыргъа аны къарыу җокъду';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 18: word_id=0224 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 turur qarıwu coqdu
1.2 üy satıb alırğa anı qarıwu coqdu', updated_at = now() where word_id = '0224' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 turur qarıwu coqdu
1.2 üy satıb alırğa anı qarıw coqdu';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 19: word_id=0224 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 саннга айыб тюлмюдю?
1.2 айыбны биреуге салыргъа
2.1 айыб табаргъа', updated_at = now() where word_id = '0237' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 саннга айыб тюлмюдю?
1.2 айыбны биреуге салыр­гъа
2.1 айыб табаргъа';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 20: word_id=0237 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 sanña ayıb tülmüdü?
1.2 ayıbnı birewge salırğa
2.1 ayıb tabarğa', updated_at = now() where word_id = '0237' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 sanña ayıb tülmüdü?
1.2 ayıbnı birewge salır­ğa
2.1 ayıb tabarğa';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 21: word_id=0237 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 купить втридорога
1.2 рыночная цена
1.3 вещь высокой ценности', updated_at = now() where word_id = '0285' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 купить втридорога
1.2 рыночная цена
1.3 вещь высокой ценно­сти';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 22: word_id=0285 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 хатам җокъду', updated_at = now() where word_id = '0287' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 хата җокъду';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 23: word_id=0287 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 xatam coqdu', updated_at = now() where word_id = '0287' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 xata coqdu';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 24: word_id=0287 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 места, покрытые лесом
1.2 тучи заволокли небо', updated_at = now() where word_id = '0294' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 места, покрыытые лесом
1.2 тучи заволокли нёбо';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 25: word_id=0294 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 перенимать что друг у друга
1.2 привыкнуть к почерку', updated_at = now() where word_id = '0301' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 перенимать что друг у друга
1.2 при­выкнуть к почерку';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 26: word_id=0301 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 аскер къураргъа
1.2 җолгъа къураргъа', updated_at = now() where word_id = '0303' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 аскер къараргъа
1.2 җолгъа къараргъа';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 27: word_id=0303 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 asker qurarğa
1.2 colğa qurarğa', updated_at = now() where word_id = '0303' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 asker qararğa
1.2 colğa qararğa';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 28: word_id=0303 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 сбивать масло
1.2 масло с водой не перемешивается
2.1 кто врага щадит, тот сам погибает', updated_at = now() where word_id = '0334' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 сбивать масло
1.2 масло с водой не перемешива­ется
2.1 кто врага щадит, тот сам погибает';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 29: word_id=0334 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 бютеу юйюрю бла', updated_at = now() where word_id = '0336' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 бютеу юйюр бла';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 30: word_id=0336 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 bütew üyürü bla', updated_at = now() where word_id = '0336' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 bütew üyür bla';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 31: word_id=0336 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 горький перец
1.2 суп горький
1.3 лютый мороз
1.4 жестокая борьба с врагами
1.5 горькое или сладкое знает тот, кто пробует на вкус', updated_at = now() where word_id = '0344' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 горький перец
1.2 суп горький
1.3 лютый мороз
1.4 жестокая борьба с вра­гами
1.5 горькое или сладкое знает тот, кто пробует на вкус';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 32: word_id=0344 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 застлать пол ковром
1.2 распространять знания
1.3 растопырить пальцы
1.4 пускать овец пастись
1.5 развести много кур', updated_at = now() where word_id = '0361' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 застлать пол ковром
1.2 распро­странять знания
1.3 растопырить пальцы
1.4 пускать овец пастись
1.5 развести много кур';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 33: word_id=0361 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 нестерпимый
1.2 мириться с недостатками', updated_at = now() where word_id = '0364' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 нестерпимый
1.2 мириться с недостат­ками';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 34: word_id=0364 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 ууу болгъан
1.2 ууу җетерге
2.1 уугъа барыргъа', updated_at = now() where word_id = '0380' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 ууу болгъан
1.2 ууу җетерге
2.1 уугъа барыргъа выйти';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 35: word_id=0380 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 uwu bolğan
1.2 uwu ceterge
2.1 uwğa barırğa', updated_at = now() where word_id = '0380' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 uwu bolğan
1.2 uwu ceterge
2.1 uwğa barırğa vıyti';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 36: word_id=0380 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 ядовитый
1.2 оказывать вредное влияние
2.1 выйти на охоту', updated_at = now() where word_id = '0380' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 ядовитый
1.2 оказывать вредное влияние
2.1 на охоту';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 37: word_id=0380 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 место изгиба
1.2 положи себе за пазуху
1.3 прижать к груди
1.4 женщина взяла своего ребёнка на руки', updated_at = now() where word_id = '0436' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 место изгиба
1.2 положи себе за пазуху
1.3 прижать к груди
1.4 жен­щина взяла своего ребёнка на руки';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 38: word_id=0436 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 сыфаты ариу
1.2 ол сыфатынг неди?', updated_at = now() where word_id = '0439' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 сыфаты ариу красивый
1.2 ол сыфатынг неди?';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 39: word_id=0439 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 sıfatı ariw
1.2 ol sıfatıñ nedi?', updated_at = now() where word_id = '0439' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 sıfatı ariw krasivıy
1.2 ol sıfatıñ nedi?';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 40: word_id=0439 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 красивый на вид
1.2 что у тебя за вид?', updated_at = now() where word_id = '0439' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 на вид
1.2 что у тебя за вид?';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 41: word_id=0439 ru/ phrases_text'; end if;
  update public.content_word_texts set translation_text = 'двигаться, трястись, пульсировать', updated_at = now() where word_id = '0460' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'двигаться, трястись, пульсирвать';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 42: word_id=0460 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 больному - бычье здоровье, девушке на выданье - шёлковый платок', updated_at = now() where word_id = '0522' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 больному - бычье здоровье, девушке на выданье - шёл­ковый платок';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 43: word_id=0522 ru/ phrases_text'; end if;
  update public.content_word_texts set translation_text = 'выжимать, отжимать, заставлять (перен.)', updated_at = now() where word_id = '0536' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'выжимать, отжимать, заставлять';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 44: word_id=0536 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къобуз согъаргъа', updated_at = now() where word_id = '0544' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къобуз согъаргъа играть';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 45: word_id=0544 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 qobuz soğarğa', updated_at = now() where word_id = '0544' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 qobuz soğarğa igrat';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 46: word_id=0544 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 играть на гармони', updated_at = now() where word_id = '0544' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 на гармони';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 47: word_id=0544 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 похоронить умершего
2.1 я ту книгу держу в сундуке
2.2 я ращу (кормлю) троих детей
2.3 кормить грудью', updated_at = now() where word_id = '0588' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 похоронить умершего
2.1 я ту книгу держу в сундуке
2.2 я ращу (кормлю) троих де­тей
2.3 кормить грудью';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 48: word_id=0588 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 сапоги с голенищами', updated_at = now() where word_id = '0600' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 сапоги голенищами';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 49: word_id=0600 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 мясо недоварилось
1.2 время созревания фруктов
1.3 от жары мы скоро изжаримся (перен.)', updated_at = now() where word_id = '0601' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 мясо недоварилось
1.2 время созревания фруктов
1.3 от жары мы скоро изжа­римся (перен.)';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 50: word_id=0601 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 праздновать', updated_at = now() where word_id = '0657' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 празд­новать';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 51: word_id=0657 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 соседнее село', updated_at = now() where word_id = '0660' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 со­седнее село';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 52: word_id=0660 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 крутые берега реки
1.2 у нас натянутые отношения (перен.)
1.3 грубое слово (перен.)
2.1 пристальный взгляд', updated_at = now() where word_id = '0669' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 крутые берега реки
1.2 у нас натянутые отношения (перен.)
1.3 грубое слово (перен.)
2.1 при­стальный взгляд';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 53: word_id=0669 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къолтугъунга къысаргъа
2.1 җолну къолтугъу', updated_at = now() where word_id = '0670' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къолтугъунга къысаргъа
2.1 җолну колтугъу';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 54: word_id=0670 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 qoltuğuña qısarğa
2.1 colnu qoltuğu', updated_at = now() where word_id = '0670' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 qoltuğuña qısarğa
2.1 colnu koltuğu';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 55: word_id=0670 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 мучительная работа
1.2 испытать страдания
1.3 попасть в беду', updated_at = now() where word_id = '0688' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 мучительная ра­бота
1.2 испытать страдания
1.3 попасть в беду';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 56: word_id=0688 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къаршчы болмай
1.2 бизни юйге къаршчы
1.3 арбала бизге къаршчы келедиле', updated_at = now() where word_id = '0709' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къаршчы болмай
1.2 бизни юйге къаршчы
1.3 арбала бизге къаршчы';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 57: word_id=0709 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 qarşçı bolmay
1.2 bizni üyge qarşçı
1.3 arbala bizge qarşçı keledile', updated_at = now() where word_id = '0709' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 qarşçı bolmay
1.2 bizni üyge qarşçı
1.3 arbala bizge qarşçı';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 58: word_id=0709 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 не сопротивляясь
1.2 напротив нашего дома
1.3 подводы идут нам навстречу', updated_at = now() where word_id = '0709' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 не сопротивляясь
1.2 напротив нашего дома
1.3 келедиле подводы идут нам навстречу';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 59: word_id=0709 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къолан къумач
1.2 къолан бузоу', updated_at = now() where word_id = '0716' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къолан къумач
1.2 коълан бузоу';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 60: word_id=0716 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 qolan qumaç
1.2 qolan buzow', updated_at = now() where word_id = '0716' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 qolan qumaç
1.2 kolan buzow';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 61: word_id=0716 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 где ты ходишь столько времени?', updated_at = now() where word_id = '0723' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 где ты ходишь столько вре­мени?';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 62: word_id=0723 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 споткнуться о камень
1.2 запнуться на слове', updated_at = now() where word_id = '0733' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 спот­кнуться о камень
1.2 за­пнуться на слове';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 63: word_id=0733 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 нож с роговой ручкой', updated_at = now() where word_id = '0743' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 нож роговой ручкой';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 64: word_id=0743 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 человек с красивой внешностью', updated_at = now() where word_id = '0747' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 человек красивой внешностью';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 65: word_id=0747 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 разбирать пистолет', updated_at = now() where word_id = '0756' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 разбирать питсолет';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 66: word_id=0756 ru/ phrases_text'; end if;
  update public.content_word_texts set translation_text = 'взволновывать, обострять, тревожить', updated_at = now() where word_id = '0762' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'взовлновывать, обострять, тревожить';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 67: word_id=0762 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 кёлкъалды болуб къараргъа
1.2 ууакъ гурушхала
1.3 гурушха болургъа', updated_at = now() where word_id = '0766' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 кёлкъады болуб къараргъа
1.2 ууакъ гурушхала
1.3 гурушха болургъа';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 68: word_id=0766 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 kölqaldı bolub qararğa
1.2 uwaq guruşxala
1.3 guruşxa bolurğa', updated_at = now() where word_id = '0766' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 kölqadı bolub qararğa
1.2 uwaq guruşxala
1.3 guruşxa bolurğa';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 69: word_id=0766 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 мы не понимаем даже частицу вселенной', updated_at = now() where word_id = '0781' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 мы не понимаем даже частику вселенной';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 70: word_id=0781 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 сыртлы шиндик
1.2 узун шиндик', updated_at = now() where word_id = '0784' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 стол (сыртлы) шиндик
1.2 узун шиндик';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 71: word_id=0784 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 sırtlı şindik
1.2 uzun şindik', updated_at = now() where word_id = '0784' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 stol (sırtlı) şindik
1.2 uzun şindik';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 72: word_id=0784 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 җукъа къанга
2.1 җукъа адам
3.1 җукъа кийим
4.1 җукъа шорпа
4.2 терекле җукъа орнатылгъандыла
5.1 җукъа адам сёзлю болур
6.1 къолу җукъа адам', updated_at = now() where word_id = '0797' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 җукъа къанга
1.2 җукъа адам
1.3 җукъ шорпа
1.4 терекле җукъа орнатылгъандыла';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 73: word_id=0797 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 cuqa qaña
2.1 cuqa adam
3.1 cuqa kiyim
4.1 cuqa şorpa
4.2 terekle cuqa ornatılğandıla
5.1 cuqa adam sözlü bolur
6.1 qolu cuqa adam', updated_at = now() where word_id = '0797' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 cuqa qaña
1.2 cuqa adam
1.3 cuq şorpa
1.4 terekle cuqa ornatılğandıla';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 74: word_id=0797 alan/turkic phrases_text'; end if;
  update public.content_word_texts set translation_text = '1. тонкий; 
2. худой, худощавый; 
3. лёгкий; 
4. жидкий, редкий; 
5. нервный, горячий, вспыльчивый (перен.); 
6. несостоятельный, бедный', updated_at = now() where word_id = '0797' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'тонкий, худой';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 75: word_id=0797 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 тонкая доска
2.1 худощавый человек
3.1 лёгкая одежда
4.1 жидкий суп
4.2 деревья посажены редко
5.1 горячий человек бывает болтливым
6.1 бедный человек', updated_at = now() where word_id = '0797' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 тонкая доска
1.2 худощавый человек
1.3 жидкий суп
1.4 деревья посажены редко';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 76: word_id=0797 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 обмотать мешок верёвкой
1.2 укутать в бурку
1.3 заворачивать в бумагу', updated_at = now() where word_id = '0804' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 обмотать мешок верёвкой
1.2 укутать в бурку
1.3 завора­чивать в бумагу';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 77: word_id=0804 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 эмаль на посуде потрескалась
1.2 в огне трещат поленья
1.3 овца отстала
1.4 брызнула кровь', updated_at = now() where word_id = '0805' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 эмаль на посуде потрескалась
1.2 в огне трещат поленья
1.3 овца отстала
1.4 брыз­нула кровь';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 78: word_id=0805 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 тоньше прута
1.2 высокий голос', updated_at = now() where word_id = '0810' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 тоньше прута
1.2 вы­сокий голос';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 79: word_id=0810 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 маленький по размеру', updated_at = now() where word_id = '0819' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 малень­кий по размеру';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 80: word_id=0819 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 тюймелерин этмегенлей
1.2 алтын тюйме', updated_at = now() where word_id = '0826' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 тюёмелерин этмегенлей
1.2 алтын тюйме';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 81: word_id=0826 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 tüymelerin etmegenley
1.2 altın tüyme', updated_at = now() where word_id = '0826' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 tüömelerin etmegenley
1.2 altın tüyme';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 82: word_id=0826 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 нараспашку
1.2 золотой нагрудник', updated_at = now() where word_id = '0826' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 нарас­пашку
1.2 золотой нагрудник';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 83: word_id=0826 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 вода течёт с горы
2.1 у меня ноги отекли и онемели', updated_at = now() where word_id = '0843' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 вода течёт горы
2.1 у меня ноги отекли и онемели';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 84: word_id=0843 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 ясное небо
1.2 погожий день', updated_at = now() where word_id = '0848' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 ясное нёбо
1.2 погожий день';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 85: word_id=0848 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къойла аргъы бетдедиле
1.2 къагъытны аргъы җанында
1.3 мындан аргъысы къолай тюлдю', updated_at = now() where word_id = '0861' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къойла аргъы бетдедиле
1.2 къагъытны аргъы җанында
1.3 мын­дан аргъысы къолай тюлдю';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 86: word_id=0861 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 qoyla arğı betdedile
1.2 qağıtnı arğı canında
1.3 mından arğısı qolay tüldü', updated_at = now() where word_id = '0861' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 qoyla arğı betdedile
1.2 qağıtnı arğı canında
1.3 mın­dan arğısı qolay tüldü';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 87: word_id=0861 alan/turkic phrases_text'; end if;
  update public.content_word_texts set translation_text = 'водопад, ручей, поток, струя, волна', updated_at = now() where word_id = '0882' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'водопад, ручей, поток, струя, во­лна';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 88: word_id=0882 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 лучшая одежда
1.2 больной поправился', updated_at = now() where word_id = '0883' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 лучшая одежда
1.2 больной попра­вился';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 89: word_id=0883 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 эм къыяма кюнле
1.2 къышны къыямасы', updated_at = now() where word_id = '0902' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 эм къыяма кюнле
1.2 къышны къыяматы';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 90: word_id=0902 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 em qıyama künle
1.2 qışnı qıyaması', updated_at = now() where word_id = '0902' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 em qıyama künle
1.2 qışnı qıyamatı';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 91: word_id=0902 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 тяжелейшие дни
1.2 разгар зимы', updated_at = now() where word_id = '0902' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 тяжелешие дни
1.2 разгар зимы';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 92: word_id=0902 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 собака сорвалась с цепи
1.2 выпасть из рук
1.3 я еле отвязался от этого человека', updated_at = now() where word_id = '0903' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 собака сорвалась цепи
1.2 выпасть из рук
1.3 я еле отвязался от этого человека';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 93: word_id=0903 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 тюгел алай тюлдю
1.2 тай алкъын тюгел ауузлукъ билиб бошамагъанды
1.3 тюгел ёлмей
1.4 мен тюгел җетгинчи', updated_at = now() where word_id = '0917' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 тюгел алай тюлдю немного
1.2 тай алкъын тюгел ауузлукъ билиб бошамагъанды
1.3 тюгел ёлмей
1.4 мен тюгел җетгинчи';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 94: word_id=0917 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 tügel alay tüldü
1.2 tay alqın tügel awuzluq bilib boşamağandı
1.3 tügel ölmey
1.4 men tügel cetginçi', updated_at = now() where word_id = '0917' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 tügel alay tüldü nemnogo
1.2 tay alqın tügel awuzluq bilib boşamağandı
1.3 tügel ölmey
1.4 men tügel cetginçi';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 95: word_id=0917 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 отну къармаргъа
2.1 ишде къармаргъа
3.1 ёчешиуде къармаргъа
4.1 урушда къармаргъа
4.2 онунчу классны къармагъанды
5.1 бачханы къармаргъа
5.2 ёлгенни къармаргъа
6.1 сокъур тёгерегин къармады', updated_at = now() where word_id = '0923' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 отну къармаргъа
2.1 ишде къармаргъа
3.1 ёчешиуде къармаргъа
4.1 урушда къармаргъъа
4.2 онунчу классны къармагъанды
5.1 бачханы къармаргъа
5.2 ёлгенни къармаргъа
6.1 сокъур тёгерегин къармады';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 96: word_id=0923 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 потушить огонь
2.1 подвести по работе
3.1 выиграть в споре
4.1 убить в бою
4.2 он окончил десятый класс
5.1 вскопать огород
5.2 похоронить умершего
6.1 слепой ощупал вокруг себя', updated_at = now() where word_id = '0923' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 потушить огонь
2.1 подвести по работе
3.1 выиграть в споре
4.1 убить в бою
4.2 он окончил десятый класс
5.1 вскопать огород
5.2 похоронить умершего
6.1 слепой ощу­пал вокруг себя';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 97: word_id=0923 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 спуститься с горы', updated_at = now() where word_id = '0934' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 спуститься горы';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 98: word_id=0934 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 сериуюн отда биширирге
2.1 сен не эсе да сериуюнсе бюгюн', updated_at = now() where word_id = '0935' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 сериуюн отда биширирге варить
2.1 сен не эсе да сериуюнсе бюгюн';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 99: word_id=0935 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 seriwün otda bişirirge
2.1 sen ne ese da seriwünse bügün', updated_at = now() where word_id = '0935' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 seriwün otda bişirirge varit
2.1 sen ne ese da seriwünse bügün';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 100: word_id=0935 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 варить на медленном огне
2.1 ты сегодня что-то печален', updated_at = now() where word_id = '0935' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 на медленном огне
2.1 ты сегодня что-то печален';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 101: word_id=0935 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 бурдюк с сыром
1.2 выпятив брюхо', updated_at = now() where word_id = '0964' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 бурдюк сыром
1.2 выпятив брюхо';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 102: word_id=0964 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 кефи бузулгъанды
1.2 не эсе да кефинг къолай тюлдю
1.3 кефи аман тюлдю
2.1 кефи барды', updated_at = now() where word_id = '0984' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 кефи бузулгъанды
1.2 не эсе да кефинг къолай тюлдю
1.3 кефи аман тюлдю';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 103: word_id=0984 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 kefi buzulğandı
1.2 ne ese da kefiñ qolay tüldü
1.3 kefi aman tüldü
2.1 kefi bardı', updated_at = now() where word_id = '0984' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 kefi buzulğandı
1.2 ne ese da kefiñ qolay tüldü
1.3 kefi aman tüldü';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 104: word_id=0984 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 у него испортилось настроение
1.2 что-то ты не в духе
1.3 вид у него неплохой
2.1 он под хмельком', updated_at = now() where word_id = '0984' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 у него испортилось настроение
1.2 что-то ты не в духе
1.3 вид у него неплохой';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 105: word_id=0984 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 җауун таймай җаууб турады', updated_at = now() where word_id = '0987' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 җауун таймай җаууб турады
1.2 таймаздан ишлеу
1.3 ол таймаздан ишлейди';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 106: word_id=0987 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 cawun taymay cawub turadı', updated_at = now() where word_id = '0987' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 cawun taymay cawub turadı
1.2 taymazdan işlew
1.3 ol taymazdan işleydi';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 107: word_id=0987 alan/turkic phrases_text'; end if;
  update public.content_word_texts set translation_text = 'постоянно, всегда, беспрерывно', updated_at = now() where word_id = '0987' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'постоянно, неуклонно, беспрерывно';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 108: word_id=0987 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 беспрерывно идёт дождь', updated_at = now() where word_id = '0987' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 беспрерывно идёт дождь
1.2 постоянная работа
1.3 он всё время работает';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 109: word_id=0987 ru/ phrases_text'; end if;
  update public.content_word_texts set translation_text = '1. желчь; 
2. смелость, храбрость (перен.)', updated_at = now() where word_id = '1000' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'желчь';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 110: word_id=1000 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 чюй бла бегитирге', updated_at = now() where word_id = '1011' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 чюй бла бегитирге прибить';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 111: word_id=1011 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 çüy bla begitirge', updated_at = now() where word_id = '1011' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 çüy bla begitirge pribit';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 112: word_id=1011 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 прибить, забить гвоздём', updated_at = now() where word_id = '1011' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 забить гвоздём';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 113: word_id=1011 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 ветер воет
1.2 мы услышали вой собаки', updated_at = now() where word_id = '1013' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 ветер воет
1.2 мы улсышали вой собаки';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 114: word_id=1013 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 гунч этерге', updated_at = now() where word_id = '1034' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 гунч этерге стереть кого';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 115: word_id=1034 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 gunç eterge', updated_at = now() where word_id = '1034' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 gunç eterge steret kogo';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 116: word_id=1034 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 стереть с лица земли, опустошить (как гунны - ист.)', updated_at = now() where word_id = '1034' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 что лица земли, опустошить что (как гунны)';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 117: word_id=1034 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къонгурау зынгырдайды
1.2 къонгурау къаргъаргъа', updated_at = now() where word_id = '1036' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къонгурау зынгырдайды
1.2 къонгурай къаргъаргъа';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 118: word_id=1036 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 qoñuraw zıñırdaydı
1.2 qoñuraw qarğarğa', updated_at = now() where word_id = '1036' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 qoñuraw zıñırdaydı
1.2 qoñuray qarğarğa';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 119: word_id=1036 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 суу җерге сингиб бошагъанды
1.2 сууукъ мени җилигиме дери сингнгенди
1.3 җангы адетле терк сингиб барадыла
1.4 ишге сингерге', updated_at = now() where word_id = '1055' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 суу җерге сингиб бошагъанды
1.2 ууукъ мени җилигиме дери сингнгенди
1.3 җангы адетле терк сингиб барадыла
1.4 ишге сингерге';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 120: word_id=1055 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 suw cerge siñib boşağandı
1.2 suwuq meni ciligime deri siññendi
1.3 cañı adetle terk siñib baradıla
1.4 işge siñerge', updated_at = now() where word_id = '1055' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 suw cerge siñib boşağandı
1.2 uwuq meni ciligime deri siññendi
1.3 cañı adetle terk siñib baradıla
1.4 işge siñerge';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 121: word_id=1055 alan/turkic phrases_text'; end if;
  update public.content_word_texts set translation_text = 'настороженный, встревоженный', updated_at = now() where word_id = '1056' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'настороженный, встревожженный';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 122: word_id=1056 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 у него красивый почерк', updated_at = now() where word_id = '1072' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 у него красивый почер';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 123: word_id=1072 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 фронтдан келгенлени аралатхандыла
3.1 бир бирлери бла аралашадыла', updated_at = now() where word_id = '1078' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 бир бирлери бла аралашадыла';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 124: word_id=1078 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 frontdan kelgenleni aralatxandıla
3.1 bir birleri bla aralaşadıla', updated_at = now() where word_id = '1078' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 bir birleri bla aralaşadıla';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 125: word_id=1078 alan/turkic phrases_text'; end if;
  update public.content_word_texts set translation_text = '1. окружать, брать в окружение; 
2. брать в оборот (перен.); 
3. перемежаться, чередоваться', updated_at = now() where word_id = '1078' and language_code = 'ru' and script_code = '' and translation_text is not distinct from 'перемежаться, чередоваться';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 126: word_id=1078 ru/ translation_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 окружили вернувшихся с фронта
3.1 они чередуются друг с другом', updated_at = now() where word_id = '1078' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 они чередуются друг с другом';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 127: word_id=1078 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къайдаса, айланма?
3.1 җолну айланмасы', updated_at = now() where word_id = '1081' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къайдаса, айланма?
2.1 җолну айланмасы';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 128: word_id=1081 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 qaydasa, aylanma?
3.1 colnu aylanması', updated_at = now() where word_id = '1081' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 qaydasa, aylanma?
2.1 colnu aylanması';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 129: word_id=1081 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 где ты, непоседа?
3.1 поворот дороги', updated_at = now() where word_id = '1081' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 где ты, непоседа?
2.1 поворот дороги';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 130: word_id=1081 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 җангылычларынга мюкюл болургъа
1.2 мюкюл этерге
1.3 ауузун мюкюл этерге', updated_at = now() where word_id = '1085' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 җангылычларынга мюкюл болургъа
1.2 мюкюл этеррге
1.3 ауузун мюкюл этерге';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 131: word_id=1085 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 cañılıçlarıña mükül bolurğa
1.2 mükül eterge
1.3 awuzun mükül eterge', updated_at = now() where word_id = '1085' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 cañılıçlarıña mükül bolurğa
1.2 mükül eterrge
1.3 awuzun mükül eterge';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 132: word_id=1085 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къагъанакъ сабий', updated_at = now() where word_id = '1086' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къагъъанакъ сабий';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 133: word_id=1086 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 намеренно
1.2 я дал себе зарок не ходить к ним', updated_at = now() where word_id = '1138' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 намеренно
1.2 я дал себе зарок не хо­дить к ним';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 134: word_id=1138 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 горемыка
1.2 ах, какой же он несчастный
1.3 этот несчастный умер от холода', updated_at = now() where word_id = '1148' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 горемыка
1.2 ах, какой-же он несчастный
1.3 этот несчастный умер от холода';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 135: word_id=1148 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 взять за рукав
1.2 манжета', updated_at = now() where word_id = '1177' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 взять зарукав
1.2 манжета';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 136: word_id=1177 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 наказать кого, расправиться с кем
1.2 это для нас большое наказание', updated_at = now() where word_id = '1192' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 наказать кого, расправиться кем
1.2 это для нас большое наказание';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 137: word_id=1192 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 кремень
1.2 без огнива трут не загорится, человек с посохом не споткнётся', updated_at = now() where word_id = '1196' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 кремень
1.2 без онива трут не загорится, человек с посохом не споткнётся';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 138: word_id=1196 ru/ phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 къошун аякъ
1.2 башы къошун юй', updated_at = now() where word_id = '2208' and language_code = 'alan' and script_code = 'cyrillic' and phrases_text is not distinct from '1.1 къошун аякъ
1.2 башы къошун юй дом';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 139: word_id=2208 alan/cyrillic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 qoşun ayaq
1.2 başı qoşun üy', updated_at = now() where word_id = '2208' and language_code = 'alan' and script_code = 'turkic' and phrases_text is not distinct from '1.1 qoşun ayaq
1.2 başı qoşun üy dom';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 140: word_id=2208 alan/turkic phrases_text'; end if;
  update public.content_word_texts set phrases_text = '1.1 глиняная чашка
1.2 дом, крытый черепицей', updated_at = now() where word_id = '2208' and language_code = 'ru' and script_code = '' and phrases_text is not distinct from '1.1 глиняная чашка
1.2 крытый черепицей';
  get diagnostics v_count = row_count;
  if v_count <> 1 then raise exception 'Guard failed on correction 141: word_id=2208 ru/ phrases_text'; end if;
end $$;
commit;
