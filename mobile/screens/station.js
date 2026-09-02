import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { favoriteHas, toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { Button, FavoriteButton, Header, ProgressBar, Screen } from '../ui/components.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function StationTabs({ active, onChange }) {
  return <View style={styles.tabs}>{[['words','Слова'],['statistics','Статистика']].map(([id,label]) => <Pressable key={id} onPress={() => onChange(id)} style={styles.tab}><Text style={[styles.tabText,active===id&&styles.tabActive]}>{label}</Text></Pressable>)}</View>;
}

function DirectionToggle({ value, onChange }) {
  return (
    <View style={styles.directionRow}>
      <Text style={styles.directionLabel}>НАПРАВЛЕНИЕ</Text>
      <View style={styles.directionToggle}>
        <Pressable onPress={() => onChange('kb')} style={[styles.directionOption,value==='kb'&&styles.directionOptionActive]}><Text style={[styles.directionText,value==='kb'&&styles.directionTextActive]}>алан → рус</Text></Pressable>
        <Pressable onPress={() => onChange('ru')} style={[styles.directionOption,value==='ru'&&styles.directionOptionActive]}><Text style={[styles.directionText,value==='ru'&&styles.directionTextActive]}>рус → алан</Text></Pressable>
      </View>
    </View>
  );
}

function WordRow({ word, index, selected, onToggle, favorite, onFavorite }) {
  return (
    <View style={styles.wordRow}>
      <Pressable onPress={onToggle} style={styles.toggleWrap} accessibilityRole="checkbox" accessibilityState={{checked:selected}}>
        <View style={[styles.checkbox,selected&&styles.checkboxOn]}>{selected?<Text style={styles.check}>✓</Text>:null}</View>
      </Pressable>
      <View style={styles.wordMain}>
        <Text numberOfLines={1} style={styles.wordPrimary}>{word.word}</Text>
        <Text numberOfLines={1} style={styles.wordSecondary}>{word.trans}</Text>
      </View>
      <FavoriteButton active={favorite} onPress={onFavorite} />
      <Text style={styles.rowOrdinal}>{String(index+1).padStart(2,'0')}</Text>
    </View>
  );
}

function StatisticsPane({ station }) {
  const total = station?.words?.length || 0;
  return (
    <ScrollView contentContainerStyle={styles.statsScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.statsSummary}>
        <View style={styles.masteryBlock}><Text style={styles.statLabel}>ОСВОЕНИЕ</Text><Text style={styles.masteryValue}>0%</Text><ProgressBar value={0} /></View>
        <View style={styles.masteryBadge}><Text style={styles.masteryBadgeValue}>—</Text><Text style={styles.masteryBadgeSmall}>уровень</Text></View>
      </View>
      <View style={styles.metricGrid}>
        <Metric value="0" label="лучший результат" />
        <Metric value="0" label="попыток" />
        <Metric value={String(total)} label="слов" />
      </View>
      <View style={styles.statsSection}><Text style={styles.statsHeading}>Последние попытки</Text><Text style={styles.emptyStats}>Попыток пока нет.</Text></View>
      <View style={styles.statsSection}><Text style={styles.statsHeading}>Проблемные слова</Text><Text style={styles.emptyStats}>Данные появятся после прохождения теста.</Text></View>
    </ScrollView>
  );
}

function Metric({ value, label }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

export function StationScreen({ station, favorites, setFavorites, onBack, onLearn, onTest }) {
  const [pane, setPane] = useState('words');
  const [direction, setDirection] = useState('kb');
  const [hiddenIds, setHiddenIds] = useState(() => new Set());
  const words = Array.isArray(station?.words) ? station.words : [];
  const activeWords = useMemo(() => words.filter((word) => !hiddenIds.has(String(word.id))), [words, hiddenIds]);
  const allHidden = words.length > 0 && activeWords.length === 0;
  const toggleWord = (id) => setHiddenIds((current) => {
    const next = new Set(current);
    const key = String(id);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const toggleAll = () => setHiddenIds(allHidden ? new Set() : new Set(words.map((word) => String(word.id))));

  return (
    <Screen bottomNav>
      <Header title={station?.name || 'Этап'} subtitle={station?.sectionName || station?.catalogName || ''} onBack={onBack} />
      <StationTabs active={pane} onChange={setPane} />
      {pane === 'statistics' ? <StatisticsPane station={station} /> : (
        <>
          <View style={styles.toolbar}>
            <Pressable onPress={toggleAll}><Text style={styles.toolbarAction}>{allHidden?'Показать все':'Скрыть все'}</Text></Pressable>
            <Text style={styles.selectionCount}>{activeWords.length}/{words.length}</Text>
          </View>
          <ScrollView contentContainerStyle={styles.wordList} showsVerticalScrollIndicator={false}>
            {words.map((word,index) => <WordRow key={word.id} word={word} index={index} selected={!hiddenIds.has(String(word.id))} onToggle={() => toggleWord(word.id)} favorite={favoriteHas(favorites,word.id)} onFavorite={() => setFavorites(toggleFavorite(favorites,word.id).ids)} />)}
          </ScrollView>
          <View style={styles.launchPanel}>
            <DirectionToggle value={direction} onChange={setDirection} />
            <View style={styles.launchActions}>
              <Button disabled={!activeWords.length} onPress={() => onLearn(activeWords,direction)}>Учить слова</Button>
              <Button primary disabled={!words.length} onPress={() => onTest(station,direction)}>Завершить этап: тест</Button>
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs:{position:'absolute',zIndex:30,top:theme.control.header+4,left:12,right:12,height:34,flexDirection:'row',alignItems:'center',justifyContent:'space-around',paddingHorizontal:46},
  tab:{minHeight:30,paddingHorizontal:8,alignItems:'center',justifyContent:'center'},
  tabText:{fontSize:12,fontWeight:'800',letterSpacing:.3,color:C.text3},
  tabActive:{color:C.text1},
  toolbar:{position:'absolute',zIndex:30,top:theme.control.header+42,left:18,right:18,height:32,flexDirection:'row',alignItems:'center'},
  toolbarAction:{fontSize:11,fontWeight:'700',color:C.text2},
  selectionCount:{marginLeft:'auto',fontSize:11,fontWeight:'700',color:C.text1},
  wordList:{paddingTop:theme.control.header+82,paddingHorizontal:12,paddingBottom:theme.control.nav+126},
  wordRow:{position:'relative',height:52,minHeight:52,flexDirection:'row',alignItems:'center',gap:7,borderBottomWidth:1,borderBottomColor:'rgba(54,50,43,.09)'},
  toggleWrap:{width:36,height:44,alignItems:'center',justifyContent:'center'},
  checkbox:{width:18,height:18,borderRadius:3,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
  checkboxOn:{backgroundColor:C.accent,borderColor:C.accentStrong},
  check:{fontSize:12,fontWeight:'900',color:C.inverse},
  wordMain:{flex:1,minWidth:0,height:44,justifyContent:'center'},
  wordPrimary:{fontSize:15,fontWeight:'820',lineHeight:20,color:C.text1},
  wordSecondary:{fontSize:12,lineHeight:18,color:C.text2},
  rowOrdinal:{position:'absolute',left:0,bottom:1,width:36,fontSize:7,color:C.text3,textAlign:'center'},
  launchPanel:{position:'absolute',zIndex:30,left:12,right:12,bottom:theme.control.nav+4,gap:6,paddingTop:4,backgroundColor:'rgba(238,233,223,.94)'},
  directionRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  directionLabel:{fontSize:9,fontWeight:'700',letterSpacing:.4,color:C.text3},
  directionToggle:{width:'72%',maxWidth:250,padding:2,borderWidth:1,borderColor:C.line,borderRadius:999,flexDirection:'row'},
  directionOption:{flex:1,minHeight:28,borderRadius:999,alignItems:'center',justifyContent:'center',paddingHorizontal:5},
  directionOptionActive:{backgroundColor:'rgba(246,242,233,.78)'},
  directionText:{fontSize:10,fontWeight:'750',color:C.text3},
  directionTextActive:{color:C.text1},
  launchActions:{flexDirection:'row',gap:7},
  statsScroll:{paddingTop:theme.control.header+48,paddingHorizontal:12,paddingBottom:theme.control.nav+24},
  statsSummary:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,paddingBottom:13,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  masteryBlock:{flex:1,gap:5},
  statLabel:{fontSize:10,fontWeight:'700',letterSpacing:.5,color:C.text2},
  masteryValue:{fontSize:26,fontWeight:'800',color:C.text1},
  masteryBadge:{width:78,height:64,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},
  masteryBadgeValue:{fontSize:18,fontWeight:'900',color:C.accentStrong},
  masteryBadgeSmall:{fontSize:9,color:C.text2,marginTop:5},
  metricGrid:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:C.lineSoft},
  metric:{flex:1,minHeight:66,paddingVertical:10,paddingHorizontal:5,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:C.lineSoft},
  metricValue:{fontSize:18,fontWeight:'800',color:C.text1},
  metricLabel:{fontSize:10,lineHeight:12,color:C.text2,textAlign:'center',marginTop:5},
  statsSection:{marginTop:17},
  statsHeading:{fontSize:15,fontWeight:'850',color:C.text1,paddingBottom:7,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  emptyStats:{fontSize:12,lineHeight:18,color:C.text3,paddingVertical:13},
});
