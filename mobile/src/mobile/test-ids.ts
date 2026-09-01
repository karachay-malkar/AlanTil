/**
 * Stable native automation identifiers. Keep these independent from translated
 * copy so Maestro flows work in RU, EN and TR.
 */
export const testIds = {
  app: {
    loading: 'app.loading',
  },
  analytics: {
    consent: 'analytics.consent',
    policy: 'analytics.policy',
    decline: 'analytics.decline',
    accept: 'analytics.accept',
  },
  onboarding: {
    setup: 'screen.onboarding.setup',
    languageRu: 'onboarding.language.ru',
    languageEn: 'onboarding.language.en',
    languageTr: 'onboarding.language.tr',
    scriptCyrillic: 'onboarding.script.cyrillic',
    scriptTurkic: 'onboarding.script.turkic',
    dialectCanonical: 'onboarding.dialect.canonical',
    dialectKarachay: 'onboarding.dialect.karachay',
    dialectBalkar: 'onboarding.dialect.balkar',
    continue: 'onboarding.continue',
    access: 'screen.onboarding.access',
    google: 'onboarding.google',
    account: 'onboarding.continue-account',
    guest: 'onboarding.continue-guest',
    guide: 'screen.onboarding.guide',
    guideSkip: 'onboarding.guide.skip',
    guideBack: 'onboarding.guide.back',
    guideNext: 'onboarding.guide.next',
  },
  tab: {
    path: 'tab.path',
    practice: 'tab.practice',
    profile: 'tab.profile',
  },
  path: {
    screen: 'screen.path',
    help: 'path.help',
    words: 'path.words',
  },
  practice: {
    screen: 'screen.practice',
    test: 'practice.test',
    match: 'practice.match',
    favorites: 'practice.favorites',
    songs: 'practice.songs',
  },
  station: {
    screen: 'screen.station',
    menuTab: 'station.tab.menu',
    statisticsTab: 'station.tab.statistics',
    showAll: 'station.show-all',
    hideAll: 'station.hide-all',
    alanToTranslation: 'station.direction.alan-translation',
    translationToAlan: 'station.direction.translation-alan',
    study: 'station.study',
    test: 'station.test',
  },
  learn: {
    screen: 'screen.learn',
    reveal: 'learn.reveal',
    hide: 'learn.hide',
    unknown: 'learn.unknown',
    known: 'learn.known',
    undo: 'learn.undo',
    result: 'screen.learn.result',
    done: 'learn.done',
  },
  stationTest: {
    screen: 'screen.station-test',
    submit: 'station-test.submit',
    result: 'screen.station-test.result',
    retry: 'station-test.retry',
    backToStation: 'station-test.back-to-station',
  },
  generalTest: {
    menu: 'screen.general-test.menu',
    start: 'general-test.start',
    session: 'screen.general-test.session',
    submit: 'general-test.submit',
    result: 'screen.general-test.result',
    again: 'general-test.again',
  },
  match: {
    menu: 'screen.match.menu',
    start: 'match.start',
    session: 'screen.match.session',
    result: 'screen.match.result',
  },
  favorites: {
    screen: 'screen.favorites',
    showAll: 'favorites.show-all',
    hideAll: 'favorites.hide-all',
    study: 'favorites.study',
  },
  profile: {
    screen: 'screen.profile',
    settings: 'profile.settings',
    statistics: 'profile.statistics',
  },
  settings: {
    screen: 'screen.settings',
    save: 'settings.save',
  },
} as const;

export function scopedTestId(prefix: string, ...parts: unknown[]) {
  const suffix = parts
    .map((part) => String(part ?? '').normalize('NFC').trim().toLocaleLowerCase())
    .map((part) => part.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('.');
  return suffix ? `${prefix}.${suffix}` : prefix;
}
