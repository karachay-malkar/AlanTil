import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { completeLearningSetupSettings, emptyLearningSetupDraft, isLearningSetupDraftComplete } from '../../packages/alantil-core/settings.js';
import { LEARNING_SETUP_LANGUAGES, previewContent, setupText } from '../../packages/alantil-core/learning-setup.js';
import { Button, InlineMessage, Screen } from '../ui/components.js';
import { CompactSegmentedControl } from '../ui/parity.js';
import { Topography } from '../ui/topography.js';
import { semanticTypography, theme } from '../ui/theme.js';

const C=theme.colors;
function capitalizeWord(value){const text=String(value||'');return text?`${text[0].toUpperCase()}${text.slice(1)}`:'';}

function FlagIcon({language,compact=false}){
  const width=compact?18:20,height=compact?12:13;
  if(language==='ru')return <View style={[styles.flagFrame,{width,height}]}><Svg width={width} height={height} viewBox="0 0 24 16"><Rect width="24" height="5.34" fill="#fff"/><Rect y="5.33" width="24" height="5.34" fill="#1c57a7"/><Rect y="10.66" width="24" height="5.34" fill="#d52b1e"/></Svg></View>;
  if(language==='tr')return <View style={[styles.flagFrame,{width,height}]}><Svg width={width} height={height} viewBox="0 0 24 16"><Rect width="24" height="16" fill="#e30a17"/><Circle cx="9" cy="8" r="4.2" fill="#fff"/><Circle cx="10.2" cy="8" r="3.35" fill="#e30a17"/><Path fill="#fff" d="m14.1 8 2.7-.9-1.7 2.3V6.6l1.7 2.3z"/></Svg></View>;
  return <View style={[styles.flagFrame,{width,height}]}><Svg width={width} height={height} viewBox="0 0 24 16"><Rect width="24" height="16" fill="#21468b"/><Path stroke="#fff" strokeWidth="4" d="m0 0 24 16M24 0 0 16"/><Path stroke="#cf142b" strokeWidth="2" d="m0 0 24 16M24 0 0 16"/><Path stroke="#fff" strokeWidth="6" d="M12 0v16M0 8h24"/><Path stroke="#cf142b" strokeWidth="3.5" d="M12 0v16M0 8h24"/></Svg></View>;
}

function CoachHand(){
  return <Svg width="40" height="48" viewBox="0 0 40 48"><Path d="M17.5 24V8.2a4 4 0 0 1 8 0v12.6l2-1.8a3.7 3.7 0 0 1 5.9 3v8.7c0 7.3-4.4 12.3-11.3 12.3h-3.8c-4.1 0-7.2-1.6-9.7-5.1L4.9 32.8a3.8 3.8 0 0 1 6-4.6l3.4 4.1V24a3.2 3.2 0 0 1 3.2-3.2Z" fill={C.surface0} stroke={C.text1} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}

function measureNode(node,done){
  if(typeof node?.measureInWindow==='function'){node.measureInWindow((x,y,width,height)=>done({x,y,width,height}));return;}
  if(typeof node?.getBoundingClientRect==='function'){const rect=node.getBoundingClientRect();done({x:rect.left,y:rect.top,width:rect.width,height:rect.height});return;}
  done(null);
}

function OnboardingCoach({paneRef,languageRef,scriptRef,active,layoutKey}){
  const translateY=useRef(new Animated.Value(0)).current,scale=useRef(new Animated.Value(1)).current,opacity=useRef(new Animated.Value(0)).current,loopRef=useRef(null),[reduceMotion,setReduceMotion]=useState(false);
  useEffect(()=>{let alive=true;Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.()).then(value=>{if(alive)setReduceMotion(Boolean(value));}).catch(()=>{});const subscription=AccessibilityInfo.addEventListener?.('reduceMotionChanged',value=>setReduceMotion(Boolean(value)));return()=>{alive=false;subscription?.remove?.();};},[]);
  useEffect(()=>{let timer=null,cancelled=false;loopRef.current?.stop?.();loopRef.current=null;opacity.setValue(0);if(!active)return()=>{};
    const retry=()=>{if(!cancelled&&active)timer=setTimeout(start,120);};
    const start=()=>{if(cancelled||!active)return;measureNode(paneRef.current,pane=>{if(cancelled)return;if(!pane){retry();return;}measureNode(languageRef.current,language=>{if(cancelled)return;if(!language){retry();return;}measureNode(scriptRef.current,script=>{if(cancelled)return;if(!script){retry();return;}
      const languageY=language.y-pane.y+language.height*.62-23,scriptY=script.y-pane.y+script.height*.62-23;translateY.setValue(languageY);scale.setValue(1);
      if(reduceMotion){opacity.setValue(1);return;}
      const tap=()=>Animated.sequence([Animated.timing(scale,{toValue:.86,duration:150,useNativeDriver:true}),Animated.timing(scale,{toValue:1,duration:170,useNativeDriver:true})]);
      const loop=Animated.loop(Animated.sequence([
        Animated.timing(opacity,{toValue:1,duration:220,useNativeDriver:true}),
        tap(),
        Animated.delay(700),
        Animated.timing(translateY,{toValue:scriptY,duration:650,useNativeDriver:true}),
        tap(),
        Animated.delay(850),
        Animated.timing(translateY,{toValue:languageY,duration:650,useNativeDriver:true}),
        Animated.delay(1100),
      ]));
      loopRef.current=loop;loop.start();
    });});});};
    timer=setTimeout(start,800);
    return()=>{cancelled=true;if(timer)clearTimeout(timer);loopRef.current?.stop?.();loopRef.current=null;opacity.setValue(0);};
  },[active,layoutKey,reduceMotion,opacity,scale,translateY,paneRef,languageRef,scriptRef]);
  if(!active)return null;
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.coach,{opacity,transform:[{translateY},{scale}]}]}><CoachHand/></Animated.View>;
}

function LanguageSegmentedControl({value,onChange,compact=false}){
  const type=useSemanticTypography();
  return <View accessibilityRole="radiogroup" style={styles.languageSegments}>{LEARNING_SETUP_LANGUAGES.map((item)=>{const active=value===item.code;return <Pressable key={item.code} accessibilityRole="radio" accessibilityState={{checked:active}} onPress={()=>onChange(item.code)} style={({pressed})=>[styles.languageSegmentItem,active&&styles.languageSegmentItemActive,pressed&&styles.pressed]}><FlagIcon language={item.code} compact={compact}/><Text numberOfLines={1} style={[styles.languageSegmentLabel,compact&&styles.languageSegmentLabelCompact,active&&styles.languageSegmentLabelActive,{fontSize:type.caption.fontSize,lineHeight:type.caption.fontSize}]}>{item.label}</Text></Pressable>;})}</View>;
}

function DisclosureSection({visible,children}){
  const progress=useRef(new Animated.Value(visible?1:0)).current,[contentHeight,setContentHeight]=useState(0);
  useEffect(()=>{Animated.timing(progress,{toValue:visible?1:0,duration:visible?320:240,useNativeDriver:false}).start();},[visible,progress]);
  return <Animated.View pointerEvents={visible?'auto':'none'} accessibilityElementsHidden={!visible} importantForAccessibility={visible?'auto':'no-hide-descendants'} style={[styles.disclosure,{height:progress.interpolate({inputRange:[0,1],outputRange:[0,contentHeight]}),opacity:progress,transform:[{translateY:progress.interpolate({inputRange:[0,1],outputRange:[-8,0]})}]}]}><View onLayout={event=>setContentHeight(event.nativeEvent.layout.height)} style={{position:'absolute',left:0,right:0,top:0}}>{children}</View></Animated.View>;
}

export function OnboardingScreen({initialSettings,onComplete}){
  const {width,height}=useWindowDimensions(),compact=width<=390,short=height<=700;
  const [draft,setDraft]=useState(()=>emptyLearningSetupDraft()),[error,setError]=useState(''),[busy,setBusy]=useState(false),[coachActive,setCoachActive]=useState(true);
  const paneRef=useRef(null),languageControlRef=useRef(null),scriptControlRef=useRef(null);
  const type=useMemo(()=>semanticTypography(draft.text_size_code||'medium',width),[draft.text_size_code,width]);
  const language=draft.interface_language_code||initialSettings?.interface_language_code||'ru';
  const copy=setupText(language),preview=useMemo(()=>previewContent(draft),[draft]),complete=isLearningSetupDraftComplete(draft);
  const updateDraft=(updates)=>{setCoachActive(false);setDraft((current)=>({...current,...updates}));setError('');};
  const scriptOptions=[['cyrillic',copy.cyrillic],['turkic','Latin']];
  const dialectOptions=[['canonical','Җ'],['karachay','Дж'],['balkar','Ж']];
  const textSizeOptions=[['small',copy.small],['medium',copy.medium],['large',copy.large]];
  const persist=async()=>{if(!complete||busy)return;setBusy(true);setError('');const next=completeLearningSetupSettings(initialSettings,{...draft,translation_language_code:draft.interface_language_code,alan_dialect_code:draft.alan_script_code==='turkic'?(draft.alan_dialect_code||'canonical'):draft.alan_dialect_code});try{await onComplete?.(next);}catch{setError(copy.storageError);}finally{setBusy(false);}};
  const previewHeight=short?190:compact?220:Math.max(210,Math.min(300,height*.29));
  return <Screen><Topography opacity={0.22}/><ScrollView contentContainerStyle={[styles.root,compact&&styles.rootCompact,short&&styles.rootShort]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View ref={paneRef} style={[styles.pane,compact&&styles.paneCompact]}>{error?<InlineMessage type="error">{error}</InlineMessage>:null}<View style={styles.section}><Text style={[styles.title,type.caption]}>Язык · Language · Dil</Text><View ref={languageControlRef} onTouchStart={()=>setCoachActive(false)}><LanguageSegmentedControl value={draft.interface_language_code} compact={compact} onChange={(value)=>updateDraft({interface_language_code:value,translation_language_code:value})}/></View></View><DisclosureSection visible={Boolean(draft.interface_language_code)}><View style={styles.section}><Text style={[styles.sectionTitle,type.caption]}>{copy.script}</Text><View ref={scriptControlRef} onTouchStart={()=>setCoachActive(false)}><CompactSegmentedControl value={draft.alan_script_code} items={scriptOptions} onChange={(value)=>updateDraft({alan_script_code:value,alan_dialect_code:value==='turkic'?'canonical':''})}/></View></View></DisclosureSection><DisclosureSection visible={draft.alan_script_code==='cyrillic'}><View style={styles.section}><Text style={[styles.sectionTitle,type.caption]}>{copy.dialect}</Text><View onTouchStart={()=>setCoachActive(false)}><CompactSegmentedControl value={draft.alan_dialect_code} items={dialectOptions} onChange={(value)=>updateDraft({alan_dialect_code:value})}/></View></View></DisclosureSection><View style={styles.section}><Text style={[styles.sectionTitle,type.caption]}>{copy.textSize}</Text><View onTouchStart={()=>setCoachActive(false)}><CompactSegmentedControl value={draft.text_size_code} items={textSizeOptions} onChange={(value)=>updateDraft({text_size_code:value})}/></View></View><View style={[styles.previewCard,{height:previewHeight,minHeight:previewHeight,maxHeight:previewHeight}]}><View pointerEvents="none" style={styles.previewInset}/><Text style={[styles.previewWord,type.wordCard]}>{capitalizeWord(preview.word)}</Text><View style={styles.previewCopy}><Text style={[styles.previewTranslation,type.emphasis]}>{preview.translation}</Text><Text style={[styles.previewExample,type.caption]}>{preview.example} <Text style={styles.previewStar}>✦</Text> {preview.exampleTranslation}</Text></View></View><Button role="onboarding.continue" style={styles.fullButton} disabled={!complete||busy} onPress={persist}>{busy?'…':copy.continue}</Button><OnboardingCoach paneRef={paneRef} languageRef={languageControlRef} scriptRef={scriptControlRef} active={coachActive} layoutKey={`${width}:${height}`}/></View></ScrollView></Screen>;
}

const styles=StyleSheet.create({root:{flexGrow:1,minHeight:'100%',paddingHorizontal:14,paddingTop:theme.control.header+12,paddingBottom:24,justifyContent:'center'},rootCompact:{paddingHorizontal:10},rootShort:{paddingTop:theme.control.header+8,justifyContent:'flex-start'},pane:{position:'relative',width:'100%',maxWidth:560,alignSelf:'center',gap:14},paneCompact:{gap:12},section:{gap:7},title:{fontSize:13,fontWeight:'850',lineHeight:15.6,color:C.text1,textAlign:'left'},sectionTitle:{fontSize:13,fontWeight:'850',lineHeight:15.6,color:C.text2,textAlign:'left'},disclosure:{overflow:'hidden'},languageSegments:{width:'100%',minHeight:34,padding:2,borderWidth:1,borderColor:C.line,borderRadius:999,flexDirection:'row',backgroundColor:'transparent'},languageSegmentItem:{flex:1,minWidth:0,minHeight:28,paddingHorizontal:7,paddingVertical:4,borderRadius:999,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},languageSegmentItemActive:{backgroundColor:'rgba(246,242,233,.72)',shadowColor:'#292721',shadowOpacity:.05,shadowRadius:2,shadowOffset:{width:0,height:1},elevation:1},languageSegmentLabel:{minWidth:0,fontFamily:theme.font.terminal,fontSize:10,fontWeight:'750',lineHeight:10,color:C.text3,textAlign:'center'},languageSegmentLabelCompact:{fontSize:8.5},languageSegmentLabelActive:{color:C.text1},flagFrame:{overflow:'hidden',borderRadius:2,borderWidth:StyleSheet.hairlineWidth,borderColor:'rgba(40,36,31,.14)'},previewCard:{position:'relative',width:'100%',alignItems:'center',justifyContent:'center',paddingHorizontal:24,paddingVertical:24,gap:12,borderWidth:1,borderColor:C.lineSoft,borderRadius:theme.radius.lg,backgroundColor:C.paperSoft,overflow:'hidden'},previewInset:{position:'absolute',top:10,left:10,right:10,bottom:10,borderWidth:1,borderColor:C.lineSoft,borderRadius:Math.max(1,theme.radius.lg-7),opacity:.55},previewWord:{position:'relative',zIndex:1,color:C.text1,textAlign:'center'},previewCopy:{position:'relative',zIndex:1,width:'92%',alignItems:'center',gap:6,paddingTop:10,borderTopWidth:1,borderTopColor:C.lineSoft},previewTranslation:{color:C.text1,textAlign:'center'},previewExample:{marginTop:0,color:C.text2,textAlign:'center'},previewStar:{color:C.accentStrong},fullButton:{width:'100%'},coach:{position:'absolute',right:20,top:0,width:40,height:48,zIndex:8,elevation:8},pressed:{opacity:.7,transform:[{translateY:1}]}});
