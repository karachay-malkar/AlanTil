import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { buildLearnResultSummary, decideLearnCard, ensureLearnWordStats, exposeCurrentLearnCard, initializeLearnState, learnCompletionSummary, learnSessionWords, undoLearnDecision } from '../../packages/alantil-core/learning.js';
import { favoriteHas, toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { Button, FavoriteButton, Header, ProgressBar, Screen, SectionLabel } from '../ui/components.js';
import { theme } from '../ui/theme.js';
import { recordNativeLearnSession } from '../platform/progress.js';

const C = theme.colors;

function createState(words, mode, station) {
  const state={currentDict:station?.dictionaryId||'',currentSection:station?.sectionId||'',currentSet:station?.setId||'',mainQueue:[],repeatQueue:[],round:'main',totalPlanned:0,currentStudyId:'',swipeHistory:[],analyticsActions:[],sessionFailMap:{},studySession:{inProgress:false,completed:false,wordsPool:[],progressData:{},wordStats:{},metadata:{}}};
  initializeLearnState(state,words,mode,{stationContext:station||null});
  return state;
}

export function LearnScreen({ words, mode='kb', station, favorites, setFavorites, onBack }) {
  const [state]=useState(()=>createState(words,mode,station));
  const [flipped,setFlipped]=useState(false);
  const [,redraw]=useState(0);
  const startedAt=useRef(new Date().toISOString());
  const recorded=useRef(false);
  const lastExposed=useRef('');
  const exposure=exposeCurrentLearnCard(state,{countShow:false});
  const item=exposure.item;
  const finish=exposure.finished||(!item&&state.totalPlanned>0);
  const summary=useMemo(()=>finish?buildLearnResultSummary(state,words):null,[finish,state,words]);

  useEffect(()=>{
    const id=String(item?.id||'');
    if(!id||lastExposed.current===id)return;
    const stats=ensureLearnWordStats(state,item);
    if(stats)stats.show_count+=1;
    lastExposed.current=id;
  },[item?.id,state]);

  useEffect(()=>{
    if(!finish||recorded.current)return;
    recorded.current=true;
    state.studySession.completed=true;
    state.studySession.inProgress=false;
    recordNativeLearnSession({sessionId:`learn-${startedAt.current}-${station?.key||'practice'}`,words:learnSessionWords(state),startedAt:startedAt.current}).catch(()=>{});
  },[finish,state,station?.key]);

  if(finish){
    const completed=learnCompletionSummary(state);
    return <Screen><Header title="Результат" onBack={onBack}/><ScrollView contentContainerStyle={styles.results}><SectionLabel>ОБУЧЕНИЕ ЗАВЕРШЕНО</SectionLabel><View style={styles.resultSummary}><ResultMetric value={String(completed.items_total)} label="изучено"/><ResultMetric value={String(completed.known_count)} label="знаю"/><ResultMetric value={String(summary?.leftSwipesTotal||0)} label="не знаю"/></View><View style={styles.problemSection}><Text style={styles.problemHeading}>Проблемные слова</Text>{summary?.problemWords?.length?summary.problemWords.slice(0,7).map((word)=><View key={word.id} style={styles.problemRow}><Text style={styles.problemWord}>{word.word}</Text><Text style={styles.problemTrans}>{word.trans}</Text><Text style={styles.problemFails}>{word.fails}</Text></View>):<Text style={styles.problemEmpty}>Ошибок нет.</Text>}</View><View style={styles.resultFooter}><Button primary onPress={onBack}>К этапу</Button></View></ScrollView></Screen>;
  }

  if(!item)return <Screen><Header title="Учить слова" onBack={onBack}/><View style={styles.empty}><Text style={styles.problemEmpty}>Нет слов для обучения.</Text></View></Screen>;

  const pending=new Set([...state.mainQueue,...state.repeatQueue].map((word)=>String(word.id))).size;
  const totalDone=Math.max(0,state.totalPlanned-pending);
  const progress=state.totalPlanned?(totalDone/state.totalPlanned)*100:0;
  const choose=(known)=>{decideLearnCard(state,known);setFlipped(false);redraw((v)=>v+1);};
  const undo=()=>{const action=undoLearnDecision(state);if(action){lastExposed.current='';setFlipped(false);redraw((v)=>v+1);}};

  return <Screen><Header title="Учить слова" subtitle={`${Math.min(totalDone+1,state.totalPlanned)}/${state.totalPlanned}`} onBack={onBack}/><View style={styles.session}><View style={styles.progress}><ProgressBar value={progress}/></View><Pressable onPress={()=>setFlipped((value)=>!value)} style={styles.cardWrap}><View style={[styles.card,flipped&&styles.cardBack]}><View style={styles.cardInset}/>{!flipped?<><Text style={styles.word}>{mode==='ru'?item.trans:item.word}</Text><Text style={styles.hint}>нажмите, чтобы перевернуть</Text></>:<View style={styles.backContent}><Text style={styles.backLabel}>ПЕРЕВОД</Text><Text style={styles.translation}>{mode==='ru'?item.word:item.trans}</Text>{item.synonyms?<><Text style={styles.backLabel}>СИНОНИМЫ</Text><Text style={styles.synonyms}>{item.synonyms}</Text></>:null}</View>}<View style={styles.cardActions}><Pressable onPress={(event)=>{event.stopPropagation?.();undo();}} style={styles.cardAction}><Text style={styles.cardActionIcon}>↶</Text><Text style={styles.cardActionLabel}>назад</Text></Pressable><FavoriteButton active={favoriteHas(favorites,item.id)} onPress={()=>setFavorites(toggleFavorite(favorites,item.id).ids)}/></View></View></Pressable><View style={styles.decisions}><Decision kind="unknown" label="Не знаю" icon="×" onPress={()=>choose(false)}/><Decision kind="known" label="Знаю" icon="✓" onPress={()=>choose(true)}/></View></View></Screen>;
}

function Decision({kind,label,icon,onPress}){return <Pressable onPress={onPress} style={({pressed})=>[styles.decision,pressed&&{opacity:.72}]}><View style={[styles.decisionIcon,kind==='unknown'?styles.unknownIcon:styles.knownIcon]}><Text style={[styles.decisionGlyph,kind==='unknown'?{color:C.danger}:{color:C.success}]}>{icon}</Text></View><Text style={styles.decisionLabel}>{label}</Text></Pressable>;}
function ResultMetric({value,label}){return <View style={styles.resultMetric}><Text style={styles.resultValue}>{value}</Text><Text style={styles.resultLabel}>{label}</Text></View>;}

const styles=StyleSheet.create({
session:{flex:1,paddingTop:theme.control.header+8,paddingHorizontal:8,paddingBottom:10,gap:8},progress:{height:8,justifyContent:'center',paddingHorizontal:4},cardWrap:{flex:1,minHeight:0,alignItems:'center',justifyContent:'center'},card:{width:'100%',maxWidth:560,height:'100%',maxHeight:620,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.lg,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center',paddingHorizontal:22,paddingVertical:24,position:'relative',overflow:'hidden'},cardBack:{alignItems:'stretch',justifyContent:'flex-start',paddingTop:30,paddingHorizontal:22,paddingBottom:58},cardInset:{position:'absolute',top:10,left:10,right:10,bottom:10,borderWidth:1,borderColor:C.lineSoft,borderRadius:theme.radius.lg-7,opacity:.55},word:{fontSize:42,fontWeight:'900',lineHeight:47,color:C.text1,textAlign:'center'},hint:{marginTop:16,fontSize:12,fontWeight:'600',lineHeight:17,letterSpacing:.3,color:C.text2,textAlign:'center'},backContent:{width:'100%',paddingTop:10},backLabel:{fontSize:9,fontWeight:'800',letterSpacing:.9,color:C.text3,marginTop:12,marginBottom:6},translation:{fontSize:22,fontWeight:'800',lineHeight:29,color:C.text1},synonyms:{fontSize:14,lineHeight:21,color:C.text2},cardActions:{position:'absolute',left:12,right:12,bottom:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},cardAction:{minWidth:40,minHeight:40,alignItems:'center',justifyContent:'center'},cardActionIcon:{fontSize:20,color:C.text2},cardActionLabel:{fontSize:9,fontWeight:'700',color:C.text3},decisions:{width:'100%',maxWidth:560,alignSelf:'center',flexDirection:'row',alignItems:'flex-start',justifyContent:'center',gap:58,paddingTop:2},decision:{width:72,minHeight:64,alignItems:'center',gap:5},decisionIcon:{width:44,height:44,borderRadius:22,borderWidth:1,alignItems:'center',justifyContent:'center'},unknownIcon:{borderColor:'rgba(152,86,76,.48)',backgroundColor:'rgba(152,86,76,.05)'},knownIcon:{borderColor:'rgba(93,118,84,.48)',backgroundColor:'rgba(93,118,84,.05)'},decisionGlyph:{fontSize:22,fontWeight:'800'},decisionLabel:{fontSize:10,fontWeight:'700',color:C.text2},results:{paddingTop:theme.control.header+18,paddingHorizontal:12,paddingBottom:24},resultSummary:{flexDirection:'row',borderTopWidth:1,borderBottomWidth:1,borderColor:C.lineSoft,marginTop:12},resultMetric:{flex:1,minHeight:72,alignItems:'center',justifyContent:'center',paddingHorizontal:5,borderRightWidth:1,borderRightColor:C.lineSoft},resultValue:{fontSize:22,fontWeight:'800',color:C.text1},resultLabel:{fontSize:10,lineHeight:12,color:C.text2,textAlign:'center',marginTop:6},problemSection:{marginTop:18},problemHeading:{fontSize:15,fontWeight:'800',color:C.text1,paddingBottom:8,borderBottomWidth:1,borderBottomColor:C.lineSoft},problemRow:{minHeight:52,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft},problemWord:{flex:1,fontSize:15,fontWeight:'700',color:C.text1},problemTrans:{flex:1,fontSize:12,color:C.text2},problemFails:{width:32,fontSize:11,fontWeight:'800',color:C.danger,textAlign:'center'},problemEmpty:{fontSize:12,lineHeight:18,color:C.text3,paddingVertical:14,textAlign:'center'},resultFooter:{alignItems:'flex-end',paddingTop:10},empty:{flex:1,alignItems:'center',justifyContent:'center',padding:20}
});
