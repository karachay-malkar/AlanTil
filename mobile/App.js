import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { STARTER_DICTIONARY } from '../src/data/starter-dictionary.js';
import { normalizeLegacyWordEntry } from '../packages/alantil-core/word-normalizer.js';
import { buildLearningRoute } from '../packages/alantil-core/learning-route.js';
import { initializeTestState, buildTestOptions, applyTestAnswer, testCompletionSummary } from '../packages/alantil-core/test.js';
import { initializeMatchState, takeNextMatchRound, markMatchSolved, recordMatchMismatch, matchCompletionSummary } from '../packages/alantil-core/match.js';
import { toggleFavorite, favoriteHas } from '../packages/alantil-core/favorites.js';
import { DEFAULT_USER_SETTINGS } from '../packages/alantil-core/settings.js';
import { BottomNav, Button, FavoriteButton, Header, HeaderCircleButton, MenuItem, ProgressBar, Screen, SectionLabel, uiStyles } from './ui/components.js';
import { FavoriteIcon, InfoIcon, ListChecksIcon, MusicIcon, PuzzleIcon } from './ui/icons.js';
import { theme } from './ui/theme.js';
import { ProfileArea, AccountScreen } from './screens/profile.js';
import { StationScreen } from './screens/station.js';
import { LearnScreen } from './screens/learn.js';
import { StationTestScreen } from './screens/station-test.js';
import { SongsScreen } from './screens/songs.js';
import { OnboardingScreen } from './screens/onboarding.js';
import { hasCompletedNativeOnboarding, loadNativeFavorites, loadNativeSettings, loadNativeSongFavorites, markNativeOnboardingComplete, saveNativeFavorites, saveNativeSettings, saveNativeSongFavorites } from './platform/storage.js';

const C = theme.colors;

function starterWords() {
  return STARTER_DICTIONARY.map((row) => normalizeLegacyWordEntry(row)).filter(Boolean);
}

const WORDS = starterWords();
const ROUTE = buildLearningRoute(WORDS);

function PracticeHome({ openTest, openMatch, openFavorites, openSongs }) {
  return (
    <Screen>
      <Header title="Alan Til!" />
      <ScrollView contentContainerStyle={uiStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionLabel>ПРАКТИКА</SectionLabel>
        <MenuItem title="Тест" subtitle="Проверка слов из выбранных разделов" icon={<ListChecksIcon size={22} color={C.text2} />} onPress={openTest} />
        <MenuItem title="Сопоставление" subtitle="Соединение слов и переводов" icon={<PuzzleIcon size={22} color={C.text2} />} onPress={openMatch} />
        <MenuItem title="Избранное" subtitle="Учить слова" icon={<FavoriteIcon size={22} color={C.favorite} filled />} onPress={openFavorites} />
        <MenuItem title="Песни" subtitle="Язык в живом контексте" icon={<MusicIcon size={22} color={C.text2} />} onPress={openSongs} />
      </ScrollView>
    </Screen>
  );
}

function TestScreen({ onBack }) {
  const [state] = useState(() => {
    const next = { mode: 'kb', limit: 20, items: [], optionPool: [], index: 0, correct: 0, selectedAnswer: null, results: [], session: {} };
    initializeTestState(next, WORDS, 'kb', 20, {}, WORDS);
    return next;
  });
  const [, redraw] = useState(0);
  const item = state.items[state.index];
  const options = useMemo(() => item ? buildTestOptions(state, item) : [], [item, state.index]);

  if (!item) {
    const result = testCompletionSummary(state);
    return (
      <Screen>
        <Header title="Результаты теста" onBack={onBack} />
        <ScrollView contentContainerStyle={[uiStyles.scrollContent, styles.resultWrap]} showsVerticalScrollIndicator={false}>
          <SectionLabel>ТЕСТ ЗАВЕРШЁН</SectionLabel>
          <Text style={styles.resultValue}>{result.accuracy_percent}%</Text>
          <Text style={styles.resultCaption}>{result.correct_count} из {result.questions_total}</Text>
          <View style={styles.resultRule} />
          <Button primary onPress={onBack}>К практике</Button>
        </ScrollView>
      </Screen>
    );
  }

  const progress = ((state.index + 1) / Math.max(1, state.items.length)) * 100;
  return (
    <Screen>
      <Header title="Проверь знания" subtitle={`${state.index + 1}/${state.items.length}`} onBack={onBack} />
      <ScrollView contentContainerStyle={uiStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topProgress}><ProgressBar value={progress} /></View>
        <View style={styles.testPrompt}><Text style={styles.testMeta}>{item.pos || 'слово'}</Text><Text style={styles.testWord}>{item.word}</Text></View>
        <View style={styles.options}>{options.map((option) => <Pressable key={`${item.id}-${option.id}`} onPress={() => { applyTestAnswer(state, option); redraw((v) => v + 1); }} style={({ pressed }) => [styles.optionButton, pressed && styles.optionPressed]}><Text style={styles.optionText}>{option.text}</Text></Pressable>)}</View>
      </ScrollView>
    </Screen>
  );
}

function MatchScreen({ onBack }) {
  const [state] = useState(() => { const next = { session: {} }; initializeMatchState(next, WORDS, 20, {}); return next; });
  const [round, setRound] = useState(() => takeNextMatchRound(state));
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [, redraw] = useState(0);
  const active = round.filter((word) => !state.solved.has(String(word.id)));
  if (!active.length && state.solvedCount < state.total) { const nextRound = takeNextMatchRound(state); if (nextRound.length) setTimeout(() => setRound(nextRound), 0); }
  if (!active.length && state.solvedCount >= state.total) {
    const result = matchCompletionSummary(state);
    return <Screen><Header title="Сопоставление" onBack={onBack} /><ScrollView contentContainerStyle={[uiStyles.scrollContent, styles.resultWrap]}><SectionLabel>ЗАВЕРШЕНО</SectionLabel><Text style={styles.resultValue}>{result.errors_count}</Text><Text style={styles.resultCaption}>ошибок</Text><View style={styles.resultRule}/><Button primary onPress={onBack}>К практике</Button></ScrollView></Screen>;
  }
  const choose = (side, word) => {
    if (side === 'left') setLeft(word); else setRight(word);
    const a = side === 'left' ? word : left;
    const b = side === 'right' ? word : right;
    if (!a || !b) return;
    if (String(a.id) === String(b.id)) markMatchSolved(state, a.id); else recordMatchMismatch(state, a.id, b.id);
    setLeft(null); setRight(null); redraw((v) => v + 1);
  };
  const selected = (side, word) => String((side === 'left' ? left : right)?.id || '') === String(word.id);
  return <Screen><Header title="Сопоставление" subtitle={`${state.solvedCount}/${state.total}`} onBack={onBack} /><ScrollView contentContainerStyle={uiStyles.scrollContent}><View style={styles.topProgress}><ProgressBar value={(state.solvedCount/Math.max(1,state.total))*100}/></View><SectionLabel>НАЙДИТЕ ПАРЫ</SectionLabel><View style={styles.matchColumns}><View style={styles.matchColumn}>{active.map((word)=><MatchCard key={`l-${word.id}`} selected={selected('left',word)} onPress={()=>choose('left',word)}>{word.word}</MatchCard>)}</View><View style={styles.matchColumn}>{[...active].reverse().map((word)=><MatchCard key={`r-${word.id}`} selected={selected('right',word)} onPress={()=>choose('right',word)}>{word.trans}</MatchCard>)}</View></View></ScrollView></Screen>;
}

function MatchCard({ children, selected, onPress }) { return <Pressable onPress={onPress} style={({ pressed }) => [styles.matchCard, selected && styles.matchCardSelected, pressed && { opacity:.82 }]}><Text style={[styles.matchText,selected&&styles.matchTextSelected]}>{children}</Text></Pressable>; }

function FavoritesScreen({ favorites, setFavorites, onBack }) {
  const rows = WORDS.filter((word) => favoriteHas(favorites, word.id));
  return <Screen><Header title="Избранное" subtitle={`${rows.length} слов`} onBack={onBack}/><ScrollView contentContainerStyle={uiStyles.scrollContent}><SectionLabel>СЛОВА</SectionLabel>{rows.length?rows.map((word,index)=><View key={word.id} style={styles.wordRow}><Text style={styles.wordIndex}>{String(index+1).padStart(2,'0')}</Text><View style={styles.wordRowText}><Text style={styles.rowWord}>{word.word}</Text><Text style={styles.rowTrans}>{word.trans}</Text></View><FavoriteButton active onPress={()=>setFavorites(toggleFavorite(favorites,word.id).ids)}/></View>):<View style={styles.emptyState}><Text style={styles.emptyTitle}>Пока пусто</Text><Text style={styles.emptyText}>Отмечайте слова звездой, чтобы тренировать их отдельно.</Text></View>}</ScrollView></Screen>;
}

function StoryTabs({ route, activeStory, onChange }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyTabs}>{(route.storyOrder||[]).map((type)=><Pressable key={type} onPress={()=>onChange(type)} style={styles.storyTab}><Text style={[styles.storyTabText,activeStory===type&&styles.storyTabActive]}>{route.stories[type]?.label||type}</Text></Pressable>)}</ScrollView>;
}

function PathScreen({ onOpenStation }) {
  const [activeStory,setActiveStory]=useState(()=>ROUTE.storyOrder?.[0]||'');
  const story=ROUTE.stories?.[activeStory];
  const stations=story?.stations||[];
  return <Screen bottomNav><Header title="Alan Til" subtitle="Путь" trailing={<HeaderCircleButton icon={<InfoIcon size={20} color={C.text2}/>} accessibilityLabel="Подсказка" onPress={()=>{}}/>}/><View style={styles.pathControls}><StoryTabs route={ROUTE} activeStory={activeStory} onChange={setActiveStory}/><View style={styles.storyProgress}><Text style={styles.storyProgressAccent}>0%</Text><Text style={styles.storyProgressCount}>0/{stations.length}</Text></View></View><ScrollView contentContainerStyle={styles.pathContent} showsVerticalScrollIndicator={false}>{(story?.catalogs||[]).map((catalog)=><View key={`${activeStory}-${catalog.dictionaryId}`} style={styles.catalogBlock}><SectionLabel>{catalog.name||'Словарь'}</SectionLabel>{(catalog.sections||[]).map((section)=><View key={`${catalog.dictionaryId}-${section.sectionId}`} style={styles.sectionBlock}><Text style={styles.sectionHeading}>{section.name}</Text><View style={styles.routeRail}/>{(section.stations||[]).map((station,index)=>{const right=index%2===1;return <Pressable key={station.key} onPress={()=>onOpenStation(station)} style={[styles.stationNode,right?styles.stationRight:styles.stationLeft]}><View style={styles.stationProgressRing}><View style={styles.millstoneFace}><View style={styles.millstoneHole}/><Text style={styles.stationOrdinal}>{String(station.setNumber||index+1).padStart(2,'0')}</Text></View></View><Text numberOfLines={2} style={styles.stationLabel}>{station.name||`Этап ${index+1}`}</Text><Text style={styles.stationCount}>{station.words.length} слов</Text></Pressable>;})}</View>)}</View>)}{!story?<View style={styles.emptyState}><Text style={styles.emptyTitle}>Маршрут недоступен</Text><Text style={styles.emptyText}>Нет данных для построения пути.</Text></View>:null}</ScrollView><View style={styles.routeScale}>{[0,1,2,3,4,5,6,7,8].map((value)=>value===4?<View key={value} style={styles.scaleDiamond}/>:<View key={value} style={styles.scaleDot}/>)}</View></Screen>;
}

function BootScreen() { return <View style={styles.boot}><Text style={styles.bootBrand}>Alan Til</Text><View style={styles.bootDot}/></View>; }

export default function App() {
  const [bootstrapped,setBootstrapped]=useState(false);
  const [onboardingComplete,setOnboardingComplete]=useState(true);
  const [tab,setTab]=useState('path');
  const [screen,setScreen]=useState('home');
  const [favorites,setFavoritesState]=useState(()=>new Set());
  const [songFavorites,setSongFavoritesState]=useState(()=>new Set());
  const [settings,setSettingsState]=useState(()=>({...DEFAULT_USER_SETTINGS}));
  const [station,setStation]=useState(null);
  const [learnContext,setLearnContext]=useState(null);
  const [testContext,setTestContext]=useState(null);

  useEffect(()=>{let alive=true;(async()=>{const [savedSettings,savedFavorites,savedSongFavorites,completed]=await Promise.all([loadNativeSettings(),loadNativeFavorites(),loadNativeSongFavorites(),hasCompletedNativeOnboarding()]);if(!alive)return;setSettingsState(savedSettings);setFavoritesState(savedFavorites);setSongFavoritesState(savedSongFavorites);setOnboardingComplete(completed);setBootstrapped(true);})();return()=>{alive=false};},[]);

  const setFavorites=(next)=>{const value=next instanceof Set?next:new Set(next||[]);setFavoritesState(new Set(value));saveNativeFavorites(value).catch(()=>{});};
  const setSongFavorites=(next)=>{const value=next instanceof Set?next:new Set(next||[]);setSongFavoritesState(new Set(value));saveNativeSongFavorites(value).catch(()=>{});};
  const setSettings=(next)=>{setSettingsState(next);saveNativeSettings(next).catch(()=>{});};
  const changeTab=(next)=>{setTab(next);setScreen('home');setStation(null);};
  const openStation=(nextStation)=>{setStation(nextStation);setScreen('station');};
  const backToPath=()=>{setScreen('home');setStation(null);};

  if(!bootstrapped) return <SafeAreaProvider><StatusBar style="dark"/><SafeAreaView style={styles.safe}><BootScreen/></SafeAreaView></SafeAreaProvider>;
  if(!onboardingComplete) return <SafeAreaProvider><StatusBar style="dark"/><SafeAreaView style={styles.safe} edges={['top','left','right','bottom']}><OnboardingScreen initialSettings={settings} onComplete={(nextSettings,final)=>{if(nextSettings)setSettings(nextSettings);if(final){markNativeOnboardingComplete().catch(()=>{});setOnboardingComplete(true);}}} onLogin={()=>{markNativeOnboardingComplete().catch(()=>{});setOnboardingComplete(true);setTab('profile');setScreen('account');}}/></SafeAreaView></SafeAreaProvider>;

  let content; let showNav=true;
  if(screen==='learn'&&learnContext){content=<LearnScreen words={learnContext.words} mode={learnContext.mode} station={learnContext.station} favorites={favorites} setFavorites={setFavorites} onBack={()=>setScreen('station')}/>;showNav=false;}
  else if(screen==='stationTest'&&testContext){content=<StationTestScreen station={testContext.station} allWords={WORDS} mode={testContext.mode} onBack={()=>setScreen('station')}/>;showNav=false;}
  else if(tab==='path'&&screen==='station'&&station){content=<StationScreen station={station} favorites={favorites} setFavorites={setFavorites} onBack={backToPath} onLearn={(words,mode)=>{setLearnContext({words,mode,station});setScreen('learn');}} onTest={(target,mode)=>{setTestContext({station:target,mode});setScreen('stationTest');}}/>;}
  else if(tab==='practice'&&screen==='test'){content=<TestScreen onBack={()=>setScreen('home')}/>;showNav=false;}
  else if(tab==='practice'&&screen==='match'){content=<MatchScreen onBack={()=>setScreen('home')}/>;showNav=false;}
  else if(tab==='practice'&&screen==='favorites'){content=<FavoritesScreen favorites={favorites} setFavorites={setFavorites} onBack={()=>setScreen('home')}/>;showNav=false;}
  else if(tab==='practice'&&screen==='songs'){content=<SongsScreen songs={[]} words={WORDS} onBack={()=>setScreen('home')} favoriteIds={songFavorites} onFavorite={(id)=>setSongFavorites(toggleFavorite(songFavorites,id).ids)}/>;showNav=false;}
  else if(tab==='practice'){content=<PracticeHome openTest={()=>setScreen('test')} openMatch={()=>setScreen('match')} openFavorites={()=>setScreen('favorites')} openSongs={()=>setScreen('songs')}/>;}
  else if(tab==='profile'&&screen==='account'){content=<AccountScreen onBack={()=>setScreen('home')}/>;showNav=false;}
  else if(tab==='profile'){content=<ProfileArea words={WORDS} settings={settings} onSettingsChange={setSettings} onAccount={()=>setScreen('account')}/>;}
  else{content=<PathScreen onOpenStation={openStation}/>;}

  return <SafeAreaProvider><StatusBar style="dark"/><SafeAreaView style={styles.safe} edges={['top','left','right','bottom']}><View style={styles.app}>{content}{showNav?<BottomNav tab={tab} onChange={changeTab}/>:null}</View></SafeAreaView></SafeAreaProvider>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:C.appBg},app:{flex:1,backgroundColor:C.appBg,overflow:'hidden'},
  boot:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:C.appBg},bootBrand:{fontSize:30,fontWeight:'900',color:C.text1},bootDot:{width:7,height:7,borderRadius:4,backgroundColor:C.accent,marginTop:18},
  topProgress:{marginBottom:18,paddingHorizontal:4},testPrompt:{minHeight:206,alignItems:'center',justifyContent:'center',paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:C.lineSoft,marginBottom:16},testMeta:{fontSize:10,fontWeight:'700',letterSpacing:.45,color:C.text3,textTransform:'uppercase',marginBottom:10},testWord:{fontSize:34,fontWeight:'900',lineHeight:39,color:C.text1,textAlign:'center'},options:{gap:9},optionButton:{minHeight:52,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,justifyContent:'center',paddingHorizontal:14,paddingVertical:10},optionPressed:{transform:[{translateY:1}],borderColor:C.accent,backgroundColor:C.accentSoft},optionText:{fontSize:15,fontWeight:'700',lineHeight:19,color:C.text1,textAlign:'center'},
  resultWrap:{alignItems:'stretch',paddingTop:theme.control.header+42},resultValue:{fontSize:58,fontWeight:'800',lineHeight:64,color:C.text1,textAlign:'center',marginTop:18},resultCaption:{fontSize:13,color:C.text2,textAlign:'center',marginTop:4},resultRule:{height:1,backgroundColor:C.lineSoft,marginVertical:28},
  matchColumns:{flexDirection:'row',gap:8},matchColumn:{flex:1,gap:8},matchCard:{minHeight:50,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,paddingHorizontal:8,paddingVertical:9,alignItems:'center',justifyContent:'center'},matchCardSelected:{borderColor:C.accentStrong,backgroundColor:C.accentSoft},matchText:{fontSize:13,fontWeight:'700',lineHeight:16,color:C.text1,textAlign:'center'},matchTextSelected:{color:C.accentStrong},
  wordRow:{minHeight:56,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft,paddingVertical:4},wordIndex:{width:36,fontSize:10,fontWeight:'700',color:C.text3,textAlign:'center'},wordRowText:{flex:1,minWidth:0,paddingHorizontal:7},rowWord:{fontSize:16,fontWeight:'800',lineHeight:19,color:C.text1},rowTrans:{fontSize:13,lineHeight:16,color:C.text2,marginTop:2},emptyState:{paddingVertical:32,paddingHorizontal:18,borderWidth:1,borderStyle:'dashed',borderColor:C.line,borderRadius:theme.radius.md,alignItems:'center'},emptyTitle:{fontSize:18,fontWeight:'800',color:C.text1,marginBottom:5},emptyText:{fontSize:13,lineHeight:19,color:C.text2,textAlign:'center'},
  pathControls:{position:'absolute',zIndex:24,top:theme.control.header,left:0,right:0,height:68,paddingTop:8,backgroundColor:'rgba(238,233,223,.90)'},storyTabs:{height:32,alignItems:'center',paddingHorizontal:8,gap:3},storyTab:{height:32,minWidth:86,paddingHorizontal:7,alignItems:'center',justifyContent:'center'},storyTabText:{fontSize:11,fontWeight:'700',color:C.text3,opacity:.64},storyTabActive:{color:C.text1,opacity:1},storyProgress:{height:22,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},storyProgressAccent:{fontSize:11,fontWeight:'700',color:C.accentStrong},storyProgressCount:{fontSize:11,fontWeight:'700',color:C.text3},
  pathContent:{paddingTop:theme.control.header+68+76,paddingHorizontal:20,paddingRight:50,paddingBottom:theme.control.nav+108},catalogBlock:{gap:22,marginBottom:70},sectionBlock:{position:'relative',gap:22,alignItems:'center',marginBottom:92},sectionHeading:{fontSize:14,fontWeight:'800',color:C.text1,textAlign:'center'},routeRail:{position:'absolute',top:46,bottom:-20,left:'50%',width:1,borderStyle:'dashed',borderLeftWidth:1,borderLeftColor:'rgba(102,97,88,.28)'},stationNode:{position:'relative',width:60,height:104,alignItems:'center',marginBottom:43},stationLeft:{transform:[{translateX:-64}]},stationRight:{transform:[{translateX:64}]},stationProgressRing:{width:60,height:60,borderRadius:30,padding:2,backgroundColor:'rgba(41,39,34,.10)',alignItems:'center',justifyContent:'center'},millstoneFace:{position:'relative',width:56,height:56,borderWidth:1,borderColor:'rgba(75,70,61,.42)',borderRadius:27,backgroundColor:'#d8d0c2',alignItems:'center',justifyContent:'center',shadowColor:'#292722',shadowOpacity:.10,shadowRadius:6,shadowOffset:{width:0,height:4},elevation:2},millstoneHole:{position:'absolute',width:9,height:9,borderRadius:5,borderWidth:1,borderColor:'rgba(72,66,56,.18)',backgroundColor:C.appBg},stationOrdinal:{fontSize:8,fontWeight:'700',color:C.text2,marginTop:19},stationLabel:{position:'absolute',top:65,width:142,fontSize:10,fontWeight:'700',lineHeight:12,color:C.text1,textAlign:'center'},stationCount:{position:'absolute',top:91,fontSize:8,fontWeight:'700',color:C.text3},routeScale:{position:'absolute',zIndex:25,right:4,top:'28%',bottom:'20%',width:26,alignItems:'center',justifyContent:'space-evenly'},scaleDot:{width:4,height:4,borderRadius:2,backgroundColor:'rgba(41,39,34,.18)'},scaleDiamond:{width:9,height:9,borderWidth:1,borderColor:'rgba(41,39,34,.55)',transform:[{rotate:'45deg'}]},
});
