import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { buildLearningRoute } from '../packages/alantil-core/learning-route.js';
import { toggleFavorite } from '../packages/alantil-core/favorites.js';
import { DEFAULT_USER_SETTINGS, hasCompletedLearningSetup } from '../packages/alantil-core/settings.js';
import { BottomNav } from './ui/components.js';
import { theme } from './ui/theme.js';
import { AccountScreen } from './screens/profile.js';
import { ProfileGate } from './screens/profile-gate.js';
import { StationScreen } from './screens/station.js';
import { LearnScreen } from './screens/learn.js';
import { StationTestScreen } from './screens/station-test.js';
import { SongsScreen } from './screens/songs.js';
import { OnboardingScreen } from './screens/onboarding.js';
import { PathScreen } from './screens/path.js';
import { StoryWordListScreen } from './screens/story-word-list.js';
import { PracticeScreen } from './screens/practice.js';
import { FavoritesScreen } from './screens/favorites.js';
import { GeneralMatchFlow, GeneralTestFlow } from './screens/practice-games.js';
import { bootstrapNativeAuth } from './platform/auth.js';
import { bootstrapNativeDictionary } from './platform/dictionary.js';
import { setNativeSessionNamespace } from './platform/session-store.js';
import { loadNativeFavorites, loadNativeSettings, loadNativeSongFavorites, saveNativeFavorites, saveNativeSettings, saveNativeSongFavorites } from './platform/storage.js';

const C = theme.colors;

function BootScreen() { return <View style={styles.boot}><Text style={styles.bootBrand}>Alan Til</Text><View style={styles.bootDot} /></View>; }
function settledValue(result, fallback) { return result?.status === 'fulfilled' ? result.value : fallback; }

export default function AppRoot() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [words, setWords] = useState([]);
  const [tab, setTab] = useState('path');
  const [screen, setScreen] = useState('home');
  const [favorites, setFavoritesState] = useState(() => new Set());
  const [songFavorites, setSongFavoritesState] = useState(() => new Set());
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_USER_SETTINGS }));
  const [station, setStation] = useState(null);
  const [storyWordListType, setStoryWordListType] = useState('');
  const [learnContext, setLearnContext] = useState(null);
  const [testContext, setTestContext] = useState(null);
  const [practiceGameContext, setPracticeGameContext] = useState(null);
  const route = useMemo(() => buildLearningRoute(words), [words]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const results = await Promise.allSettled([
        loadNativeSettings(), loadNativeFavorites(), loadNativeSongFavorites(), bootstrapNativeAuth(), bootstrapNativeDictionary(),
      ]);
      if (!alive) return;
      const savedSettings = settledValue(results[0], { ...DEFAULT_USER_SETTINGS });
      const savedFavorites = settledValue(results[1], new Set());
      const savedSongFavorites = settledValue(results[2], new Set());
      const session = settledValue(results[3], null);
      const dictionary = settledValue(results[4], null);
      setSettingsState(savedSettings || { ...DEFAULT_USER_SETTINGS });
      setFavoritesState(savedFavorites instanceof Set ? savedFavorites : new Set(savedFavorites || []));
      setSongFavoritesState(savedSongFavorites instanceof Set ? savedSongFavorites : new Set(savedSongFavorites || []));
      setWords(Array.isArray(dictionary?.words) ? dictionary.words : []);
      setSetupRequired(!session?.user && !hasCompletedLearningSetup(savedSettings || DEFAULT_USER_SETTINGS));
      setBootstrapped(true);
    })().catch(() => {
      if (!alive) return;
      setSettingsState({ ...DEFAULT_USER_SETTINGS });
      setFavoritesState(new Set());
      setSongFavoritesState(new Set());
      setWords([]);
      setSetupRequired(true);
      setBootstrapped(true);
    });
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
  const setSettings = async (next) => {
    const saved = await saveNativeSettings(next);
    setSettingsState(saved);
    return saved;
  };
  const changeTab = (next) => {
    setTab(next); setScreen('home'); setStation(null); setStoryWordListType(''); setPracticeGameContext(null);
  };
  const openStation = (nextStation) => { setStation(nextStation); setScreen('station'); };
  const backToPath = () => { setScreen('home'); setStation(null); };
  const openStoryWordList = (storyType) => { setStoryWordListType(storyType); setScreen('storyWords'); };
  const closeStoryWordList = () => { setScreen('home'); setStoryWordListType(''); };
  const continueAsGuest = () => { setTab('path'); setScreen('home'); setStation(null); };
  const openPracticeGame = (type, sourceWords = words, returnTo = 'home', scopeId = 'all') => {
    setNativeSessionNamespace(type, scopeId);
    setPracticeGameContext({ words: Array.isArray(sourceWords) ? sourceWords : [], returnTo, scopeId });
    setScreen(type);
  };
  const closePracticeGame = () => {
    const returnTo = practiceGameContext?.returnTo || 'home';
    setPracticeGameContext(null);
    setScreen(returnTo);
  };
  const shell = (content, showNav = true) => <SafeAreaProvider><StatusBar style="dark" /><SafeAreaView style={styles.safe} edges={theme.safeArea.edges}><View style={styles.app}>{content}{showNav ? <BottomNav tab={tab} onChange={changeTab} /> : null}</View></SafeAreaView></SafeAreaProvider>;

  if (!bootstrapped) return shell(<BootScreen />, false);
  if (setupRequired) return shell(<OnboardingScreen initialSettings={settings} onComplete={async (nextSettings) => {
    const saved = await setSettings(nextSettings);
    if (!hasCompletedLearningSetup(saved)) throw new Error('Learning setup was not persisted');
    setSetupRequired(false); setTab('profile'); setScreen('account');
  }} />, false);

  let content;
  let showNav = true;
  if (screen === 'learn' && learnContext) {
    content = <LearnScreen words={learnContext.words} mode={learnContext.mode} station={learnContext.station} favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen(learnContext.returnTo || 'station')} />;
    showNav = false;
  } else if (screen === 'stationTest' && testContext) {
    content = <StationTestScreen station={testContext.station} allWords={words} mode={testContext.mode} favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen('station')} />;
    showNav = false;
  } else if (tab === 'path' && screen === 'storyWords' && route.stories?.[storyWordListType]) {
    content = <StoryWordListScreen story={route.stories[storyWordListType]} settings={settings} favorites={favorites} setFavorites={setFavorites} onBack={closeStoryWordList} />;
    showNav = false;
  } else if (tab === 'path' && screen === 'station' && station) {
    content = <StationScreen station={station} favorites={favorites} setFavorites={setFavorites} onBack={backToPath} onLearn={(rows, mode) => { setLearnContext({ words: rows, mode, station, returnTo: 'station' }); setScreen('learn'); }} onTest={(target, mode) => { setTestContext({ station: target, mode }); setScreen('stationTest'); }} />;
    showNav = false;
  } else if (tab === 'practice' && screen === 'test') {
    const context = practiceGameContext || { words, scopeId: 'all' };
    content = <GeneralTestFlow words={context.words} favorites={favorites} setFavorites={setFavorites} onBack={closePracticeGame} />;
    showNav = false;
  } else if (tab === 'practice' && screen === 'match') {
    const context = practiceGameContext || { words, scopeId: 'all' };
    content = <GeneralMatchFlow words={context.words} favorites={favorites} setFavorites={setFavorites} onBack={closePracticeGame} />;
    showNav = false;
  } else if (tab === 'practice' && screen === 'favorites') {
    content = <FavoritesScreen words={words} favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen('home')} onLearn={(rows, mode) => { setLearnContext({ words: rows, mode, station: null, returnTo: 'favorites' }); setScreen('learn'); }} onTest={(rows) => openPracticeGame('test', rows, 'favorites', 'favorites')} onMatch={(rows) => openPracticeGame('match', rows, 'favorites', 'favorites')} />;
    showNav = false;
  } else if (tab === 'practice' && screen === 'songs') {
    content = <SongsScreen words={words} settings={settings} onBack={() => setScreen('home')} favoriteIds={songFavorites} onFavorite={(id) => setSongFavorites(toggleFavorite(songFavorites, id).ids)} />;
    showNav = false;
  } else if (tab === 'practice') {
    content = <PracticeScreen openTest={() => openPracticeGame('test', words, 'home', 'all')} openMatch={() => openPracticeGame('match', words, 'home', 'all')} openFavorites={() => setScreen('favorites')} openSongs={() => setScreen('songs')} />;
  } else if (tab === 'profile' && screen === 'account') {
    content = <AccountScreen settings={settings} onGuest={continueAsGuest} onBack={() => setScreen('home')} />;
    showNav = false;
  } else if (tab === 'profile') {
    content = <ProfileGate words={words} settings={settings} onSettingsChange={setSettings} onGuest={continueAsGuest} onAccount={(action) => { if (action === 'open') setScreen('account'); }} />;
  } else {
    content = <PathScreen route={route} onOpenStation={openStation} onOpenWordList={openStoryWordList} />;
  }
  return shell(content, showNav);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.appBg },
  app: { flex: 1, backgroundColor: C.appBg, overflow: 'hidden' },
  boot: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.appBg },
  bootBrand: { fontSize: 30, fontWeight: '900', color: C.text1 },
  bootDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.accent, marginTop: 18 },
});
