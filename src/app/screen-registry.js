const DEFAULT_SCREEN = Object.freeze({
  layout: "detail",
  header: "standard",
  bottomNav: false,
  icon: "artifact",
});

const SCREENS = Object.freeze({
  "path.home": { layout: "map", header: "minimal", bottomNav: true, icon: "route" },
  "path.station": { layout: "detail", header: "standard", bottomNav: false, icon: "station" },
  "path.study": { layout: "session", header: "session", bottomNav: false, icon: "learn" },
  "path.test": { layout: "session", header: "session", bottomNav: false, icon: "listChecks" },

  "practice.home": { layout: "root", header: "minimal", bottomNav: true, icon: "dumbbell" },
  "profile.home": { layout: "root", header: "minimal", bottomNav: true, icon: "userRound" },

  "learn.catalog": { layout: "detail", header: "standard", bottomNav: false, icon: "learn" },
  "learn.sections": { layout: "detail", header: "standard", bottomNav: false, icon: "learn" },
  "learn.catalog-content": { layout: "detail", header: "standard", bottomNav: false, icon: "search" },
  "learn.set": { layout: "detail", header: "standard", bottomNav: false, icon: "learn" },
  "learn.study": { layout: "session", header: "session", bottomNav: false, icon: "learn" },
  "learn.results": { layout: "detail", header: "standard", bottomNav: false, icon: "circleCheck" },

  "test.menu": { layout: "detail", header: "standard", bottomNav: false, icon: "listChecks" },
  "test.session": { layout: "session", header: "session", bottomNav: false, icon: "listChecks" },
  "test.results": { layout: "detail", header: "standard", bottomNav: false, icon: "circleCheck" },

  "match.menu": { layout: "detail", header: "standard", bottomNav: false, icon: "puzzle" },
  "match.game": { layout: "session", header: "session", bottomNav: false, icon: "puzzle" },
  "match.results": { layout: "detail", header: "standard", bottomNav: false, icon: "circleCheck" },

  "songs.playlists": { layout: "detail", header: "standard", bottomNav: false, icon: "music2" },
  "songs.catalog": { layout: "detail", header: "standard", bottomNav: false, icon: "music2" },
  "songs.song": { layout: "document", header: "standard", bottomNav: false, icon: "music2" },

  "account.home": { layout: "document", header: "standard", bottomNav: false, icon: "userRound" },
  "settings.home": { layout: "detail", header: "standard", bottomNav: false, icon: "settings" },
  "settings.privacy": { layout: "document", header: "standard", bottomNav: false, icon: "settings" },
  "settings.version": { layout: "detail", header: "standard", bottomNav: false, icon: "settings" },
});

export function screenConfig(route = "path.home") {
  return { ...DEFAULT_SCREEN, ...(SCREENS[route] || {}) };
}
