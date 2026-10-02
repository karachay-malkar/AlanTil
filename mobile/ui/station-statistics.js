import React,{useEffect,useState}from'react';
import{Modal,Pressable,ScrollView,StyleSheet,Text,View}from'react-native';
import Svg,{Circle,Line,Polyline,Text as SvgText}from'react-native-svg';
import{listRowHeight}from'../../packages/alantil-ui/list-table.js';
import{getNativeStationStatistics}from'../platform/progress.js';
import{mobileLocale,msg}from'../i18n.js';
import{FadedScrollView}from'./faded-scroll';
import{ListChecksIcon}from'./icons.js';
import{ProfileTabs}from'./profile-tabs.js';
import{EmptyState}from'./parity.js';
import{useSemanticTypography}from'./runtime-settings.js';
import{theme}from'./theme.js';

const C=theme.colors;

function dateLabel(value,settings,compact=false){
  if(!value)return'—';
  const options=compact?{day:'2-digit',month:'short'}:{day:'2-digit',month:'2-digit',year:'numeric'};
  return new Intl.DateTimeFormat(mobileLocale(settings?.interface_language_code),options).format(new Date(value));
}
function showsLabel(value,settings){
  if(value==null)return'—';
  return new Intl.NumberFormat(mobileLocale(settings?.interface_language_code),{minimumFractionDigits:1,maximumFractionDigits:2}).format(Number(value));
}
function point(index,count,value,mode,maxShows){
  const left=34,top=16,width=272,height=136,x=count<=1?left+width/2:left+(index/(count-1))*width;
  const y=mode==='shows'?top+((maxShows-Math.max(1,Number(value)))/Math.max(1,maxShows-1))*height:top+((100-Math.max(0,Math.min(100,Number(value))))/100)*height;
  return{x,y};
}
function Series({items,color,suffix=''}) {
  if(!items.length)return null;
  const current=items[items.length-1],points=items.map(item=>`${item.x.toFixed(1)},${item.y.toFixed(1)}`).join(' ');
  return <>{items.length>1?<Polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>:null}{items.map((item,index)=>{const last=index===items.length-1;return <React.Fragment key={index}><Circle cx={item.x} cy={item.y} r={last?5.5:2.4} fill={last?C.appBg:color} stroke={color} strokeWidth={last?2.2:1.5}/>{last?<SvgText x={Math.min(304,item.x+7)} y={Math.max(11,item.y-7)} fontSize="8.5" fontWeight="800" fill={color}>{item.label}{suffix}</SvgText>:null}</React.Fragment>})}</>;
}
function ProgressGraph({stats,settings}){
  const timeline=stats.timeline||[];
  if(!timeline.length)return <View style={styles.graphEmpty}><Text style={styles.emptyText}>{msg(settings,'mobile.station.no_data')}</Text></View>;
  const maxShows=Math.max(2,Math.ceil(Math.max(1,...stats.learn.map(row=>Number(row.showsPerWord||1))))),firstTry=[],shows=[],tests=[];
  timeline.forEach((row,index)=>{if(row.type==='learn'){if(row.firstTryPercent!=null){const p=point(index,timeline.length,row.firstTryPercent,'percent',maxShows);firstTry.push({...p,label:String(row.firstTryPercent)})}if(row.showsPerWord!=null){const p=point(index,timeline.length,row.showsPerWord,'shows',maxShows);shows.push({...p,label:showsLabel(row.showsPerWord,settings)})}}else if(row.type==='station_test'){const p=point(index,timeline.length,row.percent,'percent',maxShows);tests.push({...p,label:String(row.percent)})}});
  const ticks=[...new Set([0,Math.floor((timeline.length-1)/2),timeline.length-1])];
  return <View style={styles.graph}><Svg width="100%" height={190} viewBox="0 0 340 190"><Line x1="34" y1="16" x2="306" y2="16" stroke={C.lineSoft}/><Line x1="34" y1="84" x2="306" y2="84" stroke={C.lineSoft}/><Line x1="34" y1="152" x2="306" y2="152" stroke={C.lineSoft}/><SvgText x="4" y="20" fontSize="8" fill={C.text3}>100%</SvgText><SvgText x="12" y="88" fontSize="8" fill={C.text3}>50%</SvgText><SvgText x="20" y="156" fontSize="8" fill={C.text3}>0</SvgText><SvgText x="312" y="20" fontSize="8" fill={C.text3}>{maxShows}</SvgText><SvgText x="312" y="156" fontSize="8" fill={C.text3}>1</SvgText><Series items={firstTry} color={C.accentStrong} suffix="%"/><Series items={shows} color={C.info}/><Series items={tests} color={C.successStrong} suffix="%"/>{ticks.map(index=>{const p=point(index,timeline.length,0,'percent',maxShows);return <SvgText key={index} x={p.x} y="181" textAnchor="middle" fontSize="7.5" fill={C.text3}>{dateLabel(timeline[index]?.date,settings,true)}</SvgText>})}</Svg></View>;
}
function Legend({settings,type}){
  const rows=[[C.accentStrong,msg(settings,'stage.first_try_goal')],[C.info,msg(settings,'stage.shows_per_word_goal')],[C.successStrong,msg(settings,'stage.test_result_goal')]];
  return <View style={styles.legend}>{rows.map(([color,label])=><View key={label} style={styles.legendRow}><View style={[styles.legendLine,{backgroundColor:color}]}/><Text style={[styles.legendText,{fontSize:type.caption.fontSize}]}>{label}</Text></View>)}</View>;
}
function HistoryDialog({visible,onClose,stats,settings,type}){
  const[mode,setMode]=useState('learn');useEffect(()=>{if(visible)setMode('learn')},[visible]);
  const learn=mode==='learn',rows=(learn?stats?.learn:stats?.tests)||[];
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent><View style={styles.modalBackdrop}><Pressable style={StyleSheet.absoluteFill} onPress={onClose}/><View style={styles.modalCard}><View style={styles.modalHead}><Text style={[styles.modalTitle,{fontSize:type.emphasis.fontSize}]}>{msg(settings,'stage.history')}</Text><Pressable accessibilityRole="button" accessibilityLabel={msg(settings,'common.close')} onPress={onClose} style={styles.modalClose}><Text style={styles.modalCloseText}>×</Text></Pressable></View><ProfileTabs items={[[ 'learn',msg(settings,'mobile.station.learn') ],[ 'tests',msg(settings,'stage.tests') ]]} activeId={mode} onChange={setMode} style={styles.historyTabs}/><View style={styles.historyHead}><Text style={[styles.historyHeadText,{fontSize:type.micro.fontSize}]}>{msg(settings,'stage.date')}</Text><Text style={[styles.historyMetricHead,{fontSize:type.micro.fontSize}]}>{msg(settings,learn?'stage.first_try':'stage.correct')}</Text><Text style={[styles.historyMetricHead,{fontSize:type.micro.fontSize}]}>{msg(settings,learn?'stage.shows_per_word':'stage.result')}</Text></View><ScrollView style={styles.historyScroll}>{rows.length?rows.slice().reverse().map((row,index)=><View key={row.id||index} style={styles.historyRow}><Text style={[styles.historyDate,{fontSize:type.caption.fontSize}]}>{dateLabel(row.date,settings)}</Text><Text style={[styles.historyMetric,{fontSize:type.caption.fontSize}]}>{learn?(row.firstTryPercent==null?'—':`${row.firstTryPercent}%`):(row.total?`${row.correct}/${row.total}`:'—')}</Text><Text style={[styles.historyMetric,{fontSize:type.caption.fontSize}]}>{learn?showsLabel(row.showsPerWord,settings):`${row.percent}%`}</Text></View>):<Text style={[styles.historyEmpty,{fontSize:type.caption.fontSize}]}>{msg(settings,'stage.no_completed_sessions')}</Text>}</ScrollView></View></View></Modal>;
}
export function StationStatistics({station,settings={}}){
  const type=useSemanticTypography(),rowHeight=listRowHeight(settings?.text_size_code),[stats,setStats]=useState(null),[historyOpen,setHistoryOpen]=useState(false);
  useEffect(()=>{let alive=true;getNativeStationStatistics(station).then(value=>{if(alive)setStats(value)});return()=>{alive=false}},[station]);
  if(!stats)return <EmptyState>{msg(settings,'mobile.common.loading')}</EmptyState>;
  return <><FadedScrollView topFade={theme.chrome.scrollFades.stationStatistics.top} bottomFade={theme.chrome.scrollFades.stationStatistics.bottom} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><View style={styles.section}><View style={styles.titleRow}><Text style={[styles.title,{fontSize:type.body.fontSize}]}>{msg(settings,'stage.progress_memory')}</Text><Pressable accessibilityRole="button" accessibilityLabel={msg(settings,'stage.history')} onPress={()=>setHistoryOpen(true)} style={({pressed})=>[styles.historyButton,pressed&&styles.pressed]}><ListChecksIcon size={21} color={C.text2}/></Pressable></View><ProgressGraph stats={stats} settings={settings}/><Legend settings={settings} type={type}/></View><View style={styles.section}><Text style={[styles.title,{fontSize:type.body.fontSize}]}>{msg(settings,'mobile.station.problems')}</Text>{stats.problems.length?<View style={styles.problemTable}><View style={styles.problemHead}><Text style={[styles.problemWordHead,{fontSize:type.micro.fontSize}]}>{msg(settings,'mobile.station.word')}</Text><Text numberOfLines={2} style={[styles.problemHeadMetric,{fontSize:type.micro.fontSize}]}>{msg(settings,'stage.shows_per_word')}</Text><Text numberOfLines={2} style={[styles.problemHeadMetric,{fontSize:type.micro.fontSize}]}>{msg(settings,'stage.test_errors')}</Text></View>{stats.problems.slice(0,7).map(row=><View key={row.wordId} style={[styles.problemRow,{height:rowHeight,minHeight:rowHeight}]}><View style={styles.problemCopy}><Text numberOfLines={1} style={[styles.problemWord,{fontSize:type.body.fontSize}]}>{row.word}</Text><Text numberOfLines={1} style={[styles.problemTrans,{fontSize:type.caption.fontSize}]}>{row.trans}</Text></View><Text style={[styles.problemMetric,{fontSize:type.caption.fontSize}]}>{showsLabel(row.showsPerWord,settings)}</Text><Text style={[styles.problemMetric,{fontSize:type.caption.fontSize}]}>{row.testErrors}</Text></View>)}</View>:<EmptyState>{msg(settings,'mobile.station.no_data')}</EmptyState>}</View></FadedScrollView><HistoryDialog visible={historyOpen} onClose={()=>setHistoryOpen(false)} stats={stats} settings={settings} type={type}/></>;
}
const styles=StyleSheet.create({
 scroll:{paddingTop:theme.control.header+36,paddingHorizontal:12,paddingBottom:theme.chrome.contentRestGap,gap:18},
 section:{gap:8},
 titleRow:{minHeight:38,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,borderBottomWidth:1,borderBottomColor:C.lineSoft},
 title:{paddingVertical:7,fontWeight:'850',color:C.text1},
 historyButton:{width:34,height:34,alignItems:'center',justifyContent:'center'},
 pressed:{opacity:.62,transform:[{translateY:1}]},
 graph:{width:'100%',minHeight:190,overflow:'hidden'},graphEmpty:{height:178,alignItems:'center',justifyContent:'center'},emptyText:{color:C.text3,textAlign:'center'},
 legend:{paddingTop:8,paddingBottom:3,borderTopWidth:1,borderTopColor:C.lineSoft,gap:7},legendRow:{flexDirection:'row',alignItems:'center',gap:7},legendLine:{width:18,height:2,borderRadius:2},legendText:{flex:1,color:C.text2},
 problemTable:{borderTopWidth:1,borderTopColor:C.lineSoft},problemHead:{minHeight:theme.listTable.table.header,paddingHorizontal:theme.listTable.horizontalPadding,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft},problemWordHead:{flex:1,fontFamily:theme.font.terminal,fontWeight:'800',color:C.text3},problemHeadMetric:{width:88,fontFamily:theme.font.terminal,fontWeight:'800',lineHeight:12,color:C.text3,textAlign:'center'},problemRow:{paddingHorizontal:theme.listTable.horizontalPadding,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft},problemCopy:{flex:1,minWidth:0,overflow:'hidden'},problemWord:{color:C.text1,fontWeight:'800'},problemTrans:{color:C.text2},problemMetric:{width:88,fontFamily:theme.font.terminal,fontWeight:'750',color:C.text2,textAlign:'center',fontVariant:['tabular-nums']},
 modalBackdrop:{...StyleSheet.absoluteFillObject,zIndex:90,alignItems:'center',justifyContent:'center',paddingHorizontal:14,backgroundColor:'rgba(31,30,26,.56)'},modalCard:{width:'100%',maxWidth:520,maxHeight:'82%',borderRadius:theme.modal.radius,backgroundColor:C.appBg,borderWidth:1,borderColor:C.line,overflow:'hidden'},modalHead:{minHeight:54,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.lineSoft},modalTitle:{fontWeight:'850',color:C.text1},modalClose:{width:36,height:36,alignItems:'center',justifyContent:'center'},modalCloseText:{fontSize:24,lineHeight:26,color:C.text2},historyTabs:{height:40,paddingHorizontal:12},historyHead:{minHeight:34,paddingHorizontal:12,flexDirection:'row',alignItems:'center',borderTopWidth:1,borderBottomWidth:1,borderColor:C.lineSoft},historyHeadText:{flex:1,fontFamily:theme.font.terminal,fontWeight:'750',color:C.text3},historyMetricHead:{width:92,fontFamily:theme.font.terminal,fontWeight:'750',color:C.text3,textAlign:'center'},historyScroll:{minHeight:80},historyRow:{minHeight:44,paddingHorizontal:12,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft},historyDate:{flex:1,color:C.text2},historyMetric:{width:92,fontFamily:theme.font.terminal,fontWeight:'800',color:C.text1,textAlign:'center',fontVariant:['tabular-nums']},historyEmpty:{padding:18,color:C.text3,textAlign:'center'}
});
