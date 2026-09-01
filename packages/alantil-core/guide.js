export const GUIDE_STORY_SEQUENCE = Object.freeze(["oblivion", "roots", "ascent", "pathways"]);

export const GENERAL_GUIDE_STEPS = Object.freeze([
  Object.freeze({ id: "intro", titleKey: "guide.general.intro.title", bodyKey: "guide.general.intro.body", symbol: "A" }),
  Object.freeze({ id: "stories", titleKey: "guide.general.stories.title", bodyKey: "guide.general.stories.body", symbol: "☰" }),
  Object.freeze({ id: "story-oblivion", titleKey: "guide.story.oblivion.title", bodyKey: "guide.story.oblivion.body", symbol: "◇" }),
  Object.freeze({ id: "story-roots", titleKey: "guide.story.roots.title", bodyKey: "guide.story.roots.body", symbol: "◇" }),
  Object.freeze({ id: "story-ascent", titleKey: "guide.story.ascent.title", bodyKey: "guide.story.ascent.body", symbol: "◇" }),
  Object.freeze({ id: "story-pathways", titleKey: "guide.story.pathways.title", bodyKey: "guide.story.pathways.body", symbol: "◇" }),
  Object.freeze({ id: "summary", titleKey: "guide.general.summary.title", bodyKey: "guide.general.summary.body", symbol: "⌃" }),
  Object.freeze({ id: "stages", titleKey: "guide.general.stages.title", bodyKey: "guide.general.stages.body", symbol: "7/12" }),
  Object.freeze({ id: "study", titleKey: "guide.general.study.title", bodyKey: "guide.general.study.body", symbol: "↻" }),
  Object.freeze({ id: "test", titleKey: "guide.general.test.title", bodyKey: "guide.general.test.body", symbol: "✓", params: Object.freeze({ required: 80 }) }),
]);

export const LEARNING_GUIDE_STEPS = Object.freeze([
  Object.freeze({ id: "card", titleKey: "guide.learning.card.title", bodyKey: "guide.learning.card.body" }),
  Object.freeze({ id: "translation", titleKey: "guide.learning.translation.title", bodyKey: "guide.learning.translation.body" }),
  Object.freeze({ id: "decision", titleKey: "guide.learning.decision.title", bodyKey: "guide.learning.decision.body" }),
  Object.freeze({ id: "counter", titleKey: "guide.learning.counter.title", bodyKey: "guide.learning.counter.body" }),
  Object.freeze({ id: "favorite", titleKey: "guide.learning.favorite.title", bodyKey: "guide.learning.favorite.body" }),
]);

export const LEARNING_REPEAT_HINT = Object.freeze({ id: "repeat", titleKey: "guide.learning.repeat.title", bodyKey: "guide.learning.repeat.body" });

export const GUIDE_MESSAGES = Object.freeze({
  "guide.general.intro.title": Object.freeze({ ru: "Ассаламу алейкум, алан!", en: "Assalamu alaikum, alan!", tr: "Selamünaleyküm, alan!" }),
  "guide.general.intro.body": Object.freeze({ ru: "<p>Это приложение создано для изучения аланских (карачаево-балкарских) слов и расширения словарного запаса.</p><p>Учи новые слова, а затем старайся использовать их в повседневной жизни. <strong>Только тогда твоя речь действительно станет богаче, и ты увидишь свой прогресс.</strong></p>", en: "<p>This app is designed to help you learn Alan (Karachay-Balkar) words and expand your vocabulary.</p><p>Learn new words, then try to use them in everyday speech. <strong>Only then will your speech truly become richer, and you will see your progress.</strong></p>", tr: "<p>Bu uygulama Alan (Karaçay-Balkar) kelimelerini öğrenmek ve kelime dağarcığını genişletmek için oluşturuldu.</p><p>Yeni kelimeler öğren, ardından onları günlük konuşmanda kullanmaya çalış. <strong>Ancak o zaman konuşman gerçekten zenginleşir ve ilerlemeni görürsün.</strong></p>" }),
  "guide.general.stories.title": Object.freeze({ ru: "Истории", en: "Stories", tr: "Hikâyeler" }),
  "guide.general.stories.body": Object.freeze({ ru: "<p>Здесь слова разделены по сложности и назначению.</p><p>Сейчас коротко познакомимся с каждым разделом.</p>", en: "<p>Here, words are grouped by difficulty and purpose.</p><p>Now let’s take a quick look at each section.</p>", tr: "<p>Burada kelimeler zorluk ve amaca göre ayrılmıştır.</p><p>Şimdi her bölüme kısaca göz atalım.</p>" }),
  "guide.story.oblivion.title": Object.freeze({ ru: "На пороге забвения — лёгкий уровень", en: "On the Threshold of Oblivion — beginner level", tr: "Unutuluşun Eşiğinde — başlangıç seviyesi" }),
  "guide.story.oblivion.body": Object.freeze({ ru: "<p>Это базовая лексика для начинающих.</p><p>Освоив её, ты достигнешь лишь начального уровня владения языком. Увы, большинство людей сегодня знают язык только на этом уровне.</p><p>Именно поэтому наш язык находится на грани исчезновения.</p><p>Чтобы действительно хорошо знать язык, двигайся дальше.</p>", en: "<p>This is basic vocabulary for beginners.</p><p>Mastering it will only bring you to an introductory level. Unfortunately, most people today know the language only at this level.</p><p>That is why our language is on the brink of disappearing.</p><p>To truly know the language well, keep going.</p>", tr: "<p>Bu, yeni başlayanlar için temel kelime dağarcığıdır.</p><p>Bunu öğrenmek seni yalnızca başlangıç seviyesine getirir. Ne yazık ki bugün insanların çoğu dili ancak bu düzeyde biliyor.</p><p>Dilimizin yok olma tehlikesiyle karşı karşıya olmasının nedeni de budur.</p><p>Dili gerçekten iyi bilmek için yoluna devam et.</p>" }),
  "guide.story.roots.title": Object.freeze({ ru: "Возвращение к истокам — средний уровень", en: "Back to the Roots — intermediate level", tr: "Köklere Dönüş — orta seviye" }),
  "guide.story.roots.body": Object.freeze({ ru: "<p><strong>Это главный раздел приложения.</strong></p><p>Этот раздел соответствует хорошему уровню владения языком — уровню полноценного носителя. Здесь собраны слова, которыми сегодня, к сожалению, владеет уже меньшинство.</p><p><strong>Проверь себя: знаешь ли ты эти слова?</strong></p>", en: "<p><strong>This is the app’s main section.</strong></p><p>This section represents a strong command of the language — the level of a fluent native speaker. It contains words that, unfortunately, only a minority still know today.</p><p><strong>Test yourself: do you know these words?</strong></p>", tr: "<p><strong>Bu, uygulamanın ana bölümüdür.</strong></p><p>Bu bölüm, dili iyi derecede bilme — akıcı bir ana dil konuşuru düzeyine — karşılık gelir. Burada, ne yazık ki bugün artık yalnızca azınlığın bildiği kelimeler yer alır.</p><p><strong>Kendini dene: bu kelimeleri biliyor musun?</strong></p>" }),
  "guide.story.ascent.title": Object.freeze({ ru: "На вершине — сложный уровень", en: "At the Summit — advanced level", tr: "Zirvede — ileri seviye" }),
  "guide.story.ascent.body": Object.freeze({ ru: "<p>Здесь собраны редкие, старые и сложные слова, которые сегодня знают немногие.</p><p>Этот раздел — для тех, кто уже хорошо владеет языком и хочет углубить свои знания.</p>", en: "<p>This section contains rare, old, and difficult words that few people know today.</p><p>It is for those who already know the language well and want to deepen their knowledge.</p>", tr: "<p>Burada bugün çok az kişinin bildiği nadir, eski ve zor kelimeler yer alır.</p><p>Bu bölüm, dili zaten iyi bilen ve bilgisini daha da derinleştirmek isteyenler içindir.</p>" }),
  "guide.story.pathways.title": Object.freeze({ ru: "Тропы — тематические наборы", en: "Trails — thematic sets", tr: "Patikalar — tematik setler" }),
  "guide.story.pathways.body": Object.freeze({ ru: "<p>Здесь слова собраны по темам: животные, растения, материалы и другие области жизни.</p><p>Выбирай интересующую тему и отдельно расширяй свой словарный запас.</p>", en: "<p>Here, words are grouped by topic: animals, plants, materials, and other areas of life.</p><p>Choose a topic that interests you and expand that part of your vocabulary.</p>", tr: "<p>Burada kelimeler konulara göre toplanmıştır: hayvanlar, bitkiler, malzemeler ve yaşamın diğer alanları.</p><p>İlgini çeken konuyu seç ve kelime dağarcığını o alanda ayrı ayrı genişlet.</p>" }),
  "guide.general.summary.title": Object.freeze({ ru: "Выбери свой путь", en: "Choose your path", tr: "Yolunu seç" }),
  "guide.general.summary.body": Object.freeze({ ru: "<p>Начни с подходящего тебе уровня и переключайся между историями в любое время.</p><p><strong>Основной путь приложения — «Возвращение к истокам».</strong></p>", en: "<p>Start at the level that suits you and switch between stories at any time.</p><p><strong>The app’s main path is “Back to the Roots”.</strong></p>", tr: "<p>Sana uygun seviyeden başla ve istediğin zaman hikâyeler arasında geçiş yap.</p><p><strong>Uygulamanın ana yolu “Köklere Dönüş”tür.</strong></p>" }),
  "guide.general.stages.title": Object.freeze({ ru: "Проходи этапы", en: "Complete the stages", tr: "Etapları tamamla" }),
  "guide.general.stages.body": Object.freeze({ ru: "<p>В каждом этапе сначала изучи новые слова, а затем проверь себя в тесте.</p>", en: "<p>At each stage, learn the new words first, then test yourself.</p>", tr: "<p>Her etapta önce yeni kelimeleri öğren, ardından testte kendini sınay.</p>" }),
  "guide.general.study.title": Object.freeze({ ru: "Учить слова", en: "Learn words", tr: "Kelime öğren" }),
  "guide.general.study.body": Object.freeze({ ru: "<p>Запоминай новые слова с помощью флеш-карточек.</p>", en: "<p>Memorize new words with flashcards.</p>", tr: "<p>Yeni kelimeleri bilgi kartlarıyla ezberle.</p>" }),
  "guide.general.test.title": Object.freeze({ ru: "Тест", en: "Test", tr: "Test" }),
  "guide.general.test.body": Object.freeze({ ru: "<p>Проверь свои знания и заверши этап.</p><p>Для прохождения нужно набрать <strong>не менее {required}%</strong>.</p>", en: "<p>Test your knowledge and complete the stage.</p><p>You need <strong>at least {required}%</strong> to pass.</p>", tr: "<p>Bilgini sınayıp etabı tamamla.</p><p>Geçmek için <strong>en az %{required}</strong> almalısın.</p>" }),
  "guide.learning.card.title": Object.freeze({ ru: "Вспомни перевод", en: "Recall the translation", tr: "Çeviriyi hatırla" }),
  "guide.learning.card.body": Object.freeze({ ru: "<p>Попробуй вспомнить значение слова.</p><p>Нажми на карточку, чтобы увидеть перевод.</p>", en: "<p>Try to remember what the word means.</p><p>Tap the card to see the translation.</p>", tr: "<p>Kelimenin anlamını hatırlamaya çalış.</p><p>Çeviriyi görmek için karta dokun.</p>" }),
  "guide.learning.translation.title": Object.freeze({ ru: "Проверь себя", en: "Check yourself", tr: "Kendini kontrol et" }),
  "guide.learning.translation.body": Object.freeze({ ru: "<p>На обратной стороне находится перевод слова.</p>", en: "<p>The translation is on the back of the card.</p>", tr: "<p>Kelimenin çevirisi kartın arka yüzündedir.</p>" }),
  "guide.learning.decision.title": Object.freeze({ ru: "Знаешь слово?", en: "Do you know the word?", tr: "Kelimeyi biliyor musun?" }),
  "guide.learning.decision.body": Object.freeze({ ru: "<p>Если знаешь — свайпай вправо или нажми «Знаю».</p><p>Если не знаешь — свайпай влево или нажми «Не знаю».</p><p>Незнакомое слово вернётся позже.</p>", en: "<p>If you know it, swipe right or tap “Know”.</p><p>If you don’t, swipe left or tap “Don’t know”.</p><p>An unfamiliar word will return later.</p>", tr: "<p>Biliyorsan sağa kaydır veya “Biliyorum”a dokun.</p><p>Bilmiyorsan sola kaydır veya “Bilmiyorum”a dokun.</p><p>Bilmediğin kelime daha sonra tekrar gelir.</p>" }),
  "guide.learning.counter.title": Object.freeze({ ru: "Прогресс", en: "Progress", tr: "İlerleme" }),
  "guide.learning.counter.body": Object.freeze({ ru: "<p>Здесь видно, сколько слов осталось пройти.</p>", en: "<p>This shows how many words are left to go through.</p>", tr: "<p>Burada kaç kelimenin kaldığını görebilirsin.</p>" }),
  "guide.learning.favorite.title": Object.freeze({ ru: "Избранное", en: "Favorites", tr: "Favoriler" }),
  "guide.learning.favorite.body": Object.freeze({ ru: "<p>Сохраняй нужные слова, чтобы вернуться к ним позже.</p>", en: "<p>Save useful words so you can return to them later.</p>", tr: "<p>İhtiyacın olan kelimeleri kaydet; böylece daha sonra onlara dönebilirsin.</p>" }),
  "guide.learning.repeat.title": Object.freeze({ ru: "Слово вернулось", en: "The word is back", tr: "Kelime geri döndü" }),
  "guide.learning.repeat.body": Object.freeze({ ru: "<p>Ты отметил его как незнакомое. Повтори его ещё раз.</p>", en: "<p>You marked it as unfamiliar. Review it once more.</p>", tr: "<p>Bu kelimeyi bilmediğini işaretledin. Bir kez daha tekrar et.</p>" }),
});

export function normalizeGuideLanguage(value) {
  const source = String(value || "").trim().toLowerCase().split("-")[0];
  return source === "en" || source === "tr" ? source : "ru";
}

export function stripGuideMarkup(value) {
  return String(value || "")
    .replace(/<\/(?:p|div|li|h\d)>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function guideMessage(language, key, params = {}, { plain = false } = {}) {
  const locale = normalizeGuideLanguage(language);
  const source = GUIDE_MESSAGES[key]?.[locale] || GUIDE_MESSAGES[key]?.ru || key;
  const interpolated = String(source).replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name) => (
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name] ?? "") : placeholder
  ));
  return plain ? stripGuideMarkup(interpolated) : interpolated;
}
