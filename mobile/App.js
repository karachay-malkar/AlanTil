import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { STARTER_DICTIONARY } from '../src/data/starter-dictionary.js';
import { initializeTestState, buildTestOptions, applyTestAnswer, testCompletionSummary } from '../packages/alantil-core/test.js';
import { initializeMatchState, takeNextMatchRound, markMatchSolved, recordMatchMismatch, matchCompletionSummary } from '../packages/alantil-core/match.js';
import { toggleFavorite, favoriteHas } from '../packages/alantil-core/favorites.js';
import { BottomNav, Button, FavoriteButton, Header, HeaderCircleButton, MenuItem, ProgressBar, Screen, SectionLabel, uiStyles } from './ui/components.js';
import { theme } from './ui/theme.js';

const C = theme.colors;

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

function PracticeGlyph({ type }) {
  if (type === 'test') return <Text style={styles.menuGlyph}>✓</Text>;
  if (type === 'match') return <Text style={styles.menuGlyph}>↔</Text>;
  return <Text style={[styles.menuGlyph,{color:C.favorite}]}>★</Text>;
}

function PracticeHome({ openTest, openMatch, openFavorites }) {
  return (
    <Screen>
      <Header title="Практика" />
      <ScrollView contentContainerStyle={uiStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionLabel>ТРЕНИРОВКА</SectionLabel>
        <MenuItem title="Тест" subtitle="Проверка перевода и значения" icon={<PracticeGlyph type="test" />} onPress={openTest} />
        <MenuItem title="Сопоставление слов" subtitle="Найдите пары без ошибок" icon={<PracticeGlyph type="match" />} onPress={openMatch} />
        <MenuItem title="Избранное" subtitle="Практика только с отмеченными словами" icon={<PracticeGlyph type="favorite" />} onPress={openFavorites} />
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
        <Header title="Результат" onBack={onBack} />
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
      <Header title="Тест" subtitle={`${state.index + 1}/${state.items.length}`} onBack={onBack} />
      <ScrollView contentContainerStyle={uiStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topProgress}><ProgressBar value={progress} /></View>
        <View style={styles.testPrompt}>
          <Text style={styles.testMeta}>{item.pos || 'слово'}</Text>
          <Text style={styles.testWord}>{item.word}</Text>
        </View>
        <View style={styles.options}>
          {options.map((option) => (
            <Pressable
              key={`${item.id}-${option.id}`}
              onPress={() => { applyTestAnswer(state, option); redraw((v) => v + 1); }}
              style={({ pressed }) => [styles.optionButton, pressed && styles.optionPressed]}
            >
              <Text style={styles.optionText}>{option.text}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
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

  if (!active.length && state.solvedCount < state.total) {
    const nextRound = takeNextMatchRound(state);
    if (nextRound.length) setTimeout(() => setRound(nextRound), 0);
  }

  if (!active.length && state.solvedCount >= state.total) {
    const result = matchCompletionSummary(state);
    return (
      <Screen>
        <Header title="Сопоставление" onBack={onBack} />
        <ScrollView contentContainerStyle={[uiStyles.scrollContent, styles.resultWrap]} showsVerticalScrollIndicator={false}>
          <SectionLabel>ЗАВЕРШЕНО</SectionLabel>
          <Text style={styles.resultValue}>{result.errors_count}</Text>
          <Text style={styles.resultCaption}>ошибок</Text>
          <View style={styles.resultRule} />
          <Button primary onPress={onBack}>К практике</Button>
        </ScrollView>
      </Screen>
    );
  }

  const choose = (side, word) => {
    if (side === 'left') setLeft(word); else setRight(word);
    const a = side === 'left' ? word : left;
    const b = side === 'right' ? word : right;
    if (!a || !b) return;
    if (String(a.id) === String(b.id)) markMatchSolved(state, a.id); else recordMatchMismatch(state, a.id, b.id);
    setLeft(null);
    setRight(null);
    redraw((v) => v + 1);
  };

  const selected = (side, word) => String((side === 'left' ? left : right)?.id || '') === String(word.id);
  return (
    <Screen>
      <Header title="Сопоставление" subtitle={`${state.solvedCount}/${state.total}`} onBack={onBack} />
      <ScrollView contentContainerStyle={uiStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.topProgress}><ProgressBar value={(state.solvedCount / Math.max(1,state.total)) * 100} /></View>
        <SectionLabel>НАЙДИТЕ ПАРЫ</SectionLabel>
        <View style={styles.matchColumns}>
          <View style={styles.matchColumn}>
            {active.map((word) => <MatchCard key={`l-${word.id}`} selected={selected('left', word)} onPress={() => choose('left', word)}>{word.word}</MatchCard>)}
          </View>
          <View style={styles.matchColumn}>
            {[...active].reverse().map((word) => <MatchCard key={`r-${word.id}`} selected={selected('right', word)} onPress={() => choose('right', word)}>{word.trans}</MatchCard>)}
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function MatchCard({ children, selected, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.matchCard, selected && styles.matchCardSelected, pressed && { opacity: 0.82 }]}>
      <Text style={[styles.matchText, selected && styles.matchTextSelected]}>{children}</Text>
    </Pressable>
  );
}

function FavoritesScreen({ favorites, setFavorites, onBack }) {
  const rows = WORDS.filter((word) => favoriteHas(favorites, word.id));
  return (
    <Screen>
      <Header title="Избранное" subtitle={`${rows.length} слов`} onBack={onBack} />
      <ScrollView contentContainerStyle={uiStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionLabel>СЛОВА</SectionLabel>
        {rows.length ? rows.map((word, index) => (
          <View key={word.id} style={styles.wordRow}>
            <Text style={styles.wordIndex}>{String(index + 1).padStart(2,'0')}</Text>
            <View style={styles.wordRowText}>
              <Text style={styles.rowWord}>{word.word}</Text>
              <Text style={styles.rowTrans}>{word.trans}</Text>
            </View>
            <FavoriteButton active onPress={() => setFavorites(toggleFavorite(favorites, word.id).ids)} />
          </View>
        )) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Пока пусто</Text>
            <Text style={styles.emptyText}>Отмечайте слова звездой, чтобы тренировать их отдельно.</Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function groupStories() {
  const map = new Map();
  WORDS.forEach((word) => {
    const key = word.story_name || 'Путь';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(word);
  });
  return [...map.entries()];
}

function PathScreen({ favorites, setFavorites }) {
  const groups = useMemo(groupStories, []);
  return (
    <Screen bottomNav>
      <Header title="Alan Til" subtitle="Путь" trailing={<HeaderCircleButton label="?" accessibilityLabel="Подсказка" onPress={() => {}} />} />
      <ScrollView contentContainerStyle={[uiStyles.scrollContentWithNav, styles.pathContent]} showsVerticalScrollIndicator={false}>
        {groups.map(([story, words], storyIndex) => (
          <View key={story} style={styles.storyBlock}>
            <SectionLabel>{story.toUpperCase()}</SectionLabel>
            <View style={styles.routeRail} />
            {words.slice(0, 24).map((word, index) => {
              const lane = index % 3;
              const mastered = index < 3 && storyIndex === 0;
              return (
                <View key={word.id} style={[styles.routeRow, lane === 0 && styles.routeLeft, lane === 1 && styles.routeCenter, lane === 2 && styles.routeRight]}>
                  <View style={styles.stationLabelWrap}>
                    <Text style={styles.stationWord} numberOfLines={1}>{word.word}</Text>
                    <Text style={styles.stationTrans} numberOfLines={1}>{word.trans}</Text>
                  </View>
                  <View style={[styles.stationStone, mastered && styles.stationStoneMastered]}>
                    <View style={styles.stationInner}><Text style={[styles.stationNumber, mastered && { color:C.accentStrong }]}>{String(index + 1).padStart(2,'0')}</Text></View>
                  </View>
                  <FavoriteButton active={favoriteHas(favorites, word.id)} onPress={() => setFavorites(toggleFavorite(favorites, word.id).ids)} />
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

function ProfileScreen({ openStats, openSettings, openAccount }) {
  return (
    <Screen bottomNav>
      <Header title="Профиль" />
      <ScrollView contentContainerStyle={uiStyles.scrollContentWithNav} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHero}>
          <View style={styles.profileAvatar}><Text style={styles.avatarText}>A</Text></View>
          <Text style={styles.profileName}>Гость</Text>
          <Text style={styles.profileSub}>Alan Til · 16.1</Text>
        </View>
        <View style={styles.profileMetrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{WORDS.length}</Text><Text style={styles.metricLabel}>слов</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Text style={styles.metricValue}>0</Text><Text style={styles.metricLabel}>освоено</Text></View>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Text style={styles.metricValue}>0%</Text><Text style={styles.metricLabel}>прогресс</Text></View>
        </View>
        <SectionLabel>ПРОФИЛЬ</SectionLabel>
        <MenuItem title="Статистика" subtitle="Прогресс, сессии и сложные слова" icon={<Text style={styles.profileMenuGlyph}>⌁</Text>} onPress={openStats} />
        <MenuItem title="Настройки" subtitle="Язык, письменность и размер текста" icon={<Text style={styles.profileMenuGlyph}>⚙</Text>} onPress={openSettings} />
        <MenuItem title="Аккаунт" subtitle="Вход и синхронизация прогресса" icon={<Text style={styles.profileMenuGlyph}>○</Text>} onPress={openAccount} />
      </ScrollView>
    </Screen>
  );
}

function PlaceholderProfileScreen({ title, subtitle, onBack }) {
  return (
    <Screen>
      <Header title={title} onBack={onBack} />
      <ScrollView contentContainerStyle={uiStyles.scrollContent} showsVerticalScrollIndicator={false}>
        <SectionLabel>{title.toUpperCase()}</SectionLabel>
        <View style={styles.placeholderPanel}>
          <Text style={styles.placeholderTitle}>{title}</Text>
          <Text style={styles.placeholderText}>{subtitle}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

export default function App() {
  const [tab, setTab] = useState('path');
  const [screen, setScreen] = useState('home');
  const [favorites, setFavorites] = useState(() => new Set());
  const changeTab = (next) => { setTab(next); setScreen('home'); };
  const backProfile = () => setScreen('home');

  let content;
  let showNav = true;
  if (tab === 'practice' && screen === 'test') { content = <TestScreen onBack={() => setScreen('home')} />; showNav = false; }
  else if (tab === 'practice' && screen === 'match') { content = <MatchScreen onBack={() => setScreen('home')} />; showNav = false; }
  else if (tab === 'practice' && screen === 'favorites') { content = <FavoritesScreen favorites={favorites} setFavorites={setFavorites} onBack={() => setScreen('home')} />; showNav = false; }
  else if (tab === 'practice') content = <PracticeHome openTest={() => setScreen('test')} openMatch={() => setScreen('match')} openFavorites={() => setScreen('favorites')} />;
  else if (tab === 'profile' && screen === 'stats') { content = <PlaceholderProfileScreen title="Статистика" subtitle="Экран уже переведён на новую shell-систему. Полные данные подключаются через общий core, без отдельной мобильной бизнес-логики." onBack={backProfile} />; showNav = false; }
  else if (tab === 'profile' && screen === 'settings') { content = <PlaceholderProfileScreen title="Настройки" subtitle="Визуальная структура приведена к сайту; сохранение настроек остаётся в общем core и платформенном storage adapter." onBack={backProfile} />; showNav = false; }
  else if (tab === 'profile' && screen === 'account') { content = <PlaceholderProfileScreen title="Аккаунт" subtitle="Native OAuth и синхронизация подключаются отдельно; визуальная оболочка больше не использует старую мобильную стилизацию." onBack={backProfile} />; showNav = false; }
  else if (tab === 'profile') content = <ProfileScreen openStats={() => setScreen('stats')} openSettings={() => setScreen('settings')} openAccount={() => setScreen('account')} />;
  else content = <PathScreen favorites={favorites} setFavorites={setFavorites} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={styles.safe} edges={['top','left','right','bottom']}>
        <View style={styles.app}>
          {content}
          {showNav ? <BottomNav tab={tab} onChange={changeTab} /> : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:C.appBg},
  app:{flex:1,backgroundColor:C.appBg,overflow:'hidden'},
  menuGlyph:{fontSize:20,fontWeight:'700',color:C.text2},
  topProgress:{marginBottom:18,paddingHorizontal:4},
  testPrompt:{minHeight:206,alignItems:'center',justifyContent:'center',paddingHorizontal:20,borderBottomWidth:1,borderBottomColor:C.lineSoft,marginBottom:16},
  testMeta:{fontSize:10,fontWeight:'700',letterSpacing:.45,color:C.text3,textTransform:'uppercase',marginBottom:10},
  testWord:{fontSize:34,fontWeight:'860',lineHeight:39,color:C.text1,textAlign:'center'},
  options:{gap:9},
  optionButton:{minHeight:52,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,justifyContent:'center',paddingHorizontal:14,paddingVertical:10},
  optionPressed:{transform:[{translateY:1}],borderColor:C.accent,backgroundColor:C.accentSoft},
  optionText:{fontSize:15,fontWeight:'720',lineHeight:19,color:C.text1,textAlign:'center'},
  resultWrap:{alignItems:'stretch',paddingTop:theme.control.header + 42},
  resultValue:{fontSize:58,fontWeight:'800',lineHeight:64,color:C.text1,textAlign:'center',marginTop:18},
  resultCaption:{fontSize:13,color:C.text2,textAlign:'center',marginTop:4},
  resultRule:{height:1,backgroundColor:C.lineSoft,marginVertical:28},
  matchColumns:{flexDirection:'row',gap:8},
  matchColumn:{flex:1,gap:8},
  matchCard:{minHeight:50,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,paddingHorizontal:8,paddingVertical:9,alignItems:'center',justifyContent:'center'},
  matchCardSelected:{borderColor:C.accentStrong,backgroundColor:C.accentSoft},
  matchText:{fontSize:13,fontWeight:'700',lineHeight:16,color:C.text1,textAlign:'center'},
  matchTextSelected:{color:C.accentStrong},
  wordRow:{minHeight:56,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft,paddingVertical:4},
  wordIndex:{width:36,fontSize:10,fontWeight:'700',color:C.text3,textAlign:'center'},
  wordRowText:{flex:1,minWidth:0,paddingHorizontal:7},
  rowWord:{fontSize:16,fontWeight:'780',lineHeight:19,color:C.text1},
  rowTrans:{fontSize:13,lineHeight:16,color:C.text2,marginTop:2},
  emptyState:{paddingVertical:32,paddingHorizontal:18,borderWidth:1,borderStyle:'dashed',borderColor:C.line,borderRadius:theme.radius.md,alignItems:'center'},
  emptyTitle:{fontSize:18,fontWeight:'850',color:C.text1,marginBottom:5},
  emptyText:{fontSize:13,lineHeight:19,color:C.text2,textAlign:'center'},
  pathContent:{paddingHorizontal:14},
  storyBlock:{position:'relative',paddingBottom:30},
  routeRail:{position:'absolute',top:42,bottom:18,left:'50%',width:1,marginLeft:-.5,backgroundColor:'rgba(93,86,75,0.16)'},
  routeRow:{minHeight:88,flexDirection:'row',alignItems:'center',position:'relative'},
  routeLeft:{paddingRight:'28%'},
  routeCenter:{paddingHorizontal:'14%'},
  routeRight:{paddingLeft:'28%'},
  stationLabelWrap:{flex:1,minWidth:0},
  stationWord:{fontSize:13,fontWeight:'780',color:C.text1},
  stationTrans:{fontSize:10,color:C.text3,marginTop:2},
  stationStone:{width:60,height:60,borderRadius:30,borderWidth:1,borderColor:'rgba(75,70,61,0.42)',backgroundColor:C.surface2,alignItems:'center',justifyContent:'center',shadowColor:'#292722',shadowOpacity:.08,shadowRadius:6,shadowOffset:{width:0,height:4},elevation:2},
  stationStoneMastered:{backgroundColor:'#d9c79e',borderColor:'rgba(101,73,31,0.42)'},
  stationInner:{width:42,height:42,borderRadius:21,borderWidth:1,borderColor:'rgba(72,66,56,0.18)',backgroundColor:C.appBg,alignItems:'center',justifyContent:'center'},
  stationNumber:{fontSize:11,fontWeight:'800',color:C.text2},
  profileHero:{alignItems:'center',paddingTop:16,paddingBottom:22},
  profileAvatar:{width:104,height:104,borderRadius:52,borderWidth:1,borderColor:C.lineStrong,backgroundColor:C.surface1,alignItems:'center',justifyContent:'center'},
  avatarText:{fontSize:43,fontWeight:'700',color:C.text1},
  profileName:{fontSize:20,fontWeight:'850',color:C.text1,marginTop:12},
  profileSub:{fontSize:11,fontWeight:'650',color:C.text3,marginTop:3},
  profileMetrics:{minHeight:70,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:C.lineSoft,marginBottom:10},
  metric:{flex:1,alignItems:'center'},
  metricValue:{fontSize:20,fontWeight:'800',color:C.text1},
  metricLabel:{fontSize:10,color:C.text3,marginTop:2},
  metricDivider:{width:1,height:32,backgroundColor:C.lineSoft},
  profileMenuGlyph:{fontSize:18,color:C.text2},
  placeholderPanel:{borderWidth:1,borderColor:C.line,borderRadius:theme.radius.lg,padding:18,backgroundColor:C.paper},
  placeholderTitle:{fontSize:18,fontWeight:'850',color:C.text1,marginBottom:7},
  placeholderText:{fontSize:14,lineHeight:21,color:C.text2},
});
