import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { STARTER_DICTIONARY } from '../src/data/starter-dictionary.js';
import { initializeTestState, buildTestOptions, applyTestAnswer, testCompletionSummary } from '../packages/alantil-core/test.js';
import { initializeMatchState, takeNextMatchRound, markMatchSolved, recordMatchMismatch, matchCompletionSummary } from '../packages/alantil-core/match.js';
import { toggleFavorite, favoriteHas } from '../packages/alantil-core/favorites.js';

const PAPER = '#eee9df';
const INK = '#2f2a25';
const MUTED = '#776f66';
const LINE = '#c9c0b4';
const ACCENT = '#3d3832';

function starterWords() {
  return STARTER_DICTIONARY.map((row) => ({
    id: String(row.word_id),
    word: String(row.word_alan_cyrillic || ''),
    trans: String(row.translation_ru || ''),
    pos: String(row.pos || ''),
    synonyms: String(row.synonyms || ''),
    story_id: String(row.story_id || ''),
    story_name: String(row.story_name_ru || ''),
    dictionary_id: String(row.dictionary_id || ''),
    dictionary_name: String(row.dictionary_name_ru || ''),
    section_id: String(row.section_id || ''),
    section_name: String(row.section_name_ru || ''),
    set_id: row.set_id == null ? '' : String(row.set_id),
    set_name: String(row.set_name_ru || ''),
  })).filter((word) => word.id && word.word && word.trans);
}

const WORDS = starterWords();

function Header({ title, subtitle }) {
  return <View style={styles.header}><Text style={styles.headerTitle}>{title}</Text>{subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}</View>;
}

function Button({ children, onPress, primary = false, disabled = false }) {
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, primary && styles.buttonPrimary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}><Text style={[styles.buttonText, primary && styles.buttonPrimaryText]}>{children}</Text></Pressable>;
}

function PracticeHome({ openTest, openMatch, openFavorites }) {
  return <ScrollView contentContainerStyle={styles.page}><Header title="Практика" /><View style={styles.menu}><Button onPress={openTest}>Тест</Button><Button onPress={openMatch}>Сопоставление слов</Button><Button onPress={openFavorites}>Избранное</Button></View></ScrollView>;
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
    return <ScrollView contentContainerStyle={styles.page}><Header title="Результат" subtitle={`${result.correct_count}/${result.questions_total} · ${result.accuracy_percent}%`} /><Button primary onPress={onBack}>К практике</Button></ScrollView>;
  }
  return <ScrollView contentContainerStyle={styles.page}><Header title="Тест" subtitle={`${state.index + 1}/${state.items.length}`} /><View style={styles.card}><Text style={styles.word}>{item.word}</Text></View><View style={styles.options}>{options.map((option) => <Button key={`${item.id}-${option.id}`} onPress={() => { applyTestAnswer(state, option); redraw((v) => v + 1); }}>{option.text}</Button>)}</View><Button onPress={onBack}>Назад</Button></ScrollView>;
}

function MatchScreen({ onBack }) {
  const [state] = useState(() => {
    const next = { session: {} };
    initializeMatchState(next, WORDS, 20, {});
    return next;
  });
  const [round, setRound] = useState(() => takeNextMatchRound(state));
  const [left, setLeft] = useState(null);
  const [right, setRight] = useState(null);
  const [, redraw] = useState(0);
  const active = round.filter((word) => !state.solved.has(String(word.id)));
  if (!active.length) {
    if (state.solvedCount < state.total) {
      const nextRound = takeNextMatchRound(state);
      if (nextRound.length) setTimeout(() => setRound(nextRound), 0);
    } else {
      const result = matchCompletionSummary(state);
      return <ScrollView contentContainerStyle={styles.page}><Header title="Сопоставление" subtitle={`Ошибок: ${result.errors_count}`} /><Button primary onPress={onBack}>К практике</Button></ScrollView>;
    }
  }
  const choose = (side, word) => {
    if (side === 'left') setLeft(word); else setRight(word);
    const a = side === 'left' ? word : left;
    const b = side === 'right' ? word : right;
    if (!a || !b) return;
    if (String(a.id) === String(b.id)) markMatchSolved(state, a.id); else recordMatchMismatch(state, a.id, b.id);
    setLeft(null); setRight(null); redraw((v) => v + 1);
  };
  return <ScrollView contentContainerStyle={styles.page}><Header title="Сопоставление" subtitle={`${state.solvedCount}/${state.total}`} /><View style={styles.matchColumns}><View style={styles.matchColumn}>{active.map((word) => <Button key={`l-${word.id}`} onPress={() => choose('left', word)}>{word.word}</Button>)}</View><View style={styles.matchColumn}>{[...active].reverse().map((word) => <Button key={`r-${word.id}`} onPress={() => choose('right', word)}>{word.trans}</Button>)}</View></View><Button onPress={onBack}>Назад</Button></ScrollView>;
}

function FavoritesScreen({ favorites, setFavorites, onBack }) {
  const rows = WORDS.filter((word) => favoriteHas(favorites, word.id));
  return <ScrollView contentContainerStyle={styles.page}><Header title="Избранное" subtitle={`${rows.length} слов`} />{rows.length ? rows.map((word) => <View key={word.id} style={styles.wordRow}><View style={styles.wordRowText}><Text style={styles.rowWord}>{word.word}</Text><Text style={styles.rowTrans}>{word.trans}</Text></View><Pressable onPress={() => setFavorites(toggleFavorite(favorites, word.id).ids)}><Text style={styles.star}>★</Text></Pressable></View>) : <Text style={styles.empty}>Избранных слов пока нет.</Text>}<Button onPress={onBack}>Назад</Button></ScrollView>;
}

function PathScreen({ favorites, setFavorites }) {
  const groups = useMemo(() => {
    const map = new Map();
    WORDS.forEach((word) => { const key = word.story_name || 'Путь'; if (!map.has(key)) map.set(key, []); map.get(key).push(word); });
    return [...map.entries()];
  }, []);
  return <ScrollView contentContainerStyle={styles.page}><Header title="Alan Til" subtitle="Путь" />{groups.map(([story, words]) => <View key={story} style={styles.story}><Text style={styles.storyTitle}>[ {story} ]</Text>{words.slice(0, 24).map((word, index) => <View key={word.id} style={styles.stationRow}><View style={styles.station}><Text style={styles.stationNumber}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.stationText}><Text style={styles.rowWord}>{word.word}</Text><Text style={styles.rowTrans}>{word.trans}</Text></View><Pressable onPress={() => setFavorites(toggleFavorite(favorites, word.id).ids)}><Text style={styles.star}>{favoriteHas(favorites, word.id) ? '★' : '☆'}</Text></Pressable></View>)}</View>)}</ScrollView>;
}

function ProfileScreen() {
  return <ScrollView contentContainerStyle={styles.page}><Header title="Профиль" /><View style={styles.profileAvatar}><Text style={styles.avatarText}>A</Text></View><Text style={styles.profileTitle}>Alan Til 16.0</Text><Text style={styles.profileText}>Мобильный интерфейс использует общий core, выделенный из Web 13.15.12. Локальные экраны не содержат собственной логики теста, сопоставления и избранного.</Text><View style={styles.stats}><Text style={styles.stat}>{WORDS.length}</Text><Text style={styles.statLabel}>слов в стартовом офлайн-словаре</Text></View></ScrollView>;
}

function BottomNav({ tab, setTab }) {
  return <View style={styles.nav}>{[['practice','Практика'],['path','Путь'],['profile','Профиль']].map(([id,label]) => <Pressable key={id} onPress={() => setTab(id)} style={styles.navItem}><Text style={[styles.navLabel, tab === id && styles.navActive]}>{label}</Text></Pressable>)}</View>;
}

export default function App() {
  const [tab, setTab] = useState('path');
  const [screen, setScreen] = useState('home');
  const [favorites, setFavorites] = useState(() => new Set());
  const changeTab = (next) => { setTab(next); setScreen('home'); };
  let content;
  if (tab === 'practice' && screen === 'test') content = <TestScreen onBack={() => setScreen('home')} />;
  else if (tab === 'practice' && screen === 'match') content = <MatchScreen onBack={() => setScreen('home')} />;
  else if (tab === 'practice' && screen === 'favorites') content = <FavoritesScreen favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen('home')} />;
  else if (tab === 'practice') content = <PracticeHome openTest={() => setScreen('test')} openMatch={() => setScreen('match')} openFavorites={() => setScreen('favorites')} />;
  else if (tab === 'profile') content = <ProfileScreen />;
  else content = <PathScreen favorites={favorites} setFavorites={setFavorites} />;
  return <SafeAreaProvider><StatusBar style="dark" /><SafeAreaView style={styles.safe} edges={['top','left','right']}><View style={styles.app}>{content}<BottomNav tab={tab} setTab={changeTab} /></View></SafeAreaView></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:PAPER},app:{flex:1,backgroundColor:PAPER},page:{padding:18,paddingBottom:110,gap:14},header:{alignItems:'center',paddingVertical:8,gap:2},headerTitle:{fontSize:22,fontWeight:'700',color:INK},headerSubtitle:{fontSize:13,color:MUTED},menu:{gap:10},button:{minHeight:48,borderWidth:1,borderColor:LINE,borderRadius:14,alignItems:'center',justifyContent:'center',paddingHorizontal:14,backgroundColor:'rgba(255,255,255,0.25)'},buttonPrimary:{backgroundColor:ACCENT,borderColor:ACCENT},buttonText:{fontSize:16,color:INK,textAlign:'center'},buttonPrimaryText:{color:PAPER},disabled:{opacity:.4},pressed:{opacity:.65},card:{minHeight:220,borderWidth:1,borderColor:LINE,borderRadius:22,alignItems:'center',justifyContent:'center',padding:24},word:{fontSize:34,fontWeight:'700',color:INK,textAlign:'center'},options:{gap:10},matchColumns:{flexDirection:'row',gap:8},matchColumn:{flex:1,gap:8},empty:{color:MUTED,textAlign:'center',paddingVertical:40},wordRow:{flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:LINE,paddingVertical:10,gap:10},wordRowText:{flex:1},rowWord:{fontSize:17,fontWeight:'600',color:INK},rowTrans:{fontSize:14,color:MUTED,marginTop:2},star:{fontSize:26,color:INK},story:{gap:8,marginBottom:22},storyTitle:{fontSize:16,fontWeight:'700',textAlign:'center',color:INK,marginVertical:8},stationRow:{flexDirection:'row',alignItems:'center',gap:12,minHeight:66},station:{width:54,height:54,borderRadius:27,borderWidth:2,borderColor:INK,alignItems:'center',justifyContent:'center'},stationNumber:{fontSize:14,fontWeight:'700',color:INK},stationText:{flex:1},profileAvatar:{width:132,height:132,borderRadius:66,borderWidth:2,borderColor:INK,alignSelf:'center',alignItems:'center',justifyContent:'center',marginTop:20},avatarText:{fontSize:54,fontWeight:'700',color:INK},profileTitle:{fontSize:20,fontWeight:'700',color:INK,textAlign:'center'},profileText:{fontSize:15,lineHeight:22,color:MUTED,textAlign:'center'},stats:{alignItems:'center',padding:20,borderTopWidth:1,borderBottomWidth:1,borderColor:LINE},stat:{fontSize:32,fontWeight:'700',color:INK},statLabel:{fontSize:13,color:MUTED},nav:{position:'absolute',left:0,right:0,bottom:0,height:76,borderTopWidth:1,borderTopColor:LINE,backgroundColor:PAPER,flexDirection:'row',paddingBottom:8},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navLabel:{fontSize:13,color:MUTED},navActive:{color:INK,fontWeight:'800'}
});
