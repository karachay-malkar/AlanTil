import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeWordEntry } from "../src/shared/domain/word-structure-compat.js";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const STORIES = Object.freeze({
  oblivion: {
    names: { ru: `На пороге забвения`, en: `On the Threshold of Oblivion`, tr: `Unutuluşun Eşiğinde` },
    intros: { ru: `Это история о последних мгновениях жизни языка. Она написана скупо — простыми словами и примитивными понятиями, до которых беднеет некогда богатая речь, прежде чем умолкнуть навсегда. Это её последнее дыхание. Дальше — только забвение.`, en: `This is the story of the final moments in the life of a language. It is written sparsely — in simple words and primitive concepts, to which a once-rich tongue is reduced before falling silent forever. This is its last breath. Beyond it lies only oblivion.`, tr: `Bu, bir dilin ömrünün son anlarının hikâyesidir. Bir zamanlar zengin olan bir dilin sonsuza dek susmadan önce yoksullaştığı basit sözcükler ve ilkel kavramlarla, yalın bir dille yazılmıştır. Bu onun son nefesidir. Sonrası — yalnızca unutuluş.` },
  },
  roots: {
    names: { ru: `Возвращение к истокам`, en: `Back to the Roots`, tr: `Köklere Dönüş` },
    intros: { ru: `Ты чувствуешь это давно. Что-то в этой жизни не так.

Система обещает счастье, изобилие и свободу выбора, но снова и снова возвращает тебя в один и тот же круг — работать, потреблять, желать большего и продолжать бежать. Так проходят годы — растворяясь среди тысяч таких же странствующих судеб, ты постепенно забываешь, кто ты на самом деле.

Вырваться из этих крысиных бегов — настоящий подвиг. Но эта история не про подвиг тела, она про подвиг духа и разума — суметь вырваться из ловушки, вновь услышать себя и вернуться к своим корням, к своему подлинному «я».

Настало время действовать!`, en: `You have felt it for a long time. Something about this life is not right.

The system promises happiness, abundance, and freedom of choice, yet again and again it brings you back into the same cycle — to work, consume, want more, and keep running. Years pass this way — dissolving among thousands of other wandering lives like your own, you gradually forget who you really are.

Breaking free from this rat race is a true feat. But this story is not about a feat of the body; it is about a feat of spirit and mind — finding the strength to escape the trap, hear yourself again, and return to your roots, to your true self.

It is time to act!`, tr: `Bunu uzun zamandır hissediyorsun. Bu hayatta bir şeyler yolunda değil.

Sistem mutluluk, bolluk ve seçme özgürlüğü vaat ediyor, ama seni tekrar tekrar aynı döngüye geri getiriyor — çalışmak, tüketmek, daha fazlasını istemek ve koşmaya devam etmek. Yıllar böyle geçiyor — senin gibi binlerce sürüklenen hayatın arasında eriyip giderken, aslında kim olduğunu yavaş yavaş unutuyorsun.

Bu fare yarışından kurtulmak gerçek bir kahramanlıktır. Ama bu hikâye bedenin kahramanlığıyla ilgili değil; ruhun ve zihnin kahramanlığıyla ilgili — tuzaktan çıkabilmek, kendini yeniden duyabilmek ve köklerine, gerçek benliğine dönebilmek.

Harekete geçme zamanı!` },
  },
  ascent: {
    names: { ru: `На вершине`, en: `At the Summit`, tr: `Zirvede` },
    intros: { ru: `Ты прошёл большой путь. Идя дорогой знаний, ты обрёл богатство и научился понимать речь этих мест. Шаг за шагом дорога поднимала тебя всё выше, приведя к нему.

Перед тобой — Минги-Тау. Вечная гора. Вызов для тех, кому мало достигнутого.

На его склонах знания по-настоящему уникальные. А взойдя на вершину, ты уже никогда не будешь прежним.

Если уверен в своих силах и чётко осознаёшь, зачем тебе это восхождение — в путь, на вершину!

Пусть Аллах поможет!`, en: `You have come a long way. Walking the road of knowledge, you have grown richer and learned to understand the speech of these lands. Step by step, the road has taken you higher and higher, leading you to him.

Before you stands Mingi-Tau. The eternal mountain. A challenge for those for whom what they have already achieved is not enough.

The knowledge on his slopes is truly unique. And once you reach the summit, you will never be the same again.

If you are confident in your strength and clearly understand why you need this ascent — set out, to the summit!

May Allah help you!`, tr: `Uzun bir yol katettin. Bilginin yolunda yürürken zenginleştin ve bu toprakların dilini anlamayı öğrendin. Yol, adım adım seni daha da yükseğe çıkararak ona getirdi.

Karşında Mingi-Tau. Ebedî dağ. Elde ettikleriyle yetinmeyenler için bir meydan okuma.

Onun yamaçlarındaki bilgi gerçekten eşsizdir. Ve zirveye çıktığında artık asla eskisi gibi olmayacaksın.

Gücüne güveniyor ve bu tırmanışa neden ihtiyaç duyduğunu açıkça biliyorsan — yola çık, zirveye!

Allah yardımcın olsun!` },
  },
  pathways: {
    names: { ru: `Тропы`, en: `Trails`, tr: `Patikalar` },
    intros: { ru: `Не все дороги отмечены на картах.

Некоторые начинаются там, где заканчивается привычный путь, и ведут к вещам, которые открываются только тем, кто решился свернуть в сторону. Здесь можно встретить забытое, неожиданное, странное — то, мимо чего другие прошли, даже не заметив.

У каждой тропы своя тайна.

И узнать её можно лишь одним способом — пройдя по ней.`, en: `Not all roads are marked on maps.

Some begin where the familiar road ends and lead to things revealed only to those who dare to turn aside. Here you may encounter the forgotten, the unexpected, the strange — things others passed by without even noticing.

Every trail has a secret of its own.

And there is only one way to discover it — by walking it.`, tr: `Her yol haritalarda işaretli değildir.

Bazıları alışılmış yolun bittiği yerde başlar ve ancak yolundan ayrılmaya cesaret edenlere açılan şeylere götürür. Burada unutulmuş, beklenmedik, tuhaf şeylerle karşılaşabilirsin — başkalarının farkına bile varmadan yanından geçtiği şeylerle.

Her patikanın kendine ait bir sırrı vardır.

Ve onu öğrenmenin yalnızca bir yolu vardır — o patikadan geçmek.` },
  },
});

const STRUCTURE = Object.freeze({
  oblivion: { dictionaryId: "beginner", sectionId: "beginner-starter", setId: "beginner-01" },
  roots: { dictionaryId: "intermediate", sectionId: "intermediate-intermediate", setId: "intermediate-01" },
  ascent: { dictionaryId: "advanced", sectionId: "advanced-advanced", setId: "advanced-01" },
  pathways: { dictionaryId: "thematic", sectionId: "universe", setId: "universe-01" },
});

test("13.15 migration stores the four final story texts in ru/en/tr", async () => {
  const migration = await read("supabase/migrations/20260809140700_alantil_13_15_story_localization.sql");
  for (const story of Object.values(STORIES)) {
    for (const value of Object.values(story.names)) assert.ok(migration.includes(value));
    for (const value of Object.values(story.intros)) assert.ok(migration.includes(value));
  }
  assert.match(migration, /current_version = '13\.15\.0'/);
  assert.match(migration, /Expected 4 fully localized stories/);
});

test("13.15 compatibility fallback exposes the same final story texts", () => {
  for (const [storyId, story] of Object.entries(STORIES)) {
    const scope = STRUCTURE[storyId];
    const word = normalizeWordEntry({
      id: `story-test-${storyId}`,
      storyId,
      dictionaryId: scope.dictionaryId,
      sectionId: scope.sectionId,
      setId: scope.setId,
      wordAlanCyrillic: "тест",
      translationRu: "тест",
    });
    assert.equal(word.storyNameRu, story.names.ru);
    assert.equal(word.storyNameEn, story.names.en);
    assert.equal(word.storyNameTr, story.names.tr);
    assert.equal(word.storyIntroRu, story.intros.ru);
    assert.equal(word.storyIntroEn, story.intros.en);
    assert.equal(word.storyIntroTr, story.intros.tr);
  }
});

test("the old ascent title is no longer the 13.15 compatibility title", async () => {
  const adapter = await read("src/shared/domain/word-structure-compat.js");
  assert.doesNotMatch(adapter, /ascent:\s*\{[\s\S]*?ru:\s*\{\s*name:\s*"Восхождение"/);
  assert.match(adapter, /ascent:\s*\{[\s\S]*?name:\s*"На вершине"/);
});
