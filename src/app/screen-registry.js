import { msg } from "../shared/i18n/index.js?v=13.15.9";
const DEFAULT_SCREEN = Object.freeze({
  layout: "detail",
  header: "standard",
  bottomNav: false,
  title: "",
});

const SCREENS = Object.freeze({
  "path.home": { layout: "map", header: "minimal", bottomNav: true, title: "" },
  "path.story-words": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.spisok_slov" },
  "path.station": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.etap" },
  "path.study": { layout: "session", header: "session", bottomNav: false, titleKey: "common.uchit_slova" },
  "path.test": { layout: "session", header: "session", bottomNav: false, titleKey: "common.prover_znaniya" },

  "practice.home": { layout: "root", header: "minimal", bottomNav: true, title: "" },
  "profile.home": { layout: "root", header: "minimal", bottomNav: true, title: "" },
  "profile.statistics": { layout: "root", header: "minimal", bottomNav: true, title: "" },
  "admin.users": { layout: "root", header: "minimal", bottomNav: true, title: "" },
  "admin.user": { layout: "detail", header: "standard", bottomNav: false, titleKey: "admin.user" },
  "admin.test": { layout: "detail", header: "standard", bottomNav: false, titleKey: "admin.test_result" },

  "learn.set": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.nabor_slov" },
  "learn.study": { layout: "session", header: "session", bottomNav: false, titleKey: "common.uchit_slova" },
  "learn.results": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.rezultat_obucheniya" },

  "test.menu": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.prover_znaniya" },
  "test.session": { layout: "session", header: "session", bottomNav: false, titleKey: "common.prover_znaniya" },
  "test.results": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.rezultaty_testa" },

  "match.menu": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.sopostav_slova" },
  "match.game": { layout: "session", header: "session", bottomNav: false, titleKey: "common.sopostav_slova" },
  "match.results": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.rezultat_igry" },

  "songs.playlists": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.pesni" },
  "songs.catalog": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.pesni" },
  "songs.song": { layout: "document", header: "standard", bottomNav: false, titleKey: "common.pesnya" },

  "account.home": { layout: "document", header: "standard", bottomNav: false, titleKey: "common.akkaunt" },
  "settings.home": { layout: "root", header: "minimal", bottomNav: true, title: "" },
  "settings.privacy": { layout: "document", header: "standard", bottomNav: false, titleKey: "common.politika_konfidentsialnosti" },
  "settings.version": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.versiya_prilozheniya" },
  "settings.thanks": { layout: "document", header: "standard", bottomNav: false, titleKey: "common.blagodarnosti" },
});

export function screenConfig(route = "path.home") {
  const config = { ...DEFAULT_SCREEN, ...(SCREENS[route] || {}) };
  return { ...config, title: config.titleKey ? msg(config.titleKey) : config.title };
}
