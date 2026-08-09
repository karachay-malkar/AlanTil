begin;

-- Final approved story titles and introductions for the three interface languages.
-- Technical story IDs stay unchanged because navigation and progress persist them.
with story_copy(entity_id, name_ru, name_en, name_tr, intro_ru, intro_en, intro_tr) as (
values
  ('oblivion', $nru$На пороге забвения$nru$, $nen$On the Threshold of Oblivion$nen$, $ntr$Unutuluşun Eşiğinde$ntr$, $iru$Это история о последних мгновениях жизни языка. Она написана скупо — простыми словами и примитивными понятиями, до которых беднеет некогда богатая речь, прежде чем умолкнуть навсегда. Это её последнее дыхание. Дальше — только забвение.$iru$, $ien$This is the story of the final moments in the life of a language. It is written sparsely — in simple words and primitive concepts, to which a once-rich tongue is reduced before falling silent forever. This is its last breath. Beyond it lies only oblivion.$ien$, $itr$Bu, bir dilin ömrünün son anlarının hikâyesidir. Bir zamanlar zengin olan bir dilin sonsuza dek susmadan önce yoksullaştığı basit sözcükler ve ilkel kavramlarla, yalın bir dille yazılmıştır. Bu onun son nefesidir. Sonrası — yalnızca unutuluş.$itr$),
  ('roots', $nru$Возвращение к истокам$nru$, $nen$Back to the Roots$nen$, $ntr$Köklere Dönüş$ntr$, $iru$Ты чувствуешь это давно. Что-то в этой жизни не так.

Система обещает счастье, изобилие и свободу выбора, но снова и снова возвращает тебя в один и тот же круг — работать, потреблять, желать большего и продолжать бежать. Так проходят годы — растворяясь среди тысяч таких же странствующих судеб, ты постепенно забываешь, кто ты на самом деле.

Вырваться из этих крысиных бегов — настоящий подвиг. Но эта история не про подвиг тела, она про подвиг духа и разума — суметь вырваться из ловушки, вновь услышать себя и вернуться к своим корням, к своему подлинному «я».

Настало время действовать!$iru$, $ien$You have felt it for a long time. Something about this life is not right.

The system promises happiness, abundance, and freedom of choice, yet again and again it brings you back into the same cycle — to work, consume, want more, and keep running. Years pass this way — dissolving among thousands of other wandering lives like your own, you gradually forget who you really are.

Breaking free from this rat race is a true feat. But this story is not about a feat of the body; it is about a feat of spirit and mind — finding the strength to escape the trap, hear yourself again, and return to your roots, to your true self.

It is time to act!$ien$, $itr$Bunu uzun zamandır hissediyorsun. Bu hayatta bir şeyler yolunda değil.

Sistem mutluluk, bolluk ve seçme özgürlüğü vaat ediyor, ama seni tekrar tekrar aynı döngüye geri getiriyor — çalışmak, tüketmek, daha fazlasını istemek ve koşmaya devam etmek. Yıllar böyle geçiyor — senin gibi binlerce sürüklenen hayatın arasında eriyip giderken, aslında kim olduğunu yavaş yavaş unutuyorsun.

Bu fare yarışından kurtulmak gerçek bir kahramanlıktır. Ama bu hikâye bedenin kahramanlığıyla ilgili değil; ruhun ve zihnin kahramanlığıyla ilgili — tuzaktan çıkabilmek, kendini yeniden duyabilmek ve köklerine, gerçek benliğine dönebilmek.

Harekete geçme zamanı!$itr$),
  ('ascent', $nru$На вершине$nru$, $nen$At the Summit$nen$, $ntr$Zirvede$ntr$, $iru$Ты прошёл большой путь. Идя дорогой знаний, ты обрёл богатство и научился понимать речь этих мест. Шаг за шагом дорога поднимала тебя всё выше, приведя к нему.

Перед тобой — Минги-Тау. Вечная гора. Вызов для тех, кому мало достигнутого.

На его склонах знания по-настоящему уникальные. А взойдя на вершину, ты уже никогда не будешь прежним.

Если уверен в своих силах и чётко осознаёшь, зачем тебе это восхождение — в путь, на вершину!

Пусть Аллах поможет!$iru$, $ien$You have come a long way. Walking the road of knowledge, you have grown richer and learned to understand the speech of these lands. Step by step, the road has taken you higher and higher, leading you to him.

Before you stands Mingi-Tau. The eternal mountain. A challenge for those for whom what they have already achieved is not enough.

The knowledge on his slopes is truly unique. And once you reach the summit, you will never be the same again.

If you are confident in your strength and clearly understand why you need this ascent — set out, to the summit!

May Allah help you!$ien$, $itr$Uzun bir yol katettin. Bilginin yolunda yürürken zenginleştin ve bu toprakların dilini anlamayı öğrendin. Yol, adım adım seni daha da yükseğe çıkararak ona getirdi.

Karşında Mingi-Tau. Ebedî dağ. Elde ettikleriyle yetinmeyenler için bir meydan okuma.

Onun yamaçlarındaki bilgi gerçekten eşsizdir. Ve zirveye çıktığında artık asla eskisi gibi olmayacaksın.

Gücüne güveniyor ve bu tırmanışa neden ihtiyaç duyduğunu açıkça biliyorsan — yola çık, zirveye!

Allah yardımcın olsun!$itr$),
  ('pathways', $nru$Тропы$nru$, $nen$Trails$nen$, $ntr$Patikalar$ntr$, $iru$Не все дороги отмечены на картах.

Некоторые начинаются там, где заканчивается привычный путь, и ведут к вещам, которые открываются только тем, кто решился свернуть в сторону. Здесь можно встретить забытое, неожиданное, странное — то, мимо чего другие прошли, даже не заметив.

У каждой тропы своя тайна.

И узнать её можно лишь одним способом — пройдя по ней.$iru$, $ien$Not all roads are marked on maps.

Some begin where the familiar road ends and lead to things revealed only to those who dare to turn aside. Here you may encounter the forgotten, the unexpected, the strange — things others passed by without even noticing.

Every trail has a secret of its own.

And there is only one way to discover it — by walking it.$ien$, $itr$Her yol haritalarda işaretli değildir.

Bazıları alışılmış yolun bittiği yerde başlar ve ancak yolundan ayrılmaya cesaret edenlere açılan şeylere götürür. Burada unutulmuş, beklenmedik, tuhaf şeylerle karşılaşabilirsin — başkalarının farkına bile varmadan yanından geçtiği şeylerle.

Her patikanın kendine ait bir sırrı vardır.

Ve onu öğrenmenin yalnızca bir yolu vardır — o patikadan geçmek.$itr$)
)
update public.content_structure story
set name_ru = story_copy.name_ru,
    name_en = story_copy.name_en,
    name_tr = story_copy.name_tr,
    intro_ru = story_copy.intro_ru,
    intro_en = story_copy.intro_en,
    intro_tr = story_copy.intro_tr,
    updated_at = now()
from story_copy
where story.entity_id = story_copy.entity_id
  and story.entity_type = 'story';

-- Force clients with the 13.14 dictionary snapshot to download the updated story data.
update public.dictionary_metadata
set current_version = '13.15.0'
where dictionary_key = 'main';

do $validation$
declare
  localized_story_count integer;
  invalid_story_count integer;
begin
  select count(*)
    into localized_story_count
  from public.content_structure
  where entity_type = 'story'
    and entity_id in ('oblivion', 'roots', 'ascent', 'pathways')
    and nullif(btrim(name_ru), '') is not null
    and nullif(btrim(name_en), '') is not null
    and nullif(btrim(name_tr), '') is not null
    and nullif(btrim(intro_ru), '') is not null
    and nullif(btrim(intro_en), '') is not null
    and nullif(btrim(intro_tr), '') is not null;

  if localized_story_count <> 4 then
    raise exception 'Expected 4 fully localized stories, got %', localized_story_count;
  end if;

  with expected(entity_id, name_ru, name_en, name_tr, intro_ru, intro_en, intro_tr) as (
  values
  ('oblivion', $nru$На пороге забвения$nru$, $nen$On the Threshold of Oblivion$nen$, $ntr$Unutuluşun Eşiğinde$ntr$, $iru$Это история о последних мгновениях жизни языка. Она написана скупо — простыми словами и примитивными понятиями, до которых беднеет некогда богатая речь, прежде чем умолкнуть навсегда. Это её последнее дыхание. Дальше — только забвение.$iru$, $ien$This is the story of the final moments in the life of a language. It is written sparsely — in simple words and primitive concepts, to which a once-rich tongue is reduced before falling silent forever. This is its last breath. Beyond it lies only oblivion.$ien$, $itr$Bu, bir dilin ömrünün son anlarının hikâyesidir. Bir zamanlar zengin olan bir dilin sonsuza dek susmadan önce yoksullaştığı basit sözcükler ve ilkel kavramlarla, yalın bir dille yazılmıştır. Bu onun son nefesidir. Sonrası — yalnızca unutuluş.$itr$),
  ('roots', $nru$Возвращение к истокам$nru$, $nen$Back to the Roots$nen$, $ntr$Köklere Dönüş$ntr$, $iru$Ты чувствуешь это давно. Что-то в этой жизни не так.

Система обещает счастье, изобилие и свободу выбора, но снова и снова возвращает тебя в один и тот же круг — работать, потреблять, желать большего и продолжать бежать. Так проходят годы — растворяясь среди тысяч таких же странствующих судеб, ты постепенно забываешь, кто ты на самом деле.

Вырваться из этих крысиных бегов — настоящий подвиг. Но эта история не про подвиг тела, она про подвиг духа и разума — суметь вырваться из ловушки, вновь услышать себя и вернуться к своим корням, к своему подлинному «я».

Настало время действовать!$iru$, $ien$You have felt it for a long time. Something about this life is not right.

The system promises happiness, abundance, and freedom of choice, yet again and again it brings you back into the same cycle — to work, consume, want more, and keep running. Years pass this way — dissolving among thousands of other wandering lives like your own, you gradually forget who you really are.

Breaking free from this rat race is a true feat. But this story is not about a feat of the body; it is about a feat of spirit and mind — finding the strength to escape the trap, hear yourself again, and return to your roots, to your true self.

It is time to act!$ien$, $itr$Bunu uzun zamandır hissediyorsun. Bu hayatta bir şeyler yolunda değil.

Sistem mutluluk, bolluk ve seçme özgürlüğü vaat ediyor, ama seni tekrar tekrar aynı döngüye geri getiriyor — çalışmak, tüketmek, daha fazlasını istemek ve koşmaya devam etmek. Yıllar böyle geçiyor — senin gibi binlerce sürüklenen hayatın arasında eriyip giderken, aslında kim olduğunu yavaş yavaş unutuyorsun.

Bu fare yarışından kurtulmak gerçek bir kahramanlıktır. Ama bu hikâye bedenin kahramanlığıyla ilgili değil; ruhun ve zihnin kahramanlığıyla ilgili — tuzaktan çıkabilmek, kendini yeniden duyabilmek ve köklerine, gerçek benliğine dönebilmek.

Harekete geçme zamanı!$itr$),
  ('ascent', $nru$На вершине$nru$, $nen$At the Summit$nen$, $ntr$Zirvede$ntr$, $iru$Ты прошёл большой путь. Идя дорогой знаний, ты обрёл богатство и научился понимать речь этих мест. Шаг за шагом дорога поднимала тебя всё выше, приведя к нему.

Перед тобой — Минги-Тау. Вечная гора. Вызов для тех, кому мало достигнутого.

На его склонах знания по-настоящему уникальные. А взойдя на вершину, ты уже никогда не будешь прежним.

Если уверен в своих силах и чётко осознаёшь, зачем тебе это восхождение — в путь, на вершину!

Пусть Аллах поможет!$iru$, $ien$You have come a long way. Walking the road of knowledge, you have grown richer and learned to understand the speech of these lands. Step by step, the road has taken you higher and higher, leading you to him.

Before you stands Mingi-Tau. The eternal mountain. A challenge for those for whom what they have already achieved is not enough.

The knowledge on his slopes is truly unique. And once you reach the summit, you will never be the same again.

If you are confident in your strength and clearly understand why you need this ascent — set out, to the summit!

May Allah help you!$ien$, $itr$Uzun bir yol katettin. Bilginin yolunda yürürken zenginleştin ve bu toprakların dilini anlamayı öğrendin. Yol, adım adım seni daha da yükseğe çıkararak ona getirdi.

Karşında Mingi-Tau. Ebedî dağ. Elde ettikleriyle yetinmeyenler için bir meydan okuma.

Onun yamaçlarındaki bilgi gerçekten eşsizdir. Ve zirveye çıktığında artık asla eskisi gibi olmayacaksın.

Gücüne güveniyor ve bu tırmanışa neden ihtiyaç duyduğunu açıkça biliyorsan — yola çık, zirveye!

Allah yardımcın olsun!$itr$),
  ('pathways', $nru$Тропы$nru$, $nen$Trails$nen$, $ntr$Patikalar$ntr$, $iru$Не все дороги отмечены на картах.

Некоторые начинаются там, где заканчивается привычный путь, и ведут к вещам, которые открываются только тем, кто решился свернуть в сторону. Здесь можно встретить забытое, неожиданное, странное — то, мимо чего другие прошли, даже не заметив.

У каждой тропы своя тайна.

И узнать её можно лишь одним способом — пройдя по ней.$iru$, $ien$Not all roads are marked on maps.

Some begin where the familiar road ends and lead to things revealed only to those who dare to turn aside. Here you may encounter the forgotten, the unexpected, the strange — things others passed by without even noticing.

Every trail has a secret of its own.

And there is only one way to discover it — by walking it.$ien$, $itr$Her yol haritalarda işaretli değildir.

Bazıları alışılmış yolun bittiği yerde başlar ve ancak yolundan ayrılmaya cesaret edenlere açılan şeylere götürür. Burada unutulmuş, beklenmedik, tuhaf şeylerle karşılaşabilirsin — başkalarının farkına bile varmadan yanından geçtiği şeylerle.

Her patikanın kendine ait bir sırrı vardır.

Ve onu öğrenmenin yalnızca bir yolu vardır — o patikadan geçmek.$itr$)
  )
  select count(*)
    into invalid_story_count
  from expected
  left join public.content_structure story
    on story.entity_id = expected.entity_id
   and story.entity_type = 'story'
  where story.entity_id is null
     or story.name_ru is distinct from expected.name_ru
     or story.name_en is distinct from expected.name_en
     or story.name_tr is distinct from expected.name_tr
     or story.intro_ru is distinct from expected.intro_ru
     or story.intro_en is distinct from expected.intro_en
     or story.intro_tr is distinct from expected.intro_tr;

  if invalid_story_count <> 0 then
    raise exception 'Story localization validation failed for % stories', invalid_story_count;
  end if;
end
$validation$;

commit;
