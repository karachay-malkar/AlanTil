import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyTestAnswer, buildTestOptions, initializeTestState, testCompletionSummary } from '../../packages/alantil-core/test.js';
import { initializeMatchState, markMatchSolved, matchCompletionSummary, recordMatchMismatch, takeNextMatchRound } from '../../packages/alantil-core/match.js';
import { shuffle } from '../../packages/alantil-core/word-selection.js';
import { FavoriteButton, Header, ProgressBar, Screen } from '../ui/components.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function scopeKey(word) { return `${String(word.dictionary_id || '')}||${String(word.section_id || '')}`; }

function buildScope(words) {
  const map = new Map();
  words.forEach((word) => {
    const dictionaryId = String(word.dictionary_id || '');
    const sectionId = String(word.section_id || '');
    if (!dictionaryId || !sectionId) return;
    if (!map.has(dictionaryId)) map.set(dictionaryId,{id:dictionaryId,name:String(word.dictionary_name||dictionaryId),count:0,sections:new Map()});
    const dictionary = map.get(dictionaryId);
    dictionary.count += 1;
    if (!dictionary.sections.has(sectionId)) dictionary.sections.set(sectionId,{id:sectionId,name:String(word.section_name||sectionId),count:0});
    dictionary.sections.get(sectionId).count += 1;
  });
  return [...map.values()].map((dictionary)=>({...dictionary,sections:[...dictionary.sections.values()]}));
}

function Check({ checked, onPress }) {
  return <Pressable onPress={onPress} style={[styles.check,checked&&styles.checkOn]}>{checked?<Text style={styles.checkMark}>✓</Text>:null}</Pressable>;
}

function ScopePicker({ words, selectedKeys, setSelectedKeys }) {
  const scope = useMemo(()=>buildScope(words),[words]);
  const toggleSection=(dictionaryId,sectionId)=>setSelectedKeys((current)=>{const next=new Set(current);const key=`${dictionaryId}||${sectionId}`;if(next.has(key))next.delete(key);else next.add(key);return next;});
  const toggleDictionary=(dictionary)=>setSelectedKeys((current)=>{const next=new Set(current);const keys=dictionary.sections.map((section)=>`${dictionary.id}||${section.id}`);const all=keys.every((key)=>next.has(key));keys.forEach((key)=>all?next.delete(key):next.add(key));return next;});
  return <View style={styles.scopeList}>{scope.map((dictionary)=>{const keys=dictionary.sections.map((section)=>`${dictionary.id}||${section.id}`);const all=keys.length>0&&keys.every((key)=>selectedKeys.has(key));return <View key={dictionary.id} style={styles.scopeBlock}><View style={styles.scopeDictRow}><Check checked={all} onPress={()=>toggleDictionary(dictionary)}/><View style={styles.scopeCopy}><Text style={styles.scopeDict}>{dictionary.name}</Text><Text style={styles.scopeCount}>{dictionary.count}</Text></View></View>{dictionary.sections.map((section)=>{const key=`${dictionary.id}||${section.id}`;return <View key={key} style={styles.scopeSectionRow}><Check checked={selectedKeys.has(key)} onPress={()=>toggleSection(dictionary.id,section.id)}/><View style={styles.scopeCopy}><Text style={styles.scopeSection}>{section.name}</Text><Text style={styles.scopeCount}>{section.count}</Text></View></View>;})}</View>;})}</View>;
}

function LimitControl({ value, onChange }) { return <View style={styles.limitControl}>{[20,40,80].map((limit)=><Pressable key={limit} onPress={()=>onChange(limit)} style={[styles.limitItem,value===limit&&styles.limitActive]}><Text style={[styles.limitText,value===limit&&styles.limitTextActive]}>{limit}</Text></Pressable>)}</View>; }
function DirectionControl({ value, onChange }) { return <View style={styles.direction}><Text style={styles.directionLabel}>НАПРАВЛЕНИЕ</Text><View style={styles.directionControl}><Pressable onPress={()=>onChange('kb')} style={[styles.directionItem,value==='kb'&&styles.directionActive]}><Text style={[styles.directionText,value==='kb'&&styles.directionTextActive]}>алан → рус</Text></Pressable><Pressable onPress={()=>onChange('ru')} style={[styles.directionItem,value==='ru'&&styles.directionActive]}><Text style={[styles.directionText,value==='ru'&&styles.directionTextActive]}>рус → алан</Text></Pressable></View></View>; }

function GameMenu({ type, words, onBack, onStart }) {
  const allKeys=useMemo(()=>new Set(words.map(scopeKey)),[words]);
  const [selectedKeys,setSelectedKeys]=useState(allKeys);
  const [limit,setLimit]=useState(40);
  const [mode,setMode]=useState('kb');
  const pool=useMemo(()=>words.filter((word)=>selectedKeys.has(scopeKey(word))),[words,selectedKeys]);
  const selectedCount=Math.min(limit,pool.length);
  return <Screen><Header title={type==='test'?'Проверь знания':'Сопоставление'} onBack={onBack}/><ScrollView contentContainerStyle={styles.menuScroll} showsVerticalScrollIndicator={false}><View style={styles.modeLead}><Text style={styles.modeLeadValue}>Выбрано: {pool.length} · игра: {selectedCount}</Text><Text style={styles.modeLeadHint}>Выберите словари и разделы</Text></View><ScopePicker words={words} selectedKeys={selectedKeys} setSelectedKeys={setSelectedKeys}/><View style={styles.optionSection}><Text style={styles.optionLabel}>Количество слов</Text><LimitControl value={limit} onChange={setLimit}/></View></ScrollView><View style={styles.launchBar}>{type==='test'?<DirectionControl value={mode} onChange={setMode}/>:null}<Pressable disabled={!pool.length} onPress={()=>onStart(pool,limit,mode)} style={({pressed})=>[styles.startButton,!pool.length&&styles.disabled,pressed&&{opacity:.8}]}><Text style={styles.startButtonText}>{type==='test'?'Начать тест':'Начать игру'}</Text></Pressable></View></Screen>;
}

export function GeneralTestFlow({ words, favorites, setFavorites, onBack }) {
  const [phase,setPhase]=useState('menu');
  const [state,setState]=useState(null);
  const [selected,setSelected]=useState(null);
  const start=(pool,limit,mode)=>{const next={mode,limit,items:[],optionPool:[],index:0,correct:0,selectedAnswer:null,results:[],session:{}};initializeTestState(next,pool,mode,limit,{},words);setState(next);setSelected(null);setPhase('session');};
  if(phase==='menu') return <GameMenu type="test" words={words} onBack={onBack} onStart={start}/>;
  if(phase==='results') {const result=testCompletionSummary(state);const level=result.accuracy_percent>=100?3:result.accuracy_percent>=90?2:result.accuracy_percent>=80?1:0;return <Screen><Header title="Результаты теста" onBack={onBack}/><ScrollView contentContainerStyle={styles.resultScroll}><Text style={styles.resultMark}>{level?'⌃'.repeat(level):'—'}</Text><Text style={styles.resultScore}>{result.accuracy_percent}%</Text><Text style={styles.resultStatus}>{result.accuracy_percent>=80?'Тест сдан':'Тест не сдан'} · {result.correct_count}/{result.questions_total}</Text><View style={styles.resultList}>{state.results.map((row)=><View key={row.id} style={styles.resultRow}><View style={[styles.resultStatusDot,row.isCorrect?styles.okDot:styles.badDot]}><Text style={styles.resultStatusGlyph}>{row.isCorrect?'✓':'×'}</Text></View><View style={styles.resultCopy}><Text style={styles.resultPrimary}>{row.questionText||row.word}</Text>{!row.isCorrect?<Text style={styles.resultWrong}>Ответ: {row.userAnswer||'—'}</Text>:null}<Text style={styles.resultCorrect}>Правильно: {row.correctAnswer}</Text></View><FavoriteButton active={favorites.has(String(row.id))} onPress={()=>setFavorites(toggleFavoriteSet(favorites,row.id))}/></View>)}</View><Pressable onPress={()=>start(state.session.wordsPool,state.limit,state.mode)} style={styles.startButton}><Text style={styles.startButtonText}>Пройти ещё раз</Text></Pressable></ScrollView></Screen>;}
  const item=state.items[state.index];
  if(!item){setTimeout(()=>setPhase('results'),0);return <Screen/>;}
  const options=buildTestOptions(state,item);
  const answer=()=>{if(!selected)return;applyTestAnswer(state,selected);setSelected(null);setState({...state});if(state.index>=state.items.length)setPhase('results');};
  return <Screen><Header title="Проверь знания" subtitle={`${state.index+1}/${state.items.length}`} onBack={onBack}/><View style={styles.session}><View style={styles.question}><Text style={styles.questionText}>{state.mode==='kb'?item.word:item.trans}</Text></View><View style={styles.options}>{options.map((option)=><Pressable key={`${item.id}-${option.id}`} onPress={()=>setSelected(option)} style={[styles.choice,selected?.id===option.id&&styles.choiceSelected]}><Text style={styles.choiceText}>{option.text}</Text></Pressable>)}</View></View><View style={styles.answerBar}><Pressable disabled={!selected} onPress={answer} style={[styles.startButton,!selected&&styles.disabled]}><Text style={styles.startButtonText}>Ответить</Text></Pressable></View></Screen>;
}

function toggleFavoriteSet(set,id){const next=new Set(set);const key=String(id);if(next.has(key))next.delete(key);else next.add(key);return next;}

export function GeneralMatchFlow({ words, favorites, setFavorites, onBack }) {
  const [phase,setPhase]=useState('menu');
  const [state,setState]=useState(null);
  const [round,setRound]=useState([]);
  const [left,setLeft]=useState(null);
  const [right,setRight]=useState(null);
  const start=(pool,limit)=>{const next={session:{}};initializeMatchState(next,pool,limit,{});setState(next);setRound(takeNextMatchRound(next));setLeft(null);setRight(null);setPhase('game');};
  if(phase==='menu') return <GameMenu type="match" words={words} onBack={onBack} onStart={start}/>;
  if(phase==='results'){const summary=matchCompletionSummary(state);const problems=Object.entries(state.failMap).filter(([,count])=>count>0).map(([id,count])=>({...words.find((word)=>String(word.id)===String(id)),fails:count})).filter((word)=>word.id).sort((a,b)=>b.fails-a.fails);return <Screen><Header title="Сопоставление" onBack={onBack}/><ScrollView contentContainerStyle={styles.resultScroll}><Text style={styles.resultMark}>{summary.errors_count?'—':'⌃⌃⌃'}</Text><Text style={styles.resultScore}>{summary.pairs_completed}/{summary.pairs_total}</Text><Text style={styles.resultStatus}>Ошибок: {summary.errors_count}</Text>{problems.length?<View style={styles.resultList}>{problems.map((word)=><View key={word.id} style={styles.resultRow}><View style={styles.badDot}><Text style={styles.resultStatusGlyph}>{word.fails}</Text></View><View style={styles.resultCopy}><Text style={styles.resultPrimary}>{word.word}</Text><Text style={styles.resultCorrect}>{word.trans}</Text></View><FavoriteButton active={favorites.has(String(word.id))} onPress={()=>setFavorites(toggleFavoriteSet(favorites,word.id))}/></View>)}</View>:<View style={styles.perfect}><Text style={styles.perfectTitle}>Аперим!</Text><Text style={styles.resultCorrect}>Все пары собраны с первого раза.</Text></View>}</ScrollView></Screen>;}
  const active=round.filter((word)=>!state.solved.has(String(word.id)));
  if(!active.length){if(state.solvedCount>=state.total){setTimeout(()=>setPhase('results'),0);}else{const next=takeNextMatchRound(state);setTimeout(()=>setRound(next),0);}return <Screen/>;}
  const choose=(side,word)=>{if(side==='left')setLeft(word);else setRight(word);const a=side==='left'?word:left;const b=side==='right'?word:right;if(!a||!b)return;if(String(a.id)===String(b.id)){markMatchSolved(state,a.id);}else{recordMatchMismatch(state,a.id,b.id);}setLeft(null);setRight(null);setState({...state});};
  const leftCards=active;
  const rightCards=shuffle(active.slice());
  return <Screen><Header title="Сопоставление" subtitle={`${state.solvedCount}/${state.total}`} onBack={onBack}/><View style={styles.matchGame}><View style={styles.matchColumn}>{leftCards.map((word)=><Pressable key={`l-${word.id}`} onPress={()=>choose('left',word)} style={[styles.matchCard,left?.id===word.id&&styles.choiceSelected]}><Text style={styles.matchCardText}>{word.word}</Text></Pressable>)}</View><View style={styles.matchColumn}>{rightCards.map((word)=><Pressable key={`r-${word.id}`} onPress={()=>choose('right',word)} style={[styles.matchCard,right?.id===word.id&&styles.choiceSelected]}><Text style={styles.matchCardText}>{word.trans}</Text></Pressable>)}</View></View></Screen>;
}

const styles=StyleSheet.create({
  menuScroll:{paddingTop:theme.control.header+12,paddingHorizontal:12,paddingBottom:150},modeLead:{alignItems:'center',paddingVertical:13},modeLeadValue:{fontSize:13,fontWeight:'800',color:C.text1},modeLeadHint:{fontSize:11,color:C.text3,marginTop:4},scopeList:{gap:9},scopeBlock:{borderWidth:1,borderColor:C.lineSoft,borderRadius:theme.radius.sm,overflow:'hidden'},scopeDictRow:{minHeight:44,flexDirection:'row',alignItems:'center',gap:10,paddingHorizontal:12,paddingVertical:9,backgroundColor:C.accentSoft},scopeSectionRow:{minHeight:44,flexDirection:'row',alignItems:'center',gap:10,paddingLeft:28,paddingRight:12,paddingVertical:9,borderTopWidth:1,borderTopColor:C.lineSoft},scopeCopy:{flex:1,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},scopeDict:{fontSize:13,fontWeight:'800',color:C.text1},scopeSection:{fontSize:12,color:C.text2},scopeCount:{fontSize:10,fontWeight:'700',color:C.text3},check:{width:18,height:18,borderWidth:1,borderColor:C.line,borderRadius:3,alignItems:'center',justifyContent:'center'},checkOn:{backgroundColor:C.accent,borderColor:C.accentStrong},checkMark:{fontSize:12,fontWeight:'900',color:C.inverse},optionSection:{marginTop:16},optionLabel:{fontSize:12,fontWeight:'800',color:C.text1,marginBottom:8},limitControl:{flexDirection:'row',padding:2,borderRadius:999},limitItem:{flex:1,minHeight:30,borderRadius:999,alignItems:'center',justifyContent:'center'},limitActive:{backgroundColor:'rgba(246,242,233,.76)'},limitText:{fontSize:12,fontWeight:'700',color:C.text3},limitTextActive:{color:C.text1},launchBar:{position:'absolute',left:12,right:12,bottom:10,zIndex:30,gap:7,paddingTop:7,backgroundColor:'rgba(238,233,223,.95)'},direction:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},directionLabel:{fontSize:9,fontWeight:'700',letterSpacing:.5,color:C.text3},directionControl:{width:'72%',maxWidth:250,flexDirection:'row',padding:2,borderWidth:1,borderColor:C.line,borderRadius:999},directionItem:{flex:1,minHeight:28,borderRadius:999,alignItems:'center',justifyContent:'center'},directionActive:{backgroundColor:'rgba(246,242,233,.72)'},directionText:{fontSize:10,fontWeight:'700',color:C.text3},directionTextActive:{color:C.text1},startButton:{minHeight:38,paddingHorizontal:13,paddingVertical:7,borderWidth:1,borderColor:C.accentStrong,borderRadius:2,backgroundColor:C.accent,alignItems:'center',justifyContent:'center'},startButtonText:{fontSize:14,fontWeight:'700',color:C.inverse},disabled:{opacity:.46},session:{flex:1,paddingTop:theme.control.header+12,paddingHorizontal:12,paddingBottom:64},question:{flex:1,alignItems:'center',justifyContent:'center',minHeight:160},questionText:{fontSize:34,fontWeight:'900',lineHeight:40,color:C.text1,textAlign:'center'},options:{gap:9,paddingBottom:8},choice:{minHeight:52,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center',padding:10},choiceSelected:{borderColor:C.accentStrong,backgroundColor:C.accentSoft},choiceText:{fontSize:15,fontWeight:'700',color:C.text1,textAlign:'center'},answerBar:{position:'absolute',left:12,right:12,bottom:10},resultScroll:{paddingTop:theme.control.header+20,paddingHorizontal:12,paddingBottom:24},resultMark:{fontSize:24,fontWeight:'900',color:C.accentStrong,textAlign:'center'},resultScore:{fontSize:48,fontWeight:'850',color:C.text1,textAlign:'center',marginTop:6},resultStatus:{fontSize:12,color:C.text2,textAlign:'center',marginTop:5,marginBottom:20},resultList:{borderTopWidth:1,borderTopColor:C.lineSoft,marginBottom:16},resultRow:{minHeight:62,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:C.lineSoft},resultStatusDot:{width:26,height:26,borderRadius:13,alignItems:'center',justifyContent:'center'},okDot:{backgroundColor:C.successSoft},badDot:{width:26,height:26,borderRadius:13,backgroundColor:C.dangerSoft,alignItems:'center',justifyContent:'center'},resultStatusGlyph:{fontSize:11,fontWeight:'900',color:C.text1},resultCopy:{flex:1},resultPrimary:{fontSize:14,fontWeight:'800',color:C.text1},resultWrong:{fontSize:11,color:C.danger,marginTop:3},resultCorrect:{fontSize:11,color:C.success,marginTop:3},perfect:{paddingVertical:26,alignItems:'center'},perfectTitle:{fontSize:18,fontWeight:'850',color:C.text1},matchGame:{flex:1,paddingTop:theme.control.header+12,paddingHorizontal:12,paddingBottom:18,flexDirection:'row',gap:8},matchColumn:{flex:1,gap:8},matchCard:{flex:1,minHeight:42,maxHeight:68,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center',paddingHorizontal:7},matchCardText:{fontSize:13,fontWeight:'700',color:C.text1,textAlign:'center'},
});
