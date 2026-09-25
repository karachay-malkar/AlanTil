import { msg } from "../shared/i18n/index.js?v=16.8.0.4";
const DEFAULT_SCREEN = Object.freeze({
  layout: "detail",
  header: "standard",
  bottomNav: false,
  title: "",
});

const SCREENS = Object.freeze({
  "path.home": { layout: "map", header: "minimal", bottomNav: true, title: "", styles: [] },
  "path.story-words": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.spisok_slov", styles: [] },
  "path.station": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.etap", styles: [] },
  "path.study": { layout: "session", header: "session", bottomNav: false, titleKey: "common.uchit_slova", styles: ["learn"] },
  "path.test": { layout: "session", header: "session", bottomNav: false, titleKey: "common.prover_znaniya", styles: ["test"] },

  "practice.home": { layout: "root", header: "minimal", bottomNav: true, title: "", styles: ["practice"] },
  "practice.ashyk": { layout: "detail", header: "standard", bottomNav: false, titleKey: "practice.ashyk", styles: ["ashyk"] },
  "friends.home": { layout: "root", header: "minimal", bottomNav: true, title: "", styles: ["friends", "admin"] },
  "profile.home": { layout: "root", header: "minimal", bottomNav: true, title: "", styles: ["profile"] },
  "profile.skills": { styles: ["profile"] },
  "profile.statistics": { layout: "root", header: "minimal", bottomNav: true, title: "", styles: ["profile"] },
  "admin.users": { layout: "root", header: "minimal", bottomNav: true, title: "", styles: ["admin"] },
  "admin.user": { layout: "detail", header: "standard", bottomNav: false, titleKey: "admin.user", styles: ["admin"] },
  "admin.test": { layout: "detail", header: "standard", bottomNav: false, titleKey: "admin.test_result", styles: ["admin"] },

  "learn.catalog": { styles: ["learn"] },
  "learn.catalog-content": { styles: ["learn"] },
  "learn.sections": { styles: ["learn"] },
  "learn.set": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.nabor_slov", styles: ["learn"] },
  "learn.study": { layout: "session", header: "session", bottomNav: false, titleKey: "common.uchit_slova", styles: ["learn"] },
  "learn.results": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.rezultat_obucheniya", styles: ["learn"] },

  "test.menu": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.prover_znaniya", styles: ["test"] },
  "test.session": { layout: "session", header: "session", bottomNav: false, titleKey: "common.prover_znaniya", styles: ["test"] },
  "test.results": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.rezultaty_testa", styles: ["test"] },

  "match.menu": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.sopostav_slova", styles: ["test", "match"] },
  "match.game": { layout: "session", header: "session", bottomNav: false, titleKey: "common.sopostav_slova", styles: ["test", "match"] },
  "match.results": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.rezultat_igry", styles: ["test", "match"] },

  "songs.playlists": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.pesni", styles: ["songs"] },
  "songs.catalog": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.pesni", styles: ["songs"] },
  "songs.song": { layout: "document", header: "standard", bottomNav: false, titleKey: "common.pesnya", styles: ["songs"] },

  "account.home": { layout: "document", header: "standard", bottomNav: false, titleKey: "common.akkaunt", styles: ["account"] },
  "settings.home": { layout: "root", header: "minimal", bottomNav: true, title: "", styles: ["settings"] },
  "settings.privacy": { layout: "document", header: "standard", bottomNav: false, titleKey: "common.politika_konfidentsialnosti", styles: ["settings"] },
  "settings.version": { layout: "detail", header: "standard", bottomNav: false, titleKey: "common.versiya_prilozheniya", styles: ["settings"] },
  "settings.thanks": { layout: "document", header: "standard", bottomNav: false, titleKey: "common.blagodarnosti", styles: ["settings"] },
});

export function screenStyleDependencies(route = "path.home") {
  return [...(SCREENS[route]?.styles || [])];
}

export function screenConfig(route = "path.home") {
  const config = { ...DEFAULT_SCREEN, ...(SCREENS[route] || {}) };
  return { ...config, styles: screenStyleDependencies(route), title: config.titleKey ? msg(config.titleKey) : config.title };
}
