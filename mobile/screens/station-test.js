import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { applyStationTestAnswer, buildStationTestSessionState, stationTestPayload, stationTestResult } from '../../packages/alantil-core/station-test.js';
import { Button, Header, ProgressBar, Screen, SectionLabel } from '../ui/components.js';
import { theme } from '../ui/theme.js';
import { recordNativeTestSession } from '../platform/progress.js';

const C=theme.colors;

export function StationTestScreen({ station, allWords, mode='kb', onBack }) {
  const [session]=useState(()=>buildStationTestSessionState({station,optionWords:allWords,mode,id:`station-${Date.now()}`,startedAt:new Date().toISOString()}));
  const [,redraw]=useState(0);
  const recorded=useRef(false);
  const question=session.questions[session.index];
  const done=!question;
  const result=useMemo(()=>done?stationTestResult(session,stationTestPayload(session)):null,[done,session]);

  useEffect(()=>{
    if(!done||!result||recorded.current)return;
    recorded.current=true;
    session.completed=true;
    const payload=stationTestPayload(session);
    recordNativeTestSession({sessionId:session.id,answers:payload.words.map((row)=>({word_id:row.word_id,result:row.result})),accuracy:payload.accuracy,requiredAccuracy:payload.required_accuracy,updateMastery:true,startedAt:session.startedAt,type:'station_test'}).catch(()=>{});
  },[done,result,session]);

  if(done&&result){
    session.completed=true;
    return <Screen><Header title="Результат этапа" onBack={onBack}/><ScrollView contentContainerStyle={styles.resultScroll}><SectionLabel>{result.passed?'ЭТАП ПРОЙДЕН':'НУЖНО ПОВТОРИТЬ'}</SectionLabel><Text style={[styles.score,result.passed?{color:C.success}:{color:C.danger}]}>{result.payload.accuracy}%</Text><Text style={styles.scoreCaption}>{result.payload.correct_total} из {result.payload.questions_total} · проходной {result.required}%</Text><View style={styles.masteryLine}><Text style={styles.masteryLabel}>УРОВЕНЬ</Text><View style={styles.masteryBadge}><Text style={styles.masteryValue}>{result.masteryLevel?['','I','II','III'][result.masteryLevel]:'—'}</Text></View></View><View style={styles.resultMetrics}><Metric value={String(result.payload.correct_total)} label="верно"/><Metric value={String(result.payload.wrong_total)} label="ошибок"/><Metric value={String(result.payload.questions_total)} label="вопросов"/></View><View style={styles.footer}><Button primary onPress={onBack}>К этапу</Button></View></ScrollView></Screen>;
  }

  const progress=session.questions.length?((session.index+1)/session.questions.length)*100:0;
  const prompt=session.mode==='ru'?question.item.trans:question.item.word;
  return <Screen><Header title="Тест этапа" subtitle={`${session.index+1}/${session.questions.length}`} onBack={onBack}/><ScrollView contentContainerStyle={styles.testScroll}><View style={styles.progress}><ProgressBar value={progress}/></View><View style={styles.promptBlock}><Text style={styles.promptMeta}>{session.mode==='ru'?'РУССКИЙ → АЛАН':'АЛАН → РУССКИЙ'}</Text><Text style={styles.prompt}>{prompt}</Text></View><View style={styles.options}>{question.options.map((option)=><Pressable key={`${question.item.id}-${option.id}`} onPress={()=>{applyStationTestAnswer(session,option.id);redraw((v)=>v+1);}} style={({pressed})=>[styles.option,pressed&&styles.optionPressed]}><Text style={styles.optionText}>{option.text}</Text></Pressable>)}</View></ScrollView></Screen>;
}

function Metric({value,label}){return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;}

const styles=StyleSheet.create({testScroll:{paddingTop:theme.control.header+14,paddingHorizontal:12,paddingBottom:24},progress:{paddingHorizontal:4,marginBottom:18},promptBlock:{minHeight:208,alignItems:'center',justifyContent:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft,paddingHorizontal:18},promptMeta:{fontSize:9,fontWeight:'700',letterSpacing:.7,color:C.text3,marginBottom:10},prompt:{fontSize:34,fontWeight:'900',lineHeight:39,color:C.text1,textAlign:'center'},options:{gap:9,marginTop:16},option:{minHeight:52,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center',paddingHorizontal:14,paddingVertical:10},optionPressed:{transform:[{translateY:1}],borderColor:C.accent,backgroundColor:C.accentSoft},optionText:{fontSize:15,fontWeight:'700',lineHeight:19,color:C.text1,textAlign:'center'},resultScroll:{paddingTop:theme.control.header+22,paddingHorizontal:12,paddingBottom:26},score:{fontSize:58,fontWeight:'800',lineHeight:66,textAlign:'center',marginTop:18},scoreCaption:{fontSize:12,lineHeight:17,color:C.text2,textAlign:'center',marginTop:4},masteryLine:{marginTop:28,paddingVertical:12,borderTopWidth:1,borderBottomWidth:1,borderColor:C.lineSoft,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},masteryLabel:{fontSize:10,fontWeight:'700',letterSpacing:.7,color:C.text2},masteryBadge:{width:64,height:52,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center'},masteryValue:{fontSize:20,fontWeight:'900',color:C.accentStrong},resultMetrics:{flexDirection:'row',borderBottomWidth:1,borderBottomColor:C.lineSoft},metric:{flex:1,minHeight:66,alignItems:'center',justifyContent:'center',borderRightWidth:1,borderRightColor:C.lineSoft},metricValue:{fontSize:18,fontWeight:'800',color:C.text1},metricLabel:{fontSize:10,color:C.text2,marginTop:5},footer:{alignItems:'flex-end',paddingTop:18}});
