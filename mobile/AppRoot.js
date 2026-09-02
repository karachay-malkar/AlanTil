import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { STARTER_DICTIONARY } from '../src/data/starter-dictionary.js';
import { normalizeLegacyWordEntry } from '../packages/alantil-core/word-normalizer.js';
import { buildLearningRoute } from '../packages/alantil-core/learning-route.js';
import { toggleFavorite } from '../packages/alantil-core/favorites.js';
import { DEFAULT_USER_SETTINGS } from '../packages/alantil-core/settings.js';
import { BottomNav, FavoriteButton, Header, MenuItem, Screen, SectionLabel, uiStyles } from './ui/components.js';
import { FavoriteIcon, ListChecksIcon, MusicIcon, PuzzleIcon } from './ui/icons.js';
import { theme } from './ui/theme.js';
import { ProfileArea, AccountScreen } from './screens/profile.js';
import { StationScreen } from './screens/station.js';
import { LearnScreen } from './screens/learn.js';
import { StationTestScreen } from './screens/station-test.js';
import { SongsScreen } from './screens/songs.js';
import { OnboardingScreen } from './screens/onboarding.js';
import { PathScreen } from './screens/path.js';
import { GeneralMatchFlow, GeneralTestFlow } from './screens/practice-games.js';
import { hasCompletedNativeOnboarding, loadNativeFavorites, loadNativeSettings, loadNativeSongFavorites, markNativeOnboardingComplete, saveNativeFavorites, saveNativeSettings, saveNativeSongFavorites } from './platform/storage.js';

const C = theme.colors;
function starterWords() { return STARTER_DICTIONARY.map((row) => normalizeLegacyWordEntry(row)).filter(Boolean); }
const WORDS = starterWords();
const ROUTE = buildLearningRoute(WORDS);

function PracticeHome({ openTest, openMatch, openFavorites, openSongs }) {
  return <Screen><Header title="" /><ScrollView contentContainerStyle={uiStyles.scrollContent}><SectionLabel>ПРАКТИКА</SectionLabel><MenuItem title="Тест" subtitle="Проверка слов из выбранных разделов" icon={<ListChecksIcon size={22} color={C.text2} />} onPress={openTest} /><MenuItem title="Сопоставление" subtitle="Соединение слов и переводов" icon={<PuzzleIcon size={22} color={C.text2} />} onPress={openMatch} /><MenuItem title="Избранное" subtitle="Учить слова" icon={<FavoriteIcon size={22} color={C.favorite} filled />} onPress={openFavorites} /><MenuItem title="Песни" subtitle="Язык в живом контексте" icon={<MusicIcon size={22} color={C.text2} />} onPress={openSongs} /></ScrollView></Screen>;
}

function FavoritesScreen({ favorites, setFavorites, onBack, onLearn }) {
  const rows = WORDS.filter((word) => favorites.has(String(word.id)));
  return <Screen><Header title="Избранное" subtitle={`${rows.length} слов`} onBack={onBack} /><ScrollView contentContainerStyle={[uiStyles.scrollContent, { paddingBottom: 86 }]}>{rows.length ? <><SectionLabel>СЛОВА</SectionLabel>{rows.map((word, index) => <View key={word.id} style={styles.wordRow}><Text style={styles.wordIndex}>{String(index + 1).padStart(2, '0')}</Text><View style={styles.wordCopy}><Text style={styles.wordPrimary}>{word.word}</Text><Text style={styles.wordSecondary}>{word.trans}</Text></View><FavoriteButton active onPress={() => setFavorites(toggleFavorite(favorites, word.id).ids)} /></View>)}</> : <View style={styles.empty}><Text style={styles.emptyTitle}>Пока пусто</Text><Text style={styles.emptyText}>Отмечайте слова звездой, чтобы учить их отдельно.</Text></View>}</ScrollView>{rows.length ? <View style={styles.favoritesLaunch}><Pressable onPress={() => onLearn(rows)} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Учить слова</Text></Pressable></View> : null}</Screen>;
}

function BootScreen() { return <View style={styles.boot}><Text style={styles.bootBrand}>Alan Til</Text><View style={styles.bootDot} /></View>; }

export default function AppRoot() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const [tab, setTab] = useState('path');
  const [screen, setScreen] = useState('home');
  const [favorites, setFavoritesState] = useState(() => new Set());
  const [songFavorites, setSongFavoritesState] = useState(() => new Set());
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_USER_SETTINGS }));
  const [station, setStation] = useState(null);
  const [learnContext, setLearnContext] = useState(null);
  const [testContext, setTestContext] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [savedSettings, savedFavorites, savedSongFavorites, completed] = await Promise.all([loadNativeSettings(), loadNativeFavorites(), loadNativeSongFavorites(), hasCompletedNativeOnboarding()]);
      if (!alive) return;
      setSettingsState(savedSettings);
      setFavoritesState(savedFavorites);
      setSongFavoritesState(savedSongFavorites);
      setOnboardingComplete(completed);
      setBootstrapped(true);
    })();
    return () => { alive = false; };
  }, []);

  const setFavorites = (next) => {
    const value = next instanceof Set ? next : new Set(next || []);
    setFavoritesState(new Set(value));
    saveNativeFavorites(value).catch(() => {});
  };
  const setSongFavorites = (next) => {
    const value = next instanceof Set ? next : new Set(next || []);
    setSongFavoritesState(new Set(value));
    saveNativeSongFavorites(value).catch(() => {});
  };
  const setSettings = (next) => {
    setSettingsState(next);
    saveNativeSettings(next).catch(() => {});
  };
  const changeTab = (next) => {
    setTab(next);
    setScreen('home');
    setStation(null);
  };
  const openStation = (nextStation) => {
    setStation(nextStation);
    setScreen('station');
  };
  const backToPath = () => {
    setScreen('home');
    setStation(null);
  };
  const shell = (content, showNav = true) => <SafeAreaProvider><StatusBar style="dark" /><SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}><View style={styles.app}>{content}{showNav ? <BottomNav tab={tab} onChange={changeTab} /> : null}</View></SafeAreaView></SafeAreaProvider>;

  if (!bootstrapped) return shell(<BootScreen />, false);
  if (!onboardingComplete) return shell(<OnboardingScreen initialSettings={settings} onComplete={(nextSettings, final) => { if (nextSettings) setSettings(nextSettings); if (final) { markNativeOnboardingComplete().catch(() => {}); setOnboardingComplete(true); } }} onLogin={() => { markNativeOnboardingComplete().catch(() => {}); setOnboardingComplete(true); setTab('profile'); setScreen('account'); }} />, false);

  let content;
  let showNav = true;
  if (screen === 'learn' && learnContext) {
    content = <LearnScreen words={learnContext.words} mode={learnContext.mode} station={learnContext.station} favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen(learnContext.returnTo || 'station')} />;
    showNav = false;
  } else if (screen === 'stationTest' && testContext) {
    content = <StationTestScreen station={testContext.station} allWords={WORDS} mode={testContext.mode} onBack={() => setScreen('station')} />;
    showNav = false;
  } else if (tab === 'path' && screen === 'station' && station) {
    content = <StationScreen station={station} favorites={favorites} setFavorites={setFavorites} onBack={backToPath} onLearn={(words, mode) => { setLearnContext({ words, mode, station, returnTo: 'station' }); setScreen('learn'); }} onTest={(target, mode) => { setTestContext({ station: target, mode }); setScreen('stationTest'); }} />;
    showNav = false;
  } else if (tab === 'practice' && screen === 'test') {
    content = <GeneralTestFlow words={WORDS} favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen('home')} />;
    showNav = false;
  } else if (tab === 'practice' && screen === 'match') {
    content = <GeneralMatchFlow words={WORDS} favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen('home')} />;
    showNav = false;
  } else if (tab === 'practice' && screen === 'favorites') {
    content = <FavoritesScreen favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen('home')} onLearn={(rows) => { setLearnContext({ words: rows, mode: 'kb', station: null, returnTo: 'favorites' }); setScreen('learn'); }} />;
    showNav = false;
  } else if (tab === 'practice' && screen === 'songs') {
    content = <SongsScreen words={WORDS} onBack={() => setScreen('home')} favoriteIds={songFavorites} onFavorite={(id) => setSongFavorites(toggleFavorite(songFavorites, id).ids)} />;
    showNav = false;
  } else if (tab === 'practice') {
    content = <PracticeHome openTest={() => setScreen('test')} openMatch={() => setScreen('match')} openFavorites={() => setScreen('favorites')} openSongs={() => setScreen('songs')} />;
  } else if (tab === 'profile' && screen === 'account') {
    content = <AccountScreen onBack={() => setScreen('home')} />;
    showNav = false;
  } else if (tab === 'profile') {
    content = <ProfileArea words={WORDS} settings={settings} onSettingsChange={setSettings} onAccount={() => setScreen('account')} />;
  } else {
    content = <PathScreen route={ROUTE} onOpenStation={openStation} />;
  }
  return shell(content, showNav);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.appBg },
  app: { flex: 1, backgroundColor: C.appBg, overflow: 'hidden' },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.appBg },
  bootBrand: { fontSize: 30, fontWeight: '900', color: C.text1 },
  bootDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, marginTop: 18 },
  wordRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  wordIndex: { width: 36, fontSize: 10, fontWeight: '700', color: C.text3, textAlign: 'center' },
  wordCopy: { flex: 1, minWidth: 0, paddingHorizontal: 7 },
  wordPrimary: { fontSize: 16, fontWeight: '800', color: C.text1 },
  wordSecondary: { fontSize: 13, color: C.text2, marginTop: 2 },
  empty: { paddingVertical: 32, paddingHorizontal: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: C.line, borderRadius: theme.radius.md, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text1, marginBottom: 5 },
  emptyText: { fontSize: 13, lineHeight: 19, color: C.text2, textAlign: 'center' },
  favoritesLaunch: { position: 'absolute', left: 12, right: 12, bottom: 10, zIndex: 30, backgroundColor: 'rgba(238,233,223,.94)', paddingTop: 6 },
  primaryButton: { minHeight: 38, borderWidth: 1, borderColor: C.accentStrong, borderRadius: 2, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 14, fontWeight: '700', color: C.inverse },
});
