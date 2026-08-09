import * as base from "./word-normalizer.js?v=13.15&base=1";

const THEMATIC_SECTIONS = new Set(["universe", "animals", "natural_materials", "plants"]);

const STORY_CONTENT = Object.freeze({
  oblivion: {
    ru: { name: "На пороге забвения", intro: "Это история о последних мгновениях жизни языка. Она написана скупо — простыми словами и примитивными понятиями, до которых беднеет некогда богатая речь, прежде чем умолкнуть навсегда. Это её последнее дыхание. Дальше — только забвение." },
    en: { name: "On the Threshold of Oblivion", intro: "This is the story of the final moments in the life of a language. It is written sparsely — in simple words and primitive concepts, to which a once-rich tongue is reduced before falling silent forever. This is its last breath. Beyond it lies only oblivion." },
    tr: { name: "Unutuluşun Eşiğinde", intro: "Bu, bir dilin ömrünün son anlarının hikâyesidir. Bir zamanlar zengin olan bir dilin sonsuza dek susmadan önce yoksullaştığı basit sözcükler ve ilkel kavramlarla, yalın bir dille yazılmıştır. Bu onun son nefesidir. Sonrası — yalnızca unutuluş." },
  },
  roots: {
    ru: { name: "Возвращение к истокам", intro: "Ты чувствуешь это давно. Что-то в этой жизни не так.\n\nСистема обещает счастье, изобилие и свободу выбора, но снова и снова возвращает тебя в один и тот же круг — работать, потреблять, желать большего и продолжать бежать. Так проходят годы — растворяясь среди тысяч таких же странствующих судеб, ты постепенно забываешь, кто ты на самом деле.\n\nВырваться из этих крысиных бегов — настоящий подвиг. Но эта история не про подвиг тела, она про подвиг духа и разума — суметь вырваться из ловушки, вновь услышать себя и вернуться к своим корням, к своему подлинному «я».\n\nНастало время действовать!" },
    en: { name: "Back to the Roots", intro: "You have felt it for a long time. Something about this life is not right.\n\nThe system promises happiness, abundance, and freedom of choice, yet again and again it brings you back into the same cycle — to work, consume, want more, and keep running. Years pass this way — dissolving among thousands of other wandering lives like your own, you gradually forget who you really are.\n\nBreaking free from this rat race is a true feat. But this story is not about a feat of the body; it is about a feat of spirit and mind — finding the strength to escape the trap, hear yourself again, and return to your roots, to your true self.\n\nIt is time to act!" },
    tr: { name: "Köklere Dönüş", intro: "Bunu uzun zamandır hissediyorsun. Bu hayatta bir şeyler yolunda değil.\n\nSistem mutluluk, bolluk ve seçme özgürlüğü vaat ediyor, ama seni tekrar tekrar aynı döngüye geri getiriyor — çalışmak, tüketmek, daha fazlasını istemek ve koşmaya devam etmek. Yıllar böyle geçiyor — senin gibi binlerce sürüklenen hayatın arasında eriyip giderken, aslında kim olduğunu yavaş yavaş unutuyorsun.\n\nBu fare yarışından kurtulmak gerçek bir kahramanlıktır. Ama bu hikâye bedenin kahramanlığıyla ilgili değil; ruhun ve zihnin kahramanlığıyla ilgili — tuzaktan çıkabilmek, kendini yeniden duyabilmek ve köklerine, gerçek benliğine dönebilmek.\n\nHarekete geçme zamanı!" },
  },
  ascent: {
    ru: { name: "На вершине", intro: "Ты прошёл большой путь. Идя дорогой знаний, ты обрёл богатство и научился понимать речь этих мест. Шаг за шагом дорога поднимала тебя всё выше, приведя к нему.\n\nПеред тобой — Минги-Тау. Вечная гора. Вызов для тех, кому мало достигнутого.\n\nНа его склонах знания по-настоящему уникальные. А взойдя на вершину, ты уже никогда не будешь прежним.\n\nЕсли уверен в своих силах и чётко осознаёшь, зачем тебе это восхождение — в путь, на вершину!\n\nПусть Аллах поможет!" },
    en: { name: "At the Summit", intro: "You have come a long way. Walking the road of knowledge, you have grown richer and learned to understand the speech of these lands. Step by step, the road has taken you higher and higher, leading you to him.\n\nBefore you stands Mingi-Tau. The eternal mountain. A challenge for those for whom what they have already achieved is not enough.\n\nThe knowledge on his slopes is truly unique. And once you reach the summit, you will never be the same again.\n\nIf you are confident in your strength and clearly understand why you need this ascent — set out, to the summit!\n\nMay Allah help you!" },
    tr: { name: "Zirvede", intro: "Uzun bir yol katettin. Bilginin yolunda yürürken zenginleştin ve bu toprakların dilini anlamayı öğrendin. Yol, adım adım seni daha da yükseğe çıkararak ona getirdi.\n\nKarşında Mingi-Tau. Ebedî dağ. Elde ettikleriyle yetinmeyenler için bir meydan okuma.\n\nOnun yamaçlarındaki bilgi gerçekten eşsizdir. Ve zirveye çıktığında artık asla eskisi gibi olmayacaksın.\n\nGücüne güveniyor ve bu tırmanışa neden ihtiyaç duyduğunu açıkça biliyorsan — yola çık, zirveye!\n\nAllah yardımcın olsun!" },
  },
  pathways: {
    ru: { name: "Тропы", intro: "Не все дороги отмечены на картах.\n\nНекоторые начинаются там, где заканчивается привычный путь, и ведут к вещам, которые открываются только тем, кто решился свернуть в сторону. Здесь можно встретить забытое, неожиданное, странное — то, мимо чего другие прошли, даже не заметив.\n\nУ каждой тропы своя тайна.\n\nИ узнать её можно лишь одним способом — пройдя по ней." },
    en: { name: "Trails", intro: "Not all roads are marked on maps.\n\nSome begin where the familiar road ends and lead to things revealed only to those who dare to turn aside. Here you may encounter the forgotten, the unexpected, the strange — things others passed by without even noticing.\n\nEvery trail has a secret of its own.\n\nAnd there is only one way to discover it — by walking it." },
    tr: { name: "Patikalar", intro: "Her yol haritalarda işaretli değildir.\n\nBazıları alışılmış yolun bittiği yerde başlar ve ancak yolundan ayrılmaya cesaret edenlere açılan şeylere götürür. Burada unutulmuş, beklenmedik, tuhaf şeylerle karşılaşabilirsin — başkalarının farkına bile varmadan yanından geçtiği şeylerle.\n\nHer patikanın kendine ait bir sırrı vardır.\n\nVe onu öğrenmenin yalnızca bir yolu vardır — o patikadan geçmek." },
  }
});

const DICTIONARY_NAMES = Object.freeze({
  beginner: { ru: "Начальный", en: "Beginner", tr: "Başlangıç" },
  intermediate: { ru: "Средний", en: "Intermediate", tr: "Orta" },
  advanced: { ru: "Продвинутый", en: "Advanced", tr: "İleri Seviye" },
  thematic: { ru: "Тематические слова", en: "Thematic Words", tr: "Tematik Kelimeler" },
});

const SECTION_NAMES = Object.freeze({
  "beginner-starter": { ru: "Вводный", en: "Starter", tr: "Başlangıç", alanCyrillic: "Башланыу", alanTurkic: "Başlanıw" },
  "beginner-elementary": { ru: "Базовый", en: "Elementary", tr: "Temel", alanCyrillic: "Тамал", alanTurkic: "Tamal" },
  "intermediate-intermediate": { ru: "Средний", en: "Intermediate", tr: "Orta", alanCyrillic: "Орта", alanTurkic: "Orta" },
  "intermediate-upper-intermediate": { ru: "Выше среднего", en: "Upper-Intermediate", tr: "Orta Üstü", alanCyrillic: "Ортадан ёрге", alanTurkic: "Ortadan örge" },
  "advanced-advanced": { ru: "Продвинутый", en: "Advanced", tr: "İleri", alanCyrillic: "Къыйын дараҗа", alanTurkic: "Qıyın daraca" },
  "advanced-proficiency": { ru: "Мастер", en: "Proficiency", tr: "Usta", alanCyrillic: "Уста", alanTurkic: "Usta" },
  universe: { ru: "Вселенная", en: "Universe", tr: "Evren", alanCyrillic: "Алам", alanTurkic: "Alam" },
  animals: { ru: "Животные", en: "Animals", tr: "Hayvanlar", alanCyrillic: "Җаныуарла", alanTurkic: "Canıwarla" },
  natural_materials: { ru: "Природные материалы", en: "Natural Materials", tr: "Doğal Malzemeler", alanCyrillic: "Табийгъат материалла", alanTurkic: "Tabiyğat materialla" },
  plants: { ru: "Растения", en: "Plants", tr: "Bitkiler", alanCyrillic: "Гяхинле", alanTurkic: "Gyaxinle" },
});

const SET_NAMES = Object.freeze({
  "universe-01": { ru: "Времена года", en: "Seasons", tr: "Mevsimler" },
  "universe-02": { ru: "Месяцы года", en: "Months of the Year", tr: "Yılın Ayları" },
  "universe-03": { ru: "Дни недели", en: "Days of the Week", tr: "Haftanın Günleri" },
  "universe-04": { ru: "Космос", en: "Space", tr: "Uzay" },
  "universe-05": { ru: "Цвета", en: "Colours", tr: "Renkler" },
  "animals-01": { ru: "Водная фауна", en: "Aquatic Fauna", tr: "Su Faunası" },
  "animals-02": { ru: "Всеядные, травоядные и грызуны", en: "Omnivores, Herbivores and Rodents", tr: "Hepçiller, Otçullar ve Kemirgenler" },
  "animals-03": { ru: "Домашние животные", en: "Domestic Animals", tr: "Evcil Hayvanlar" },
  "animals-04": { ru: "Земноводные и рептилии", en: "Amphibians and Reptiles", tr: "İki Yaşamlılar ve Sürüngenler" },
  "animals-05": { ru: "Пауки, черви и насекомые", en: "Spiders, Worms and Insects", tr: "Örümcekler, Solucanlar ve Böcekler" },
  "animals-06": { ru: "Приматы и сумчатые", en: "Primates and Marsupials", tr: "Primatlar ve Keseliler" },
  "animals-07": { ru: "Птицы", en: "Birds", tr: "Kuşlar" },
  "animals-08": { ru: "Хищники и млекопитающие", en: "Predators and Mammals", tr: "Yırtıcılar ve Memeliler" },
  "natural_materials-01": { ru: "Горные породы", en: "Rocks", tr: "Kayaçlar" },
  "natural_materials-02": { ru: "Металлы", en: "Metals", tr: "Metaller" },
  "natural_materials-03": { ru: "Минералы", en: "Minerals", tr: "Mineraller" },
  "natural_materials-04": { ru: "Неметаллы", en: "Non-metals", tr: "Ametaller" },
  "natural_materials-05": { ru: "Другие материалы", en: "Other Materials", tr: "Diğer Malzemeler" },
  "plants-01": { ru: "Деревья", en: "Trees", tr: "Ağaçlar" },
  "plants-02": { ru: "Орехи, злаки и бобовые", en: "Nuts, Grains and Legumes", tr: "Kuruyemişler, Tahıllar ve Baklagiller" },
  "plants-03": { ru: "Другие растения", en: "Other Plants", tr: "Diğer Bitkiler" },
  "plants-04": { ru: "Специи и зелень", en: "Spices and Herbs", tr: "Baharatlar ve Yeşillikler" },
  "plants-05": { ru: "Фрукты, овощи", en: "Fruit and Vegetables", tr: "Meyveler ve Sebzeler" },
  "plants-06": { ru: "Цветы", en: "Flowers", tr: "Çiçekler" },
  "plants-07": { ru: "Ягоды и кустарники", en: "Berries and Shrubs", tr: "Meyveler ve Çalılar" },
});

function applyNames(word, storyId, dictionaryId, sectionId, setId) {
  const story = STORY_CONTENT[storyId];
  const dictionary = DICTIONARY_NAMES[dictionaryId];
  const section = SECTION_NAMES[sectionId];
  const set = SET_NAMES[setId];
  return {
    ...word,
    ...(story ? {
      storyNameRu: story.ru.name,
      storyNameEn: story.en.name,
      storyNameTr: story.tr.name,
      storyIntroRu: story.ru.intro,
      storyIntroEn: story.en.intro,
      storyIntroTr: story.tr.intro,
      story_name: story.ru.name,
      story_intro: story.ru.intro,
    } : {}),
    ...(dictionary ? {
      dictionaryNameRu: dictionary.ru,
      dictionaryNameEn: dictionary.en,
      dictionaryNameTr: dictionary.tr,
      dictionary_name: dictionary.ru,
      dict: dictionary.ru,
    } : {}),
    ...(section ? {
      sectionNameRu: section.ru,
      sectionNameEn: section.en,
      sectionNameTr: section.tr,
      sectionNameAlanCyrillic: section.alanCyrillic || "",
      sectionNameAlanTurkic: section.alanTurkic || "",
      section_name: section.ru,
      section: section.ru,
    } : {}),
    ...(set ? {
      setNameRu: set.ru,
      setNameEn: set.en,
      setNameTr: set.tr,
      set_name: set.ru,
      set: set.ru,
    } : {}),
  };
}

function adaptStructure(word) {
  if (!word || typeof word !== "object") return word;
  let dictionaryId = String(word.dictionaryId || word.dictionary_id || "").trim();
  let sectionId = String(word.sectionId || word.section_id || "").trim();
  const setId = String(word.setId || word.set_id || "").trim();
  let storyId = String(word.storyId || word.story_id || word.story_type || "").trim();

  if (THEMATIC_SECTIONS.has(dictionaryId)) {
    sectionId = dictionaryId;
    dictionaryId = "thematic";
    storyId = "pathways";
  }

  const structural = {
    ...word,
    dictionaryId,
    dictionary_id: dictionaryId,
    catalog_id: dictionaryId,
    sectionId,
    section_id: sectionId,
    group_id: sectionId,
    storyId,
    story_id: storyId,
    story_type: storyId,
  };
  return applyNames(structural, storyId, dictionaryId, sectionId, setId);
}

export const normalizeId = base.normalizeId;
export const normalizePos = base.normalizePos;
export const parseSynonyms = base.parseSynonyms;
export const parseUsedInTest = base.parseUsedInTest;
export const permanentSectionId = base.permanentSectionId;
export const storyIdForDictionary = base.storyIdForDictionary;

export function normalizeSupabaseWordEntry(row, story = null) {
  return base.normalizeSupabaseWordEntry(row, story);
}

export function normalizeLegacyWordEntry(row) {
  return adaptStructure(base.normalizeLegacyWordEntry(row));
}

export function normalizeWordEntry(row, options = {}) {
  return adaptStructure(base.normalizeWordEntry(row, options));
}
