const DEFAULT_SCREEN = Object.freeze({
  layout: "detail",
  header: "standard",
  bottomNav: false,
  title: "Алан тил",
  eyebrow: "АЛАН ТИЛ",
});

const SCREENS = Object.freeze({
  "path.home": { layout: "map", header: "minimal", bottomNav: true, title: "Путь", eyebrow: "ГОРНАЯ ЛИНИЯ" },
  "path.station": { layout: "detail", header: "standard", bottomNav: false, title: "Станция", eyebrow: "МАРШРУТ" },
  "path.study": { layout: "session", header: "session", bottomNav: false, title: "Обучение", eyebrow: "КАРТОЧКИ" },
  "path.test": { layout: "session", header: "session", bottomNav: false, title: "Проверка станции", eyebrow: "ТЕСТ" },

  "practice.home": { layout: "root", header: "standard", bottomNav: true, title: "Практика", eyebrow: "ТРЕНИРОВКА" },
  "profile.home": { layout: "root", header: "minimal", bottomNav: true, title: "Профиль", eyebrow: "ПОЛЕВОЙ ЖУРНАЛ" },

  "learn.catalog": { layout: "detail", header: "standard", bottomNav: false, title: "Словари", eyebrow: "АРХИВ" },
  "learn.sections": { layout: "detail", header: "standard", bottomNav: false, title: "Разделы", eyebrow: "АРХИВ" },
  "learn.catalog-content": { layout: "detail", header: "standard", bottomNav: false, title: "Содержание", eyebrow: "АРХИВ" },
  "learn.set": { layout: "detail", header: "standard", bottomNav: false, title: "Набор слов", eyebrow: "ПОДГОТОВКА" },
  "learn.study": { layout: "session", header: "session", bottomNav: false, title: "Обучение", eyebrow: "КАРТОЧКИ" },
  "learn.results": { layout: "detail", header: "standard", bottomNav: false, title: "Итоги", eyebrow: "СЕССИЯ" },

  "test.menu": { layout: "detail", header: "standard", bottomNav: false, title: "Общий тест", eyebrow: "ПРАКТИКА" },
  "test.session": { layout: "session", header: "session", bottomNav: false, title: "Тест", eyebrow: "ВОПРОСЫ" },
  "test.results": { layout: "detail", header: "standard", bottomNav: false, title: "Результаты", eyebrow: "ПРАКТИКА" },

  "match.menu": { layout: "detail", header: "standard", bottomNav: false, title: "Сопоставление", eyebrow: "ПРАКТИКА" },
  "match.game": { layout: "session", header: "session", bottomNav: false, title: "Сопоставление", eyebrow: "ПАРЫ" },
  "match.results": { layout: "detail", header: "standard", bottomNav: false, title: "Результаты", eyebrow: "ПРАКТИКА" },

  "songs.playlists": { layout: "detail", header: "standard", bottomNav: false, title: "Песни", eyebrow: "ЖИВОЙ ЯЗЫК" },
  "songs.catalog": { layout: "detail", header: "standard", bottomNav: false, title: "Плейлист", eyebrow: "ЖИВОЙ ЯЗЫК" },
  "songs.song": { layout: "document", header: "standard", bottomNav: false, title: "Песня", eyebrow: "ТЕКСТ И ЗВУК" },

  "account.home": { layout: "document", header: "standard", bottomNav: false, title: "Аккаунт", eyebrow: "ПРОФИЛЬ" },
  "settings.home": { layout: "detail", header: "standard", bottomNav: false, title: "Настройки", eyebrow: "ПРИЛОЖЕНИЕ" },
  "settings.privacy": { layout: "document", header: "standard", bottomNav: false, title: "Конфиденциальность", eyebrow: "ДОКУМЕНТ" },
  "settings.version": { layout: "detail", header: "standard", bottomNav: false, title: "Версия", eyebrow: "ПРИЛОЖЕНИЕ" },
});

export function screenConfig(route = "path.home") {
  const exact = SCREENS[route];
  if (exact) return { ...DEFAULT_SCREEN, ...exact };
  const feature = String(route || "path.home").split(".")[0];
  return { ...DEFAULT_SCREEN, title: feature ? feature[0].toUpperCase() + feature.slice(1) : DEFAULT_SCREEN.title };
}
