import fs from 'node:fs';
import assert from 'node:assert/strict';

function replace(source,before,after,label){
  assert.ok(source.includes(before),`16.6.6 final visual source mismatch: ${label}`);
  return source.replace(before,after);
}
function replaceRegex(source,pattern,after,label){
  assert.ok(pattern.test(source),`16.6.6 final visual source mismatch: ${label}`);
  return source.replace(pattern,after);
}
function edit(file,marker,apply){
  let source=fs.readFileSync(file,'utf8');
  if(source.includes(marker)){console.log(`${file}: already current`);return;}
  const next=apply(source);
  assert.notEqual(next,source,`${file}: no changes produced`);
  fs.writeFileSync(file,next);
  console.log(`${file}: corrected`);
}

edit('mobile/screens/path.js','function canonicalStoryLabel(settings,type,story)',source=>{
  source=replace(source,
    "const C=theme.colors;\nconst POSITION_PATTERN",
    "const C=theme.colors;\nfunction canonicalStoryLabel(settings,type,story){const fallback=story?.label||story?.name||type;if(type==='roots')return msg(settings,'path.voshozhdenie')||fallback;if(type==='ascent')return msg(settings,'path.na_vershine')||fallback;if(type==='pathways')return msg(settings,'path.tropy')||fallback;return fallback;}\nconst POSITION_PATTERN",
    'canonical Path story label helper');
  source=replace(source,
    'function StoryTabs({route,activeStory,onChange,targetRef,storyTargetRefs,controlRef}){',
    'function StoryTabs({route,activeStory,onChange,targetRef,storyTargetRefs,controlRef,storyLabels}){',
    'StoryTabs label contract');
  source=replace(source,
    '[ {route.stories[type]?.label||type} ]',
    '[ {storyLabels?.[type]||route.stories[type]?.label||type} ]',
    'StoryTabs canonical label');
  source=replace(source,
    "  const m=(key,params)=>msg(settings,key,params),defaultStory=route.storyOrder?.[0]||'';",
    "  const m=(key,params)=>msg(settings,key,params),defaultStory=route.storyOrder?.[0]||'',storyLabels=useMemo(()=>Object.fromEntries((route.storyOrder||[]).map(type=>[type,canonicalStoryLabel(settings,type,route.stories?.[type])])),[route,settings?.interface_language_code]);",
    'Path display labels');
  source=replace(source,
    '<StoryTabs targetRef={storyTabsRef} controlRef={storyTabsControlRef} storyTargetRefs={storyTargetRefs} route={route} activeStory={activeStory} onChange={changeStory}/>',
    '<StoryTabs targetRef={storyTabsRef} controlRef={storyTabsControlRef} storyTargetRefs={storyTargetRefs} route={route} activeStory={activeStory} onChange={changeStory} storyLabels={storyLabels}/>',
    'Path StoryTabs props');
  source=replace(source,
    '<StoryStele story={story} visible={steleOpen}',
    '<StoryStele story={story?{...story,name:storyLabels[activeStory]||story.name}:story} visible={steleOpen}',
    'Story Stele canonical title');
  return source;
});

edit('mobile/screens/station.js',"m('stage.menyu')",source=>replace(source,
  "[[\"words\",m('mobile.station.menu')],[\"statistics\",m('mobile.station.statistics')]]",
  "[[\"words\",m('stage.menyu')],[\"statistics\",m('stage.statistika')]]",
  'canonical Station tab copy'));

edit('mobile/ui/components.js','color={active?C.favorite:C.text3} filled/>',source=>replace(source,
  '<FavoriteIcon size={visual.iconSize} color={active?C.favorite:C.text3} filled={active}/>',
  '<FavoriteIcon size={visual.iconSize} color={active?C.favorite:C.text3} filled/>',
  'canonical filled inactive star'));

edit('mobile/ui/guide.js','function intersectionArea(a,b)',source=>{
  source=replace(source,
    "function rectIntersects(a,b,pad=8){if(!a||!b)return false;return!(a.x+a.width+pad<b.x||b.x+b.width+pad<a.x||a.y+a.height+pad<b.y||b.y+b.height+pad<a.y);}\n",
    "function rectIntersects(a,b,pad=8){if(!a||!b)return false;return!(a.x+a.width+pad<b.x||b.x+b.width+pad<a.x||a.y+a.height+pad<b.y||b.y+b.height+pad<a.y);}\nfunction clamp(value,min,max){return Math.min(max,Math.max(min,value));}\nfunction intersectionArea(a,b){if(!a||!b)return 0;const width=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),height=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return width*height;}\nfunction uniqueNumbers(values){const result=[];for(const value of values){if(!Number.isFinite(value))continue;const rounded=Math.round(value*10)/10;if(!result.some(item=>Math.abs(item-rounded)<1))result.push(rounded);}return result;}\n",
    'guide geometry helpers');
  source=replaceRegex(source,
    /  const panelStyle=useMemo\(\(\)=>\{.*?\},\[holes,avoidRects,panelHeight,height,width,insets\.top,insets\.bottom,avoidHeader,avoidBottomNav,contentPreference\]\);/,
    "  const panelStyle=useMemo(()=>{const panelWidth=Math.min(360,Math.max(0,width-28)),left=Math.max(14,(width-panelWidth)/2),cardHeight=Math.max(120,panelHeight),target=unionRect(holes),edge=width<=390?14:18,gap=edge,topLimit=avoidHeader?insets.top+theme.control.header+edge:edge,bottomLimit=avoidBottomNav?height-(insets.bottom+theme.control.nav+theme.chrome.contentRestGap):height-edge;if(!target)return{left,width:panelWidth,top:Math.max(topLimit,Math.min(bottomLimit-cardHeight,(height-cardHeight)/2))};if(contentPreference==='inside-bottom'){const maxTop=Math.max(edge,height-cardHeight-edge),minCandidateTop=Math.max(edge,target.y+gap),maxCandidateTop=Math.max(minCandidateTop,Math.min(maxTop,target.y+target.height-gap-cardHeight)),targetBottom=target.y+target.height-gap-cardHeight,protectedRects=avoidRects.map(rect=>({x:rect.x-gap,y:rect.y-gap,width:rect.width+gap*2,height:rect.height+gap*2})),aboveAvoided=protectedRects.length?Math.min(...protectedRects.map(rect=>rect.y))-cardHeight:targetBottom,candidates=[aboveAvoided,targetBottom,height*.72-cardHeight/2,(height-cardHeight)/2,height*.24-cardHeight/2],tops=uniqueNumbers(candidates.map(top=>clamp(top,minCandidateTop,maxCandidateTop)));let best=null;for(let index=0;index<tops.length;index+=1){const panelRect={x:left,y:tops[index],width:panelWidth,height:cardHeight},overlap=protectedRects.reduce((sum,rect)=>sum+intersectionArea(panelRect,rect),0),candidate={top:tops[index],penalty:overlap*100000+index};if(!best||candidate.penalty<best.penalty)best=candidate;if(overlap===0){best=candidate;break;}}return{left,width:panelWidth,top:best?.top??clamp((height-cardHeight)/2,minCandidateTop,maxCandidateTop)};}const topCandidate=Math.max(topLimit,target.y-cardHeight-14),bottomCandidate=Math.min(bottomLimit-cardHeight,target.y+target.height+14),topFits=topCandidate+cardHeight<=target.y-8,bottomFits=bottomCandidate>=target.y+target.height+8;let top;if(contentPreference==='top')top=topFits?topCandidate:bottomCandidate;else if(contentPreference==='bottom')top=bottomFits?bottomCandidate:topCandidate;else{const spaceAbove=target.y-topLimit,spaceBelow=bottomLimit-(target.y+target.height);top=spaceBelow>=spaceAbove&&bottomFits?bottomCandidate:topCandidate;}let panelRect={x:left,y:top,width:panelWidth,height:cardHeight};for(const avoid of avoidRects){if(!rectIntersects(panelRect,avoid))continue;const above=Math.max(topLimit,avoid.y-cardHeight-12),below=Math.min(bottomLimit-cardHeight,avoid.y+avoid.height+12);if(above+cardHeight<=avoid.y-6)top=above;else if(below>=avoid.y+avoid.height+6)top=below;panelRect={...panelRect,y:top};}return{left,width:panelWidth,top:Math.max(topLimit,Math.min(bottomLimit-cardHeight,top))};},[holes,avoidRects,panelHeight,height,width,insets.top,insets.bottom,avoidHeader,avoidBottomNav,contentPreference]);",
    'canonical guide inside-bottom placement');
  return source;
});

edit('mobile/screens/learn.js','undoTarget=useRef(null)',source=>{
  source=replace(source,
    'function LearningCard({flipped,flip,cardModel,m,type,state,item,mode,favorites,setFavorites,onUndo,favoriteTarget})',
    'function LearningCard({flipped,flip,cardModel,m,type,state,item,mode,favorites,setFavorites,onUndo,undoTarget,favoriteTarget})',
    'LearningCard undo target prop');
  source=replace(source,
    '<Pressable disabled={!state.swipeHistory.length} onPress=',
    '<Pressable ref={undoTarget} collapsable={false} disabled={!state.swipeHistory.length} onPress=',
    'Learn undo target ref');
  source=replace(source,
    'favoriteTarget=useRef(null),counterTarget=useRef(null);',
    'favoriteTarget=useRef(null),undoTarget=useRef(null),counterTarget=useRef(null);',
    'Learn undo target state');
  source=replace(source,
    'onUndo={undo} favoriteTarget={favoriteTarget}/>',
    'onUndo={undo} undoTarget={undoTarget} favoriteTarget={favoriteTarget}/>',
    'LearningCard undo target binding');
  source=replace(source,
    "contentPreference={currentGuide?.id==='card'||currentGuide?.id==='translation'||currentGuide?.id==='decision'?'inside-bottom':'auto'} interactiveTarget=",
    "contentPreference={currentGuide?.id==='card'||currentGuide?.id==='translation'||currentGuide?.id==='decision'?'inside-bottom':'auto'} avoidElements={[undoTarget,favoriteTarget]} interactiveTarget=",
    'Learn guide avoided card actions');
  source=replace(source,
    'contentPreference="inside-bottom" interactiveTarget',
    'contentPreference="inside-bottom" avoidElements={[undoTarget,favoriteTarget]} interactiveTarget',
    'Learn repeat guide avoided actions');
  return source;
});

edit('mobile/screens/station-test.js','masteryMessage=result.passed',source=>{
  source=replace(source,
    "if(done&&result){const levelSymbol=result.masteryLevel?'⌃'.repeat(result.masteryLevel):'—';return",
    "if(done&&result){const levelSymbol=result.masteryLevel?'⌃'.repeat(result.masteryLevel):'—',masteryMessage=result.passed?(result.masteryLevel>=3?m('path.iii_znak_vershiny'):result.masteryLevel===2?m('path.ii_marshrutnyy_znak'):result.masteryLevel===1?m('path.i_marshrutnyy_znak'):m('path.test_ne_sdan')):m('path.nuzhno_ne_menee',{required:result.required});return",
    'Stage result canonical mastery copy');
  source=replace(source,"<Header title={m('mobile.stage.results')}","<Header title={m('path.rezultat_testa')}",'Stage result header');
  source=replace(source,"<Text style={[styles.resultScore,type.result,result.passed?styles.scorePassed:styles.scoreFailed]}>","<Text style={styles.resultScore}>",'Stage result score style');
  source=replace(source,"<Text style={[styles.resultStatus,type.caption]}>{result.passed?m('mobile.stage.passed'):m('mobile.stage.repeat')} · {result.payload.correct_total}/{result.payload.questions_total}</Text>","<Text style={styles.resultStatus}>{masteryMessage} · {result.payload.correct_total}/{result.payload.questions_total}</Text>",'Stage result status copy');
  source=source.replace('<CorrectIcon size={16} color={C.successStrong}/>','<CorrectIcon size={22} color={C.successStrong}/>').replace('<WrongIcon size={16} color={C.dangerStrong}/>','<WrongIcon size={22} color={C.dangerStrong}/>');
  source=source.replace("{m('mobile.common.your_answer')}","{m('test.otvet')}").replace("{m('mobile.common.correct')}","{m('test.pravilno')}");
  source=source.replace('style={[styles.resultWrong,type.micro]}','style={styles.resultWrong}').replace('style={[styles.resultCorrect,type.micro]}','style={styles.resultCorrect}');
  source=source.replace("{m('mobile.stage.to_station')}","{m('path.k_etapu')}").replace("{m('mobile.common.retry')}","{m('path.povtorit')}");
  source=replace(source,
    "resultMark:{fontFamily:theme.font.terminal,fontSize:18,fontWeight:'900',color:C.accentStrong,textAlign:'center'},resultScore:{fontFamily:theme.font.terminal,textAlign:'center',marginTop:3},scorePassed:{color:C.successStrong},scoreFailed:{color:C.dangerStrong},resultStatus:{color:C.text2,textAlign:'center',marginTop:6},resultList:{paddingTop:theme.control.header+136,paddingHorizontal:14,paddingBottom:70},resultRow:{minHeight:62,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:C.lineSoft,paddingVertical:7},resultDot:{width:24,height:24,borderRadius:12,borderWidth:1,alignItems:'center',justifyContent:'center'},resultDotCorrect:{borderColor:C.success,backgroundColor:C.successSoft},resultDotWrong:{borderColor:C.danger,backgroundColor:C.dangerSoft},resultCopy:{flex:1,minWidth:0,gap:3},resultPrimary:{color:C.text1},detailLine:{width:'100%',flexDirection:'row',alignItems:'center',gap:5},detailLabel:{fontFamily:theme.font.terminal,fontSize:9,fontWeight:'800',lineHeight:11,color:C.text3},detailValue:{flex:1,minWidth:0,width:undefined},resultWrong:{color:C.dangerStrong},resultCorrect:{color:C.successStrong},",
    "resultMark:{fontFamily:theme.font.terminal,fontSize:18,fontWeight:'900',lineHeight:18,color:C.accentStrong,textAlign:'center'},resultScore:{fontFamily:theme.font.terminal,fontSize:42,fontWeight:'850',lineHeight:42,color:C.text1,textAlign:'center',marginTop:3},resultStatus:{marginTop:6,color:C.text2,fontSize:12,lineHeight:15,textAlign:'center'},resultList:{paddingTop:theme.control.header+136,paddingHorizontal:14,paddingBottom:70},resultRow:{height:80,minHeight:80,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft},resultDot:{width:44,height:80,alignItems:'center',justifyContent:'center'},resultDotCorrect:{backgroundColor:'transparent'},resultDotWrong:{backgroundColor:'transparent'},resultCopy:{flex:1,minWidth:0,gap:3},resultPrimary:{color:C.text1},detailLine:{width:'100%',flexDirection:'row',alignItems:'center',gap:5},detailLabel:{fontFamily:theme.font.terminal,fontSize:10,fontWeight:'800',lineHeight:10,color:C.text3},detailValue:{flex:1,minWidth:0,width:undefined},resultWrong:{fontSize:13,lineHeight:17,color:C.dangerStrong},resultCorrect:{fontSize:13,lineHeight:17,color:C.successStrong},",
    'Stage result row geometry');
  return source;
});

edit('mobile/screens/profile-main.js','settingsPreviewInset:',source=>{
  source=replace(source,
    "<View style={styles.settingsLearningPreview}><MonoLabel>{msg(settings,'mobile.settings.preview')}</MonoLabel><Text style={[styles.previewWord,draft.text_size_code==='small'&&styles.previewSmall,draft.text_size_code==='large'&&styles.previewLarge]}>{preview.word}</Text><Text style={[styles.previewTranslation,type.caption]}>{preview.translation}</Text></View>",
    "<View style={styles.settingsLearningPreview}><View pointerEvents=\"none\" style={styles.settingsPreviewInset}/><Text style={[styles.previewWord,draft.text_size_code==='small'&&styles.previewSmall,draft.text_size_code==='large'&&styles.previewLarge]}>{preview.word?`${preview.word[0].toUpperCase()}${preview.word.slice(1)}`:''}</Text><View style={styles.settingsPreviewCopy}><Text style={[styles.previewTranslation,type.emphasis]}>{preview.translation}</Text><Text style={[styles.previewExample,type.caption]}>{preview.example} <Text style={styles.previewStar}>✦</Text> {preview.exampleTranslation}</Text></View></View>",
    'Settings canonical learning preview content');
  source=replace(source,
    "settingsLearningPreview:{width:'100%',height:180,marginTop:14,alignItems:'center',justifyContent:'center',gap:8,borderWidth:1,borderColor:C.lineSoft,backgroundColor:C.paperSoft},previewWord:{fontSize:29,fontWeight:'900',color:C.text1},previewSmall:{fontSize:24},previewLarge:{fontSize:34},previewTranslation:{color:C.text2},",
    "settingsLearningPreview:{position:'relative',width:'100%',height:180,marginTop:14,paddingHorizontal:22,paddingVertical:20,alignItems:'center',justifyContent:'center',gap:12,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.lg,backgroundColor:C.paperSoft,overflow:'hidden'},settingsPreviewInset:{position:'absolute',top:10,left:10,right:10,bottom:10,borderWidth:1,borderColor:C.lineSoft,borderRadius:Math.max(1,theme.radius.lg-7),opacity:.55},previewWord:{position:'relative',zIndex:1,fontSize:31,fontWeight:'900',lineHeight:34,color:C.text1,textAlign:'center'},previewSmall:{fontSize:27,lineHeight:30},previewLarge:{fontSize:35,lineHeight:38},settingsPreviewCopy:{position:'relative',zIndex:1,width:'100%',gap:6},previewTranslation:{color:C.text1,textAlign:'left'},previewExample:{color:C.text2,textAlign:'left'},previewStar:{color:C.accentStrong},",
    'Settings canonical learning preview geometry');
  return source;
});

console.log('16.6.6 final Web 13.15.12 visual parity correction applied');
