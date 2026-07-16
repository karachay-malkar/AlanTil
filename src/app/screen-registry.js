const DEFAULT_SCREEN = Object.freeze({
  layout: "detail",
  header: "standard",
  bottomNav: false,
  title: "",
});

const SCREENS = Object.freeze({
  "path.home": { layout: "map", header: "minimal", bottomNav: true, title: "Alan Til!" },
  "path.station": { layout: "detail", header: "standard", bottomNav: false, title: "Этап" },
  "path.study": { layout: "session", header: "session", bottomNav: false, title: "Учить слова" },
  "path.test": { layout: "session", header: "session", bottomNav: false, title: "Проверь знания" },

  "practice.home": { layout: "root", header: "minimal", bottomNav: true, title: "Alan Til!" },
  "profile.home": { layout: "root", header: "minimal", bottomNav: true, title: "Alan Til!" },
  "profile.skills": { layout: "root", header: "minimal", bottomNav: true, title: "Alan Til!" },
  "profile.statistics": { layout: "root", header: "minimal", bottomNav: true, title: "Alan Til!" },

  "learn.catalog": { layout: "detail", header: "standard", bottomNav: false, title: "Учить слова" },
  "learn.sections": { layout: "detail", header: "standard", bottomNav: false, title: "Словарь" },
  "learn.catalog-content": { layout: "detail", header: "standard", bottomNav: false, title: "Содержание словаря" },
  "learn.set": { layout: "detail", header: "standard", bottomNav: false, title: "Набор слов" },
  "learn.study": { layout: "session", header: "session", bottomNav: false, title: "Учить слова" },
  "learn.results": { layout: "detail", header: "standard", bottomNav: false, title: "Результат обучения" },

  "test.menu": { layout: "detail", header: "standard", bottomNav: false, title: "Проверь знания" },
  "test.session": { layout: "session", header: "session", bottomNav: false, title: "Проверь знания" },
  "test.results": { layout: "detail", header: "standard", bottomNav: false, title: "Результаты теста" },

  "match.menu": { layout: "detail", header: "standard", bottomNav: false, title: "Сопоставь слова" },
  "match.game": { layout: "session", header: "session", bottomNav: false, title: "Сопоставь слова" },
  "match.results": { layout: "detail", header: "standard", bottomNav: false, title: "Результат игры" },

  "songs.playlists": { layout: "detail", header: "standard", bottomNav: false, title: "Песни" },
  "songs.catalog": { layout: "detail", header: "standard", bottomNav: false, title: "Песни" },
  "songs.song": { layout: "document", header: "standard", bottomNav: false, title: "Песня" },

  "account.home": { layout: "document", header: "standard", bottomNav: false, title: "Аккаунт" },
  "settings.home": { layout: "root", header: "minimal", bottomNav: true, title: "Alan Til!" },
  "settings.privacy": { layout: "document", header: "standard", bottomNav: false, title: "Политика конфиденциальности" },
  "settings.version": { layout: "detail", header: "standard", bottomNav: false, title: "Версия приложения" },
  "settings.thanks": { layout: "document", header: "standard", bottomNav: false, title: "Благодарности" },
});

export function screenConfig(route = "path.home") {
  return { ...DEFAULT_SCREEN, ...(SCREENS[route] || {}) };
}
