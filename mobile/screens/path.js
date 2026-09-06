import React, { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path as SvgPath } from 'react-native-svg';
import { GENERAL_GUIDE_STEPS } from '../../packages/alantil-core/guide-contract.js';
import { computedStationStatus, createRouteProgressSnapshot, stationMilestoneCount, stationWordProgress, storyProgress } from '../../packages/alantil-core/route-progress.js';
import { loadNativeWordProgressMap } from '../platform/progress.js';
import { hasSeenNativeStoryStele, loadNativePathSettings, loadNativeStoryScroll, markNativeStorySteleSeen, saveNativeActiveStory, saveNativeStoryScroll } from '../platform/path-state.js';
import { beginNativeGeneralGuide, getNativeGeneralGuideRuntime, resetNativeGeneralGuideRuntime, setNativeGeneralGuideRuntime } from '../platform/guide-state.js';
import { msg } from '../i18n.js';
import { Screen } from '../ui/components.js';
import { FadedScrollView } from '../ui/faded-scroll';
import { GuideHelpButton, GuideOverlay } from '../ui/guide.js';
import { MonoLabel } from '../ui/parity.js';
import { ListChecksIcon } from '../ui/icons.js';
import { Topography } from '../ui/topography.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;
function canonicalStoryLabel(settings,type,story){const fallback=story?.label||story?.name||type;if(type==='roots')return msg(settings,'path.voshozhdenie')||fallback;if(type==='ascent')return msg(settings,'path.na_vershine')||fallback;if(type==='pathways')return msg(settings,'path.tropy')||fallback;return fallback;}
const POSITION_PATTERN=[-1,0,1,0];
const STORY_STELE=require('../../assets/path/story-stele.webp');
const STELE_AUTO_SCROLL_START_DELAY=1600;
const STELE_AUTO_SCROLL_RESUME_DELAY=2600;
const STELE_AUTO_SCROLL_PX_PER_SECOND=7;
const STELE_MIN_BODY_FONT_SIZE=12.5;
const STELE_MIN_LINE_HEIGHT=1.32;
const STELE_MIN_GAP=4;

function catalogKey(catalog){return String(catalog?.dictionaryId||catalog?.catalogId||catalog?.id||catalog?.name||'catalog');}
function sectionKey(catalog,section){return `${catalogKey(catalog)}::${String(section?.sectionId||section?.groupId||section?.id||section?.name||'section')}`;}
function dotCount(height,routeHeight){if(!routeHeight)return 4;const share=Math.max(0,height)/routeHeight;return Math.max(3,Math.min(10,Math.round(3+share*24)));}
function connectorPath(points){if(points.length<2)return'';let path=`M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;for(let index=1;index<points.length;index+=1){const previous=points[index-1],current=points[index],middleY=(previous.y+current.y)/2;path+=` C ${previous.x.toFixed(2)} ${middleY.toFixed(2)}, ${current.x.toFixed(2)} ${middleY.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;}return path;}
function showStationLabels(catalog){const value=String(catalog?.name||catalog?.label||'').toLowerCase();return !/(beginner|intermediate|advanced|началь|средн|сложн)/i.test(value);}
function geometryBuffer(){return{map:null,stations:new Map(),sections:new Map(),catalogs:new Map()};}
function ensureTargetRef(map,key){if(!map.has(key))map.set(key,{current:null});return map.get(key);}

function StoryTabs({route,activeStory,onChange,targetRef,storyTargetRefs,controlRef,storyLabels}){
  const {width}=useWindowDimensions(),fontSize=Math.min(13,Math.max(10,width*.03)),scrollRef=useRef(null),viewportRef=useRef(1),contentRef=useRef(1),offsetRef=useRef(0),layoutsRef=useRef(new Map()),[edges,setEdges]=useState({start:false,end:false});
  const syncEdges=(offset=offsetRef.current)=>{const max=Math.max(0,contentRef.current-viewportRef.current),next={start:max>3&&offset>3,end:max>3&&offset<max-3};setEdges(current=>current.start===next.start&&current.end===next.end?current:next);};
  const scrollToStory=(type,animated=true)=>new Promise(resolve=>{const layout=layoutsRef.current.get(type),viewport=viewportRef.current;if(!layout||!viewport){resolve(false);return;}const max=Math.max(0,contentRef.current-viewport),x=Math.max(0,Math.min(max,layout.x+layout.width/2-viewport/2));offsetRef.current=x;scrollRef.current?.scrollTo({x,animated});syncEdges(x);setTimeout(()=>resolve(true),animated?190:0);});
  useImperativeHandle(controlRef,()=>({scrollToStory}),[route.storyOrder,width]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>{void scrollToStory(activeStory,false);});return()=>cancelAnimationFrame(frame);},[activeStory,width]);
  return <View ref={targetRef} collapsable={false} style={styles.storyTabsShell}>
    {edges.start?<Text pointerEvents="none" style={[styles.storyEdge,styles.storyEdgeStart]}>‹</Text>:null}
    <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyTabs} scrollEventThrottle={32} onLayout={event=>{viewportRef.current=event.nativeEvent.layout.width||1;syncEdges();}} onContentSizeChange={(contentWidth)=>{contentRef.current=contentWidth||1;syncEdges();void scrollToStory(activeStory,false);}} onScroll={event=>{offsetRef.current=event.nativeEvent.contentOffset.x;syncEdges(offsetRef.current);}}>
      {(route.storyOrder||[]).map((type)=>{
        const active=activeStory===type,target=storyTargetRefs?.get(type);
        return <Pressable
          ref={target}
          collapsable={false}
          key={type}
          accessibilityRole="button"
          accessibilityState={{selected:active}}
          onLayout={event=>{layoutsRef.current.set(type,event.nativeEvent.layout);if(type===activeStory)void scrollToStory(type,false);}}
          onPress={()=>onChange(type)}
          style={({pressed})=>[styles.storyTab,type===route.storyOrder?.[0]&&styles.storyTabFirst,type===route.storyOrder?.[route.storyOrder.length-1]&&styles.storyTabLast,active&&styles.storyTabSelected,pressed&&styles.storyTabPressed]}
        >
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.storyTabText,{fontSize,lineHeight:fontSize*1.1},active&&styles.storyTabActive]}>[ {storyLabels?.[type]||route.stories[type]?.label||type} ]</Text>
        </Pressable>;
      })}
    </ScrollView>
    {edges.end?<Text pointerEvents="none" style={[styles.storyEdge,styles.storyEdgeEnd]}>›</Text>:null}
  </View>;
}

function SegmentedStoryProgress({value=0}){
  const filled=Math.round(Math.max(0,Math.min(100,value))/10);
  return <View accessibilityRole="progressbar" accessibilityValue={{min:0,max:100,now:value}} style={styles.segmentedProgress}>
    {Array.from({length:10},(_,index)=><View key={index} style={[styles.segmentedProgressCell,index<filled&&styles.segmentedProgressCellOn]}/>)}
  </View>;
}

function StationProgressRing({percent=0,done=false,children,targetRef}){
  const size=theme.path.stationSize,stroke=2,radius=(size-stroke)/2,circumference=2*Math.PI*radius,progress=Math.max(0,Math.min(100,percent));
  return <View ref={targetRef} collapsable={false} style={styles.stationProgressRing}>
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle cx={size/2} cy={size/2} r={radius} stroke={C.lineSoft} strokeWidth={stroke} fill="none"/>
      {progress>0?<Circle cx={size/2} cy={size/2} r={radius} stroke={done?C.successStrong:C.accentStrong} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference*(1-progress/100)} rotation="-90" origin={`${size/2} ${size/2}`}/>:null}
    </Svg>
    {children}
  </View>;
}

function MillstoneFace({status,done,children}){
  const locked=status==='locked',review=status==='review_1_due',studying=status==='studying';
  return <View style={[
    styles.millstoneFace,
    locked&&styles.millstoneLocked,
    studying&&styles.millstoneStudying,
    done&&styles.millstoneDone,
    review&&styles.millstoneReview,
  ]}>
    <View pointerEvents="none" style={styles.millstoneInnerRing}/>
    <View pointerEvents="none" style={styles.millstoneStoneMarkA}/>
    <View pointerEvents="none" style={styles.millstoneStoneMarkB}/>
    <View pointerEvents="none" style={styles.millstoneHole}/>
    {children}
  </View>;
}

const RouteScale=forwardRef(function RouteScale({parts,onJump},ref){
  const metricsRef=useRef({offset:0,content:1,viewport:1}),stateRef=useRef({passed:0,current:-1});
  const [state,setState]=useState(stateRef.current);
  const sync=()=>{
    const {offset,content,viewport}=metricsRef.current,maxScroll=Math.max(0,content-viewport);
    const progress=maxScroll?Math.max(0,Math.min(1,(maxScroll-offset)/maxScroll)):0;
    const passed=Math.round(progress*parts.length),current=parts.length?Math.max(0,parts.length-passed-1):-1;
    if(stateRef.current.passed===passed&&stateRef.current.current===current)return;
    stateRef.current={passed,current};setState(stateRef.current);
  };
  useImperativeHandle(ref,()=>({
    updateOffset(offset){metricsRef.current.offset=Math.max(0,Number(offset)||0);sync();},
    setMetrics(next){metricsRef.current={...metricsRef.current,...next};sync();},
  }),[parts.length]);
  useEffect(()=>{sync();},[parts.length]);
  return <View pointerEvents="box-none" style={styles.routeScale}>
    {parts.map((part,index)=>{
      const isPassed=index>=parts.length-state.passed,isCurrent=index===state.current;
      if(part.type==='diamond'){
        return <Pressable key={part.key} accessibilityRole="button" accessibilityLabel={part.label||`${index+1}/${parts.length}`} onPress={()=>onJump(part)} style={({pressed})=>[styles.scaleDiamondHit,pressed&&styles.scalePressed]}>
          <View style={[styles.scaleDiamond,isPassed&&styles.scaleDiamondPassed,isCurrent&&styles.scaleDiamondCurrent]}/>
        </Pressable>;
      }
      if(part.type==='section')return <View pointerEvents="none" key={part.key} style={[styles.scaleSection,isPassed&&styles.scalePassed,isCurrent&&styles.scaleSectionCurrent]}/>;
      return <View pointerEvents="none" key={part.key} style={[styles.scaleDot,isPassed&&styles.scalePassed,isCurrent&&styles.scaleDotCurrent]}/>;
    })}
  </View>;
});

function StoryStele({story,visible,onOpen,onClose}){
  const {width,height}=useWindowDimensions(),bodyRef=useRef(null),autoTimerRef=useRef(null),autoFrameRef=useRef(null),autoLastTimeRef=useRef(0),scrollOffsetRef=useRef(0),contentHeightRef=useRef(0),viewportHeightRef=useRef(0),fitPassRef=useRef(0),pulse=useRef(new Animated.Value(0)).current;
  const [reduceMotion,setReduceMotion]=useState(false),[overflow,setOverflow]=useState(false),[fit,setFit]=useState(()=>({bodySize:13.5,lineHeight:1.42,gap:6}));
  const compact=width<=360,cardWidth=Math.max(0,Math.min(width-(compact?4:6),height*.53,932)),cardHeight=cardWidth*(1688/932);
  const titleSize=Math.min(44,Math.max(19,cardWidth*.068)),initialBodySize=Math.min(21,Math.max(13.5,cardWidth*.038)),initialGap=Math.min(12,Math.max(6,cardWidth*.018));

  const clearAutoScroll=()=>{
    if(autoTimerRef.current){clearTimeout(autoTimerRef.current);autoTimerRef.current=null;}
    if(autoFrameRef.current){cancelAnimationFrame(autoFrameRef.current);autoFrameRef.current=null;}
    autoLastTimeRef.current=0;
  };
  const autoScrollTick=(timestamp)=>{
    const maximum=Math.max(0,contentHeightRef.current-viewportHeightRef.current);
    if(!visible||reduceMotion||maximum<=2){clearAutoScroll();return;}
    if(!autoLastTimeRef.current)autoLastTimeRef.current=timestamp;
    const elapsed=Math.min(64,timestamp-autoLastTimeRef.current);autoLastTimeRef.current=timestamp;
    const next=Math.min(maximum,scrollOffsetRef.current+(STELE_AUTO_SCROLL_PX_PER_SECOND*elapsed)/1000);
    scrollOffsetRef.current=next;bodyRef.current?.scrollTo({y:next,animated:false});
    if(next>=maximum-.5){clearAutoScroll();return;}
    autoFrameRef.current=requestAnimationFrame(autoScrollTick);
  };
  const startAutoScroll=()=>{clearAutoScroll();if(!visible||reduceMotion||!overflow)return;autoFrameRef.current=requestAnimationFrame(autoScrollTick);};
  const scheduleAutoScroll=(delay=STELE_AUTO_SCROLL_START_DELAY)=>{clearAutoScroll();if(!visible||reduceMotion||!overflow)return;autoTimerRef.current=setTimeout(()=>{autoTimerRef.current=null;startAutoScroll();},delay);};
  const pauseForManualScroll=()=>{clearAutoScroll();if(!visible||reduceMotion||!overflow)return;autoTimerRef.current=setTimeout(()=>{autoTimerRef.current=null;startAutoScroll();},STELE_AUTO_SCROLL_RESUME_DELAY);};
  const refreshOverflow=()=>{
    const next=contentHeightRef.current>viewportHeightRef.current+2;
    setOverflow((current)=>current===next?current:next);
    if(!visible||!next||fitPassRef.current>=1||fit.bodySize<=STELE_MIN_BODY_FONT_SIZE)return;
    fitPassRef.current=1;
    const ratio=Math.max(.78,Math.min(1,viewportHeightRef.current/Math.max(1,contentHeightRef.current)));
    setFit({
      bodySize:Math.max(STELE_MIN_BODY_FONT_SIZE,initialBodySize*ratio),
      lineHeight:Math.max(STELE_MIN_LINE_HEIGHT,1.42-(1-ratio)*.32),
      gap:Math.max(STELE_MIN_GAP,initialGap*ratio),
    });
  };

  useEffect(()=>{
    let alive=true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((value)=>{if(alive)setReduceMotion(Boolean(value));}).catch(()=>{});
    const subscription=AccessibilityInfo.addEventListener?.('reduceMotionChanged',(value)=>setReduceMotion(Boolean(value)));
    return()=>{alive=false;subscription?.remove?.();};
  },[]);
  useEffect(()=>{
    pulse.stopAnimation();
    if(reduceMotion||visible){pulse.setValue(0);return;}
    const loop=Animated.loop(Animated.sequence([
      Animated.timing(pulse,{toValue:1,duration:2400,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
      Animated.timing(pulse,{toValue:0,duration:2400,easing:Easing.inOut(Easing.quad),useNativeDriver:true}),
    ]));
    loop.start();return()=>loop.stop();
  },[reduceMotion,visible,pulse]);
  useEffect(()=>{
    scrollOffsetRef.current=0;contentHeightRef.current=0;viewportHeightRef.current=0;fitPassRef.current=0;
    setOverflow(false);setFit({bodySize:initialBodySize,lineHeight:1.42,gap:initialGap});clearAutoScroll();
    requestAnimationFrame(()=>bodyRef.current?.scrollTo({y:0,animated:false}));
    return clearAutoScroll;
  },[visible,cardWidth,initialBodySize,initialGap]);
  useEffect(()=>{if(!visible){clearAutoScroll();return;}if(overflow)scheduleAutoScroll();else clearAutoScroll();return clearAutoScroll;},[visible,overflow,reduceMotion,fit.bodySize,fit.gap,fit.lineHeight]);

  if(!story?.intro)return null;
  const title=story.name||story.label||story.type||story.id||'',paragraphs=String(story.intro||'').split(/\n\s*\n/g).filter(Boolean);
  const haloScale=pulse.interpolate({inputRange:[0,1],outputRange:[.92,1.08]}),haloOpacity=pulse.interpolate({inputRange:[0,1],outputRange:[.18,.48]}),starScale=pulse.interpolate({inputRange:[0,1],outputRange:[.96,1.08]});
  return <>
    {!visible?<Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{expanded:false}} onPress={onOpen} style={({pressed})=>[styles.steleTrigger,compact&&styles.steleTriggerCompact,pressed&&styles.steleTriggerPressed]}>
      <View pointerEvents="none" style={styles.steleTriggerLine}/>
      <Image pointerEvents="none" source={STORY_STELE} resizeMode="contain" style={[styles.steleTriggerImage,compact&&styles.steleTriggerImageCompact]}/>
      <Animated.View pointerEvents="none" style={[styles.steleTriggerHalo,{opacity:haloOpacity,transform:[{scale:haloScale}]}]}/>
      <Animated.Text pointerEvents="none" style={[styles.steleStar,{transform:[{scale:starScale}]}]}>✦</Animated.Text>
    </Pressable>:null}
    {visible?<Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.steleOverlay}>
        <Pressable style={styles.steleBackdrop} onPress={onClose}/>
        <Pressable accessibilityRole="none" onPress={onClose} style={[styles.steleCard,{width:cardWidth,height:cardHeight}]}>
          <Image pointerEvents="none" source={STORY_STELE} resizeMode="contain" style={styles.steleCardImage}/>
          <Text pointerEvents="none" style={[styles.steleCardStar,{fontSize:Math.max(20,Math.min(42,cardWidth*.06))}]}>✦</Text>
          <Pressable accessibilityRole="none" onPress={(event)=>event.stopPropagation?.()} style={styles.steleContent}>
            <Text adjustsFontSizeToFit minimumFontScale={Math.min(1,18/titleSize)} numberOfLines={2} style={[styles.steleTitle,{fontSize:titleSize,lineHeight:titleSize*1.03}]}>{title}</Text>
            <ScrollView
              ref={bodyRef}
              style={styles.steleBodyViewport}
              showsVerticalScrollIndicator={false}
              onLayout={(event)=>{viewportHeightRef.current=event.nativeEvent.layout.height;refreshOverflow();}}
              onContentSizeChange={(_,nextHeight)=>{contentHeightRef.current=nextHeight;refreshOverflow();}}
              onScrollBeginDrag={pauseForManualScroll}
              onTouchStart={pauseForManualScroll}
              onScroll={(event)=>{scrollOffsetRef.current=event.nativeEvent.contentOffset.y;}}
              scrollEventThrottle={32}
              contentContainerStyle={styles.steleBody}
            >
              {paragraphs.map((paragraph,index)=><Text key={index} style={[styles.steleParagraph,{fontSize:fit.bodySize,lineHeight:fit.bodySize*fit.lineHeight,marginBottom:index===paragraphs.length-1?0:fit.gap}]}>{paragraph.replace(/[\t ]*\n[\t ]*/g,' ')}</Text>)}
            </ScrollView>
          </Pressable>
        </Pressable>
      </View>
    </Modal>:null}
  </>;
}

export function PathScreen({route,settings={},onOpenStation,onOpenWordList}){
  const m=(key,params)=>msg(settings,key,params),defaultStory=route.storyOrder?.[0]||'',storyLabels=useMemo(()=>Object.fromEntries((route.storyOrder||[]).map(type=>[type,canonicalStoryLabel(settings,type,route.stories?.[type])])),[route,settings?.interface_language_code]);
  const [activeStory,setActiveStory]=useState(defaultStory),[pathReady,setPathReady]=useState(false),[progressMap,setProgressMap]=useState(()=>new Map()),[geometry,setGeometry]=useState(null),[guideIndex,setGuideIndex]=useState(-1),[guideStationKey,setGuideStationKey]=useState(''),[steleOpen,setSteleOpen]=useState(false);
  const scrollRef=useRef(null),positionedRef=useRef(false),offsetRef=useRef(0),contentHeightRef=useRef(1),viewportHeightRef=useRef(1),storyRef=useRef(defaultStory),storyTabsRef=useRef(null),storyTabsControlRef=useRef(null),routeScaleRef=useRef(null),geometryRef=useRef(geometryBuffer()),geometryFrameRef=useRef(0),geometrySignatureRef=useRef(''),storyTargetRefsRef=useRef(new Map()),stationTargetRefsRef=useRef(new Map());
  const storyTargetRefs=storyTargetRefsRef.current,stationTargetRefs=stationTargetRefsRef.current,{width:viewportWidth}=useWindowDimensions(),insets=useSafeAreaInsets();
  for(const storyType of route.storyOrder||[])ensureTargetRef(storyTargetRefs,storyType);

  useEffect(()=>{
    let alive=true;
    Promise.all([loadNativeWordProgressMap(),loadNativePathSettings(defaultStory)]).then(([map,pathSettings])=>{
      if(!alive)return;
      setProgressMap(map);
      const restored=route.stories?.[pathSettings.active_story]?pathSettings.active_story:defaultStory;
      storyRef.current=restored;setActiveStory(restored);setPathReady(true);
    });
    return()=>{alive=false;saveNativeStoryScroll(storyRef.current,offsetRef.current).catch(()=>{});if(geometryFrameRef.current)cancelAnimationFrame(geometryFrameRef.current);};
  },[defaultStory,route]);

  useEffect(()=>{
    let cancelled=false;
    geometryRef.current=geometryBuffer();geometrySignatureRef.current='';setGeometry(null);
    positionedRef.current=false;contentHeightRef.current=1;viewportHeightRef.current=1;offsetRef.current=0;storyRef.current=activeStory;setSteleOpen(false);
    if(pathReady&&route.stories?.[activeStory]?.intro&&!getNativeGeneralGuideRuntime().active){
      (async()=>{
        const seen=await hasSeenNativeStoryStele(activeStory);
        if(cancelled||seen||getNativeGeneralGuideRuntime().active)return;
        await markNativeStorySteleSeen(activeStory).catch(()=>{});
        if(!cancelled&&storyRef.current===activeStory&&!getNativeGeneralGuideRuntime().active)setSteleOpen(true);
      })().catch(()=>{});
    }
    return()=>{cancelled=true;if(geometryFrameRef.current){cancelAnimationFrame(geometryFrameRef.current);geometryFrameRef.current=0;}};
  },[activeStory,pathReady,route]);

  const changeStory=async(nextStory)=>{if(!nextStory||nextStory===activeStory)return;await saveNativeStoryScroll(activeStory,offsetRef.current);await saveNativeActiveStory(nextStory);offsetRef.current=0;setSteleOpen(false);setActiveStory(nextStory);};
  const openStation=async(station)=>{await saveNativeStoryScroll(activeStory,offsetRef.current);await saveNativeActiveStory(activeStory);const runtime=getNativeGeneralGuideRuntime();if(runtime.active&&runtime.phase==='await-station')setNativeGeneralGuideRuntime({phase:'station-study'});onOpenStation(station);};
  const openWordList=async()=>{await saveNativeStoryScroll(activeStory,offsetRef.current);await saveNativeActiveStory(activeStory);onOpenWordList?.(activeStory);};
  const openStele=async()=>{await markNativeStorySteleSeen(activeStory).catch(()=>{});setSteleOpen(true);};
  const closeStele=()=>setSteleOpen(false);
  const startGuide=()=>{setSteleOpen(false);beginNativeGeneralGuide();setGuideStationKey('');setGuideIndex(0);};
  const stopGuide=()=>{resetNativeGeneralGuideRuntime();setGuideStationKey('');setGuideIndex(-1);};
  const currentGuide=guideIndex>=0?GENERAL_GUIDE_STEPS[guideIndex]:null;

  const story=route.stories?.[activeStory],stations=story?.stations||[],snapshot=useMemo(()=>createRouteProgressSnapshot(progressMap),[progressMap]),storySummary=useMemo(()=>storyProgress(route,activeStory,snapshot),[route,activeStory,snapshot]),stationIndex=useMemo(()=>new Map(stations.map((station,index)=>[station.key,index])),[stations]);
  const amplitude=Math.min(theme.path.waveAmplitudeMax,Math.max(theme.path.waveAmplitudeMin,viewportWidth*theme.path.waveAmplitudeWidthRatio));
  const shiftFor=(station)=>POSITION_PATTERN[(stationIndex.get(station.key)||0)%POSITION_PATTERN.length]*amplitude;
  const displayCatalogs=useMemo(()=>[...(story?.catalogs||[])].reverse(),[story]);
  const displaySections=useMemo(()=>displayCatalogs.flatMap((catalog)=>[...(catalog.sections||[])].reverse().map((section)=>({catalog,section}))),[displayCatalogs]);
  const displayStations=useMemo(()=>displaySections.flatMap(({catalog,section})=>[...(section.stations||[])].reverse().map((station)=>({catalog,section,station}))),[displaySections]);
  const stationOrder=useMemo(()=>new Map(displayStations.map(({station},index)=>[station.key,index])),[displayStations]);

  const scheduleGeometryCommit=()=>{
    if(geometryFrameRef.current)return;
    geometryFrameRef.current=requestAnimationFrame(()=>{
      geometryFrameRef.current=0;
      const buffer=geometryRef.current;
      if(!buffer.map||buffer.stations.size<displayStations.length||buffer.sections.size<displaySections.length||buffer.catalogs.size<displayCatalogs.length)return;
      const stationSig=Array.from(buffer.stations.entries()).map(([key,value])=>`${key}:${Math.round(value.y)}:${value.sectionKey}`).join('|');
      const sectionSig=Array.from(buffer.sections.entries()).map(([key,value])=>`${key}:${Math.round(value.y)}:${Math.round(value.height)}`).join('|');
      const catalogSig=Array.from(buffer.catalogs.entries()).map(([key,value])=>`${key}:${Math.round(value.y)}:${Math.round(value.height)}`).join('|');
      const signature=`${Math.round(buffer.map.width)}:${Math.round(buffer.map.height)}:${stationSig}:${sectionSig}:${catalogSig}`;
      if(signature===geometrySignatureRef.current)return;
      geometrySignatureRef.current=signature;
      setGeometry({map:{...buffer.map},stations:new Map(buffer.stations),sections:new Map(buffer.sections),catalogs:new Map(buffer.catalogs)});
    });
  };
  const recordMap=(event)=>{geometryRef.current.map={...event.nativeEvent.layout};scheduleGeometryCommit();};
  const recordStation=(catalog,section,station,event)=>{geometryRef.current.stations.set(station.key,{y:event.nativeEvent.layout.y,catalogKey:catalogKey(catalog),sectionKey:sectionKey(catalog,section)});scheduleGeometryCommit();};
  const recordSection=(catalog,section,event)=>{geometryRef.current.sections.set(sectionKey(catalog,section),{...event.nativeEvent.layout});scheduleGeometryCommit();};
  const recordCatalog=(catalog,event)=>{geometryRef.current.catalogs.set(catalogKey(catalog),{...event.nativeEvent.layout});scheduleGeometryCommit();};

  const points=useMemo(()=>{
    if(!geometry?.map)return[];
    return displayStations.map(({station})=>{
      const row=geometry.stations.get(station.key),section=geometry.sections.get(row?.sectionKey),catalog=geometry.catalogs.get(row?.catalogKey);
      if(!row||!section||!catalog)return null;
      return{key:station.key,index:stationOrder.get(station.key)??9999,x:geometry.map.width/2+shiftFor(station),y:catalog.y+section.y+row.y+theme.path.stationSize/2};
    }).filter(Boolean).sort((a,b)=>a.index-b.index);
  },[geometry,displayStations,stationOrder,amplitude]);
  const connector=useMemo(()=>connectorPath(points),[points]);

  const scaleParts=useMemo(()=>{
    if(!geometry?.map?.height)return[];
    const parts=[];
    displayCatalogs.forEach((catalog)=>{
      const cKey=catalogKey(catalog),catalogLayout=geometry.catalogs.get(cKey);
      parts.push({type:'diamond',key:`d-${cKey}`,catalogKey:cKey,targetY:catalogLayout?.y||0,label:catalog.name||m('mobile.path.dictionary')});
      const sections=[...(catalog.sections||[])].reverse();
      sections.forEach((section,sectionIndex)=>{
        const sKey=sectionKey(catalog,section),sectionLayout=geometry.sections.get(sKey),count=dotCount(sectionLayout?.height||1,geometry.map.height);
        for(let index=0;index<count;index+=1)parts.push({type:'dot',key:`p-${sKey}-${index}`});
        if(sectionIndex<sections.length-1)parts.push({type:'section',key:`s-${sKey}`});
      });
    });
    return parts;
  },[geometry,displayCatalogs]);

  const syncScaleMetrics=(next={})=>routeScaleRef.current?.setMetrics({content:contentHeightRef.current,viewport:viewportHeightRef.current,offset:offsetRef.current,...next});
  const restoreMapPosition=async()=>{
    if(!pathReady||positionedRef.current||contentHeightRef.current<=1||viewportHeightRef.current<=1)return;
    positionedRef.current=true;
    const targetStory=activeStory,saved=await loadNativeStoryScroll(targetStory);
    if(storyRef.current!==targetStory){positionedRef.current=false;return;}
    requestAnimationFrame(()=>{
      if(storyRef.current!==targetStory)return;
      if(saved===null)scrollRef.current?.scrollToEnd({animated:false});
      else scrollRef.current?.scrollTo({y:saved,animated:false});
      offsetRef.current=saved===null?Math.max(0,contentHeightRef.current-viewportHeightRef.current):saved;
      syncScaleMetrics({offset:offsetRef.current});
    });
  };
  useEffect(()=>{void restoreMapPosition();},[pathReady,activeStory,geometry?.map?.height]);

  const onViewportLayout=(event)=>{viewportHeightRef.current=event.nativeEvent.layout.height||1;syncScaleMetrics();void restoreMapPosition();};
  const onContentSizeChange=(_,height)=>{contentHeightRef.current=height||1;syncScaleMetrics();void restoreMapPosition();};
  const onPathScroll=(event)=>{const offset=event.nativeEvent.contentOffset.y;offsetRef.current=offset;routeScaleRef.current?.updateOffset(offset);};
  const jumpScale=(part)=>{const viewport=viewportHeightRef.current||1,target=Math.max(0,(Number(part?.targetY)||0)-viewport*.16);scrollRef.current?.scrollTo({y:target,animated:true});};
  const selectVisibleGuideStation=()=>{
    const viewport=viewportHeightRef.current||1,center=viewport/2,hardTop=viewport*.28,preferredTop=viewport*.40,preferredBottom=viewport*.65,offset=offsetRef.current;
    const candidates=points.map(point=>({...point,screenY:theme.path.mapTop+point.y-offset})).filter(point=>point.screenY>=hardTop&&point.screenY<=viewport-8);
    const comfortable=candidates.filter(point=>point.screenY>=preferredTop&&point.screenY<=preferredBottom),pool=comfortable.length?comfortable:candidates.length?candidates:points.map(point=>({...point,screenY:theme.path.mapTop+point.y-offset}));
    pool.sort((a,b)=>{const distance=Math.abs(a.screenY-center)-Math.abs(b.screenY-center);return Math.abs(distance)>12?distance:b.index-a.index;});
    const key=pool[0]?.key||displayStations.at(-1)?.station?.key||displayStations[0]?.station?.key||'';setGuideStationKey(key);return key;
  };
  const nextGuide=async()=>{
    if(!currentGuide)return;
    if(currentGuide.id==='stages'){
      setNativeGeneralGuideRuntime({active:true,phase:'await-station'});setGuideIndex(-1);return;
    }
    const nextIndex=guideIndex+1;if(nextIndex>=GENERAL_GUIDE_STEPS.length){stopGuide();return;}
    const next=GENERAL_GUIDE_STEPS[nextIndex];setSteleOpen(false);
    if(next?.story&&route.stories?.[next.story]){if(next.story!==activeStory)await changeStory(next.story);await storyTabsControlRef.current?.scrollToStory?.(next.story,true);}
    if(next?.id==='stages')selectVisibleGuideStation();
    const storyIndex=next?.story?Math.max(0,GENERAL_GUIDE_STEPS.filter(step=>step?.id?.startsWith('story:')).findIndex(step=>step.story===next.story)):getNativeGeneralGuideRuntime().storyIndex;
    setNativeGeneralGuideRuntime({active:true,phase:next?.id?.startsWith('story:')?'story':next?.id||'',storyIndex});setGuideIndex(nextIndex);
  };

  const routeItems=[];
  displayCatalogs.forEach((catalog)=>{
    const labels=showStationLabels(catalog),sections=[...(catalog.sections||[])].reverse();
    routeItems.push(
      <View key={catalogKey(catalog)} style={styles.routeCatalog} onLayout={(event)=>recordCatalog(catalog,event)}>
        <View style={styles.routeCatalogGroups}>
          {sections.map((section)=>{
            const reversedStations=[...(section.stations||[])].reverse();
            return <View key={sectionKey(catalog,section)} style={styles.routeSection} onLayout={(event)=>recordSection(catalog,section,event)}>
              <View style={styles.routeSectionStations}>
                {reversedStations.map((station)=>{
                  const summary=stationWordProgress(station,snapshot),status=computedStationStatus(station,snapshot),index=stationIndex.get(station.key)||0,shift=shiftFor(station),milestones=stationMilestoneCount(summary.mastered),done=status==='mastered'||status==='review_1_due',fallback=m('mobile.path.stage',{number:index+1}),targetRef=ensureTargetRef(stationTargetRefs,station.key);
                  return <View key={station.key} style={styles.stationRow} onLayout={(event)=>recordStation(catalog,section,station,event)}>
                    <Pressable accessibilityRole="button" accessibilityLabel={station.name||fallback} accessibilityValue={{text:status}} disabled={status==='locked'} accessibilityState={{disabled:status==='locked'}} hitSlop={8} onPress={()=>openStation(station)} style={({pressed})=>[styles.stationNode,status==='locked'&&styles.stationLocked,{transform:[{translateX:shift},{scale:pressed?0.97:1}]}]}>
                      <StationProgressRing targetRef={targetRef} percent={summary.percent} done={done}>
                        <MillstoneFace status={status} done={done}><Text style={styles.stationOrdinal}>{String(index+1).padStart(2,'0')}</Text></MillstoneFace>
                      </StationProgressRing>
                      {milestones?<Text style={styles.stationMilestones}>{'⌃'.repeat(milestones)}</Text>:null}
                      <View style={styles.stationMeta}>
                        {labels?<Text numberOfLines={2} style={styles.stationLabel}>{station.name||fallback}</Text>:null}
                        <Text style={styles.stationCount}>{summary.mastered}/{summary.total}</Text>
                      </View>
                    </Pressable>
                  </View>;
                })}
              </View>
              {section.name?<Text style={styles.sectionHeading}>{section.name}</Text>:null}
            </View>;
          })}
        </View>
        <Text style={styles.catalogHeading}>{catalog.name||m('mobile.path.dictionary')}</Text>
      </View>
    );
  });

  const compactFloat=viewportWidth<=390,guideStoryRef=currentGuide?.story?storyTargetRefs.get(currentGuide.story):null,guideTarget=currentGuide?.id==='stages'?stationTargetRefs.get(guideStationKey):currentGuide?.id?.startsWith('story:')?guideStoryRef:currentGuide?.id==='stories-intro'||currentGuide?.id==='summary'?storyTabsRef:null,guideStationPoint=points.find(point=>point.key===guideStationKey),guideStationY=guideStationPoint?theme.path.mapTop+guideStationPoint.y-offsetRef.current:0;
  const guideShape=currentGuide?.id==='stages'?'circle':currentGuide?.id?.startsWith('story:')?'pill':currentGuide?.id==='stories-intro'||currentGuide?.id==='summary'?'rounded':'auto',guidePadding=currentGuide?.id==='stages'?10:currentGuide?.id?.startsWith('story:')?7:6,guidePreference=currentGuide?.id==='stages'?(guideStationY>viewportHeightRef.current/2?'top':'bottom'):currentGuide?.id==='stories-intro'||currentGuide?.id==='summary'||currentGuide?.id?.startsWith('story:')?'bottom':'auto';

  return <Screen bottomNav topChromeDepth={theme.chrome.screenDepths.path.top} bottomChromeDepth={theme.chrome.screenDepths.path.bottom}>
    <Topography opacity={.28}/>
    <View style={styles.pathControls}>
      <StoryTabs targetRef={storyTabsRef} controlRef={storyTabsControlRef} storyTargetRefs={storyTargetRefs} route={route} activeStory={activeStory} onChange={changeStory} storyLabels={storyLabels}/>
      <View style={styles.storyProgress}>
        <SegmentedStoryProgress value={storySummary.percent}/>
        <MonoLabel accent>{storySummary.percent}%</MonoLabel>
        <MonoLabel>{storySummary.masteredWords}/{storySummary.totalWords}</MonoLabel>
      </View>
    </View>
    <FadedScrollView topFade={theme.chrome.scrollFades.path.top} bottomFade={theme.chrome.scrollFades.path.bottom} ref={scrollRef} style={styles.pathViewport} contentContainerStyle={[styles.pathContent,{paddingLeft:viewportWidth<=420?12:20,paddingRight:viewportWidth<=340?28:viewportWidth<=420?36:50,paddingBottom:insets.bottom+theme.control.nav+theme.chrome.contentRestGap}]} scrollEventThrottle={32} showsVerticalScrollIndicator={false} onLayout={onViewportLayout} onContentSizeChange={onContentSizeChange} onScroll={onPathScroll}>
      <View style={styles.routeMap} onLayout={recordMap}>
        {connector&&geometry?.map?.width&&geometry?.map?.height?<Svg pointerEvents="none" width={geometry.map.width} height={geometry.map.height} style={styles.routeConnector}><SvgPath d={connector} fill="none" stroke="rgba(102,97,88,.38)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 7" opacity={.72}/></Svg>:null}
        {routeItems}
      </View>
    </FadedScrollView>
    <Pressable accessibilityRole="button" accessibilityLabel={m('mobile.path.word_list')} onPress={openWordList} style={({pressed})=>[styles.wordListFloat,compactFloat&&styles.wordListFloatCompact,pressed&&styles.floatingPressed]}>
      <ListChecksIcon size={compactFloat?18:19} color={C.text2}/>
    </Pressable>
    <RouteScale ref={routeScaleRef} parts={scaleParts} onJump={jumpScale}/>
    <StoryStele story={story?{...story,name:storyLabels[activeStory]||story.name}:story} visible={steleOpen} onOpen={openStele} onClose={closeStele}/>
    <GuideHelpButton onPress={startGuide} accessibilityLabel={m('mobile.path.help')}/>
    <GuideOverlay visible={Boolean(currentGuide)} settings={settings} step={currentGuide} targetRef={guideTarget} spotlightShape={guideShape} spotlightPadding={guidePadding} contentPreference={guidePreference} onNext={nextGuide} onSkip={stopGuide} nextLabel={currentGuide?.id==='stages'?m('guide.understood'):''}/>
  </Screen>;
}

const styles=StyleSheet.create({
  pathControls:{position:'absolute',zIndex:30,elevation:30,top:0,left:0,right:0,height:theme.path.rootControlsHeight,paddingHorizontal:0,paddingBottom:2},
  storyTabsShell:{position:'relative',height:32,overflow:'hidden'},
  storyTabs:{height:32,alignItems:'center',paddingHorizontal:0,gap:theme.chrome.storyTabs.gap},
  storyEdge:{position:'absolute',zIndex:4,top:0,width:24,height:32,textAlign:'center',fontFamily:theme.font.terminal,fontSize:18,fontWeight:'800',lineHeight:32,color:C.text2,opacity:.72,backgroundColor:'rgba(238,233,223,.78)'},
  storyEdgeStart:{left:0},
  storyEdgeEnd:{right:0},
  storyTab:{flexShrink:0,maxWidth:280,height:30,paddingHorizontal:8,marginVertical:1,borderRadius:12,alignItems:'center',justifyContent:'center'},storyTabFirst:{marginLeft:theme.chrome.storyTabs.edgeInset},storyTabLast:{marginRight:theme.chrome.storyTabs.edgeInset},
  storyTabSelected:{backgroundColor:'rgba(246,242,233,.28)'},
  storyTabPressed:{opacity:.68,transform:[{translateY:1}]},
  storyTabText:{fontFamily:theme.font.terminal,fontWeight:'700',color:C.text3,opacity:.64},
  storyTabActive:{color:C.text1,opacity:1},
  storyProgress:{height:22,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},
  segmentedProgress:{width:62,height:5,flexDirection:'row',gap:2},
  segmentedProgressCell:{flex:1,height:5,borderRadius:1,backgroundColor:C.lineSoft},
  segmentedProgressCellOn:{backgroundColor:C.accentStrong},
  pathViewport:{position:'absolute',top:0,left:0,right:0,bottom:0},
  pathContent:{paddingTop:theme.path.mapTop},
  routeMap:{position:'relative',width:'100%',maxWidth:560,alignSelf:'center',gap:theme.path.dictionaryGap},
  routeConnector:{position:'absolute',zIndex:0,left:0,top:0},
  routeCatalog:{position:'relative',zIndex:1,gap:theme.path.headingGap},
  routeCatalogGroups:{gap:theme.path.sectionGap,paddingBottom:theme.path.routeGroupsBottom},
  routeSection:{gap:theme.path.headingGap},
  routeSectionStations:{alignItems:'center',gap:theme.path.stationGap,paddingBottom:theme.path.stationMetaReserve},
  stationRow:{position:'relative',width:'100%',height:theme.path.stationSize,alignItems:'center'},
  stationNode:{position:'relative',zIndex:1,width:theme.path.stationSize,height:theme.path.stationSize,alignItems:'center'},
  stationLocked:{opacity:.42},
  stationProgressRing:{position:'relative',width:theme.path.stationSize,height:theme.path.stationSize,padding:2,alignItems:'center',justifyContent:'center'},
  millstoneFace:{position:'relative',width:56,height:56,borderWidth:1,borderColor:'rgba(75,70,61,.42)',borderTopLeftRadius:25,borderTopRightRadius:29,borderBottomRightRadius:26,borderBottomLeftRadius:28,backgroundColor:'#d8d0c2',alignItems:'center',justifyContent:'center',shadowColor:'#36322b',shadowOpacity:.12,shadowRadius:6,shadowOffset:{width:0,height:4},elevation:2,overflow:'hidden'},
  millstoneInnerRing:{position:'absolute',top:4,left:4,right:4,bottom:4,borderWidth:1,borderColor:'rgba(72,66,56,.18)',borderRadius:24},
  millstoneStoneMarkA:{position:'absolute',left:17,top:13,width:5,height:5,borderRadius:3,backgroundColor:'#eee8dc',opacity:.9},
  millstoneStoneMarkB:{position:'absolute',right:17,bottom:16,width:4,height:4,borderRadius:2,backgroundColor:'rgba(81,75,65,.12)'},
  millstoneStudying:{borderColor:C.accent,backgroundColor:'#d8d0c2'},
  millstoneDone:{backgroundColor:'#d9c79e',borderColor:'rgba(101,73,31,.42)'},
  millstoneReview:{borderColor:C.accentStrong},
  millstoneLocked:{borderColor:C.locked,backgroundColor:'#e3ded5'},
  millstoneHole:{position:'absolute',width:9,height:9,borderRadius:5,borderWidth:1,borderColor:'rgba(72,66,56,.18)',backgroundColor:C.appBg,shadowColor:'#322e27',shadowOpacity:.25,shadowRadius:2,shadowOffset:{width:0,height:1}},
  stationOrdinal:{fontFamily:theme.font.terminal,fontSize:8,fontWeight:'750',lineHeight:8,color:C.text2,marginTop:19},
  stationMilestones:{position:'absolute',top:49,left:-16,right:-16,textAlign:'center',fontFamily:theme.font.terminal,fontSize:8,fontWeight:'850',lineHeight:8,letterSpacing:-1,color:C.accentStrong},
  stationMeta:{position:'absolute',top:65,left:-45,width:150,alignItems:'center',gap:3},
  stationLabel:{width:150,fontSize:10,fontWeight:'750',lineHeight:11.5,color:C.text1,textAlign:'center'},
  stationCount:{fontFamily:theme.font.terminal,fontSize:8,fontWeight:'700',lineHeight:8,color:C.text3},
  sectionHeading:{alignSelf:'center',maxWidth:360,paddingHorizontal:8,fontSize:14,fontWeight:'800',lineHeight:17,color:C.text1,textAlign:'center'},
  catalogHeading:{alignSelf:'center',maxWidth:300,paddingHorizontal:8,fontSize:17,fontWeight:'850',lineHeight:20,color:C.text1,textAlign:'center',letterSpacing:.76},
  wordListFloat:{position:'absolute',zIndex:32,left:10,top:'80%',marginTop:-64,width:36,height:36,borderRadius:18,borderWidth:1,borderColor:'rgba(41,39,34,.22)',backgroundColor:'rgba(246,242,233,.72)',alignItems:'center',justifyContent:'center',shadowColor:'#292722',shadowOpacity:.07,shadowRadius:14,shadowOffset:{width:0,height:5},elevation:4},
  wordListFloatCompact:{left:9,marginTop:-61,width:34,height:34,borderRadius:17},
  floatingPressed:{opacity:.72},
  routeScale:{position:'absolute',zIndex:30,right:theme.path.scaleRight,top:'20%',bottom:'20%',width:theme.path.scaleWidth,alignItems:'center',justifyContent:'space-evenly',backgroundColor:'transparent'},
  scaleDiamondHit:{width:26,height:26,alignItems:'center',justifyContent:'center'},
  scalePressed:{opacity:.65},
  scaleDiamond:{width:theme.path.scaleDiamond,height:theme.path.scaleDiamond,borderWidth:1,borderColor:'rgba(41,39,34,.55)',transform:[{rotate:'45deg'}],backgroundColor:'transparent'},
  scaleDiamondPassed:{borderColor:'rgba(41,39,34,.72)',backgroundColor:'rgba(41,39,34,.12)'},
  scaleDiamondCurrent:{transform:[{rotate:'45deg'},{scale:1.2}]},
  scaleSection:{width:theme.path.scaleSection,height:theme.path.scaleSection,borderWidth:1,borderColor:'rgba(41,39,34,.34)',backgroundColor:'transparent',transform:[{rotate:'45deg'}]},
  scaleDot:{width:theme.path.scaleDot,height:theme.path.scaleDot,borderRadius:2,backgroundColor:'rgba(41,39,34,.18)'},
  scalePassed:{backgroundColor:'rgba(41,39,34,.72)',borderColor:'rgba(41,39,34,.72)'},
  scaleSectionCurrent:{transform:[{rotate:'45deg'},{scale:1.35}]},
  scaleDotCurrent:{transform:[{scale:1.35}]},
  steleTrigger:{position:'absolute',zIndex:34,right:8,top:'80%',marginTop:-31,width:34,height:62,alignItems:'center',justifyContent:'center'},
  steleTriggerCompact:{right:9,marginTop:-29,width:32,height:58},
  steleTriggerPressed:{opacity:.78,transform:[{scale:.98},{translateY:1}]},
  steleTriggerLine:{position:'absolute',left:'50%',top:-14,bottom:-14,width:1,backgroundColor:'rgba(101,73,31,.28)'},
  steleTriggerImage:{position:'absolute',width:34,height:62},
  steleTriggerImageCompact:{width:32,height:58},
  steleTriggerHalo:{position:'absolute',top:3,width:28,height:28,borderRadius:14,backgroundColor:'rgba(208,154,67,.20)'},
  steleStar:{position:'absolute',top:10,fontFamily:theme.font.brand,fontSize:13,fontWeight:'700',color:'#D09A43',textShadowColor:'rgba(22,19,16,.72)',textShadowRadius:5},
  steleOverlay:{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:4},
  steleBackdrop:{...StyleSheet.absoluteFillObject,backgroundColor:'rgba(22,20,17,.72)'},
  steleCard:{position:'relative',alignItems:'center',shadowColor:'#141210',shadowOpacity:.34,shadowRadius:30,shadowOffset:{width:0,height:18},elevation:8},
  steleCardImage:{position:'absolute',top:0,left:0,width:'100%',height:'100%'},
  steleCardStar:{position:'absolute',zIndex:3,top:'12.5%',fontFamily:theme.font.brand,fontWeight:'700',color:'#D09A43',textShadowColor:'rgba(22,19,16,.72)',textShadowRadius:6},
  steleContent:{position:'absolute',zIndex:4,left:'22%',width:'56%',top:'18.3%',bottom:'13.5%',paddingHorizontal:'3%',paddingTop:'0.4%',paddingBottom:'1.2%',overflow:'hidden'},
  steleTitle:{color:'#F0E3CB',fontFamily:'serif',fontWeight:'600',textAlign:'center',textShadowColor:'rgba(20,18,16,.82)',textShadowRadius:2,marginBottom:6},
  steleBodyViewport:{flex:1,minHeight:0},
  steleBody:{paddingHorizontal:'1.4%',paddingBottom:8},
  steleParagraph:{color:'#E6DDCC',fontFamily:'serif',textAlign:'center',textShadowColor:'rgba(20,18,16,.82)',textShadowRadius:2},
});
