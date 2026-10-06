import React,{useEffect,useMemo,useState}from'react';
import{Pressable,ScrollView,StyleSheet,Text,TextInput,View}from'react-native';
import Svg,{Circle,Line,Polyline}from'react-native-svg';
import{socialMessage}from'../../packages/alantil-core/social-i18n.js';
import{listRowHeight,listTypography}from'../../packages/alantil-ui/list-table.js';
import{msg}from'../i18n.js';
import{Header,HeaderCircleButton,Screen}from'../ui/components.js';
import{ConfirmDialog}from'../ui/modal.js';
import{ProfileTabs}from'../ui/profile-tabs.js';
import{EmptyState,ListRow,MetricStrip,MonoLabel,ScreenSection}from'../ui/parity.js';
import{BlockIcon,SearchIcon,UnlockedIcon}from'../ui/icons.js';
import{theme}from'../ui/theme.js';
import{blockNativeUserAccount,fetchNativeExtendedAnalytics,fetchNativeStationTestDetail,fetchNativeUserActivityDetail,fetchNativeUserActivityList,fetchNativeUserFavorites,fetchNativeUserTestHistory,unblockNativeUserAccount}from'../platform/admin.js';
const C=theme.colors;
const STORY_ORDER=['understanding','roots','ascent','pathways'];
function fmtDate(value){if(!value)return'—';try{return new Date(value).toLocaleDateString();}catch{return'—';}}
function storyValue(stories,key){const value=stories?.[key]||{};return `${Math.max(0,Number(value.passed)||0)} / ${Math.max(0,Number(value.total)||0)}`;}
function RankMark({rank,fontSize}){if(rank>=1&&rank<=3)return <Text style={[styles.rankMedal,{fontSize},rank===1&&styles.rankGold,rank===2&&styles.rankSilver,rank===3&&styles.rankBronze]}>●</Text>;return null;}
function TableCell({children,width,head=false,numeric=false,style,fontSize}){const size=Number(fontSize)||12;return <View style={[styles.tableCell,{width,minWidth:width},head&&styles.tableHeadCell,style]}>{typeof children==='string'||typeof children==='number'?<Text numberOfLines={head?2:1} style={[head?styles.tableHeadText:styles.tableText,{fontSize:size,lineHeight:size*(head?1.1:1.25)},numeric&&styles.tableNumber]}>{children}</Text>:children}</View>;}
function UsersList({rows,loading,error,onOpen,s,am,settings,searchOpen,query,onQueryChange}){
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(r=>String(r.nickname||'').toLowerCase().includes(q));},[rows,query]),rowHeight=listRowHeight(settings?.text_size_code),text=listTypography(settings?.text_size_code);
  const storyKeys=[['understanding',am('admin.story_understanding')],['roots',am('admin.story_roots')],['ascent',am('admin.story_ascent')],['pathways',am('admin.story_pathways')]];
  return <View style={styles.usersPane}>
    {searchOpen?<View style={styles.searchBox}><TextInput value={query} onChangeText={onQueryChange} autoCapitalize="none" autoCorrect={false} placeholder={s('searchPlaceholder')} placeholderTextColor={C.text3} style={[styles.searchInput,{fontSize:text.secondary}]}/></View>:null}
    {loading?<View style={styles.inlineState}><EmptyState>{s('loading')}</EmptyState></View>:error?<View style={styles.inlineState}><EmptyState>{error}</EmptyState></View>:!filtered.length?<View style={styles.inlineState}><EmptyState>{s('emptySearch')}</EmptyState></View>:<ScrollView horizontal style={styles.tableHorizontal} contentContainerStyle={styles.tableHorizontalContent} showsHorizontalScrollIndicator>
      <View style={styles.usersTable}>
        <View style={[styles.tableRow,styles.tableHead,{height:theme.listTable.table.header,minHeight:theme.listTable.table.header}]}>
          <TableCell width={170} head fontSize={text.service} style={styles.userCell}>{am('admin.user')}</TableCell><TableCell width={88} head fontSize={text.service}>{am('admin.last_visit')}</TableCell><TableCell width={72} head fontSize={text.service}>{am('admin.streak')}</TableCell>{storyKeys.map(([key,label])=><TableCell key={key} width={110} head fontSize={text.service}>{label}</TableCell>)}<TableCell width={94} head fontSize={text.service}>{am('admin.mastered_words')}</TableCell>
        </View>
        <ScrollView style={styles.tableBody} showsVerticalScrollIndicator contentContainerStyle={styles.tableRows}>
          {filtered.map((user,index)=>{const rank=Math.max(1,Number(user.rank)||index+1);return <View key={user.user_id} style={[styles.tableRow,{height:rowHeight,minHeight:rowHeight}]}>
            <TableCell width={170} style={styles.userCell}><Pressable accessibilityRole="button" accessibilityLabel={user.nickname||am('admin.user')} onPress={()=>onOpen(user)} style={({pressed})=>[styles.userLink,pressed&&styles.userLinkPressed]}><Text style={[styles.rankLabel,{fontSize:text.service}]}>№{rank}</Text><RankMark rank={rank} fontSize={text.secondary}/><Text numberOfLines={1} style={[styles.userName,{fontSize:text.primary}]}>{user.nickname||'—'}</Text></Pressable></TableCell>
            <TableCell width={88} numeric fontSize={text.service}>{fmtDate(user.last_seen_at)}</TableCell><TableCell width={72} numeric fontSize={text.service}>{Math.max(0,Number(user.streak_days)||0)}</TableCell>{storyKeys.map(([key])=><TableCell key={key} width={110} numeric fontSize={text.service}>{storyValue(user.stories,key)}</TableCell>)}<TableCell width={94} numeric fontSize={text.service}>{Math.max(0,Number(user.mastered_words)||0)}</TableCell>
          </View>;})}
        </ScrollView>
      </View>
    </ScrollView>}
  </View>;
}
function StoryRow({label,passed,total}){const percent=total?Math.round((passed/total)*100):0;return <View style={styles.storyRow}><Text style={styles.storyLabel}>{label}</Text><View style={styles.storyTrack}><View style={[styles.storyFill,{width:`${percent}%`}]}/></View><Text style={styles.storyPercent}>{passed}/{total}</Text></View>;}

function UserDetail({userId,onOpenTest,s,am,actorId}){
  const[detail,setDetail]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[favorites,setFavorites]=useState([]),[tests,setTests]=useState([]),[pendingBlock,setPendingBlock]=useState(false),[busy,setBusy]=useState(false);
  const load=async()=>{setLoading(true);setError('');try{const [d,f,t]=await Promise.all([fetchNativeUserActivityDetail(userId),fetchNativeUserFavorites(userId),fetchNativeUserTestHistory(userId)]);setDetail(d);setFavorites(f);setTests(t);}catch(e){setError(e?.message||s('error'));}finally{setLoading(false);}};
  useEffect(()=>{void load();},[userId]);
  const blocked=detail?.account_blocked===true,isSelf=Boolean(actorId)&&actorId===userId;
  const toggleBlock=async()=>{setPendingBlock(false);setBusy(true);try{if(blocked)await unblockNativeUserAccount(userId);else await blockNativeUserAccount(userId);await load();}catch(e){setError(e?.message||s('error'));}finally{setBusy(false);}};
  if(loading)return <EmptyState>{s('loading')}</EmptyState>;
  if(error||!detail)return <EmptyState error>{error||s('error')}</EmptyState>;
  return <ScrollView contentContainerStyle={styles.scroll}>
    {!isSelf?<View style={styles.blockBar}>{blocked?<Text style={styles.blockedTag}>{am('admin.account_blocked_status')}</Text>:null}<Pressable accessibilityRole="button" accessibilityLabel={am(blocked?'admin.unblock_account':'admin.block_account')} onPress={()=>setPendingBlock(true)} disabled={busy} style={[styles.blockButton,blocked&&styles.blockButtonActive]}>{blocked?<UnlockedIcon size={16} color={C.dangerStrong}/>:<BlockIcon size={16} color={C.text2}/>}</Pressable></View>:null}
    <ScreenSection title={am('admin.user')}><MetricStrip items={[[s('streak',{count:Number(detail.streak_days)||0}),''],[String(Math.max(0,Number(detail.mastered_words)||0)),am('admin.mastered_words')],[String(Math.max(0,Number(detail.favorite_words)||0)),am('admin.favorite_words')],[fmtDate(detail.last_seen_at),am('admin.last_visit')]]}/></ScreenSection>
    <ScreenSection title={am('admin.profile_progress')}>{STORY_ORDER.map(key=>{const row=(detail.stories||[]).find(row=>row.story_type===key)||{passed:0,total:0};return <StoryRow key={key} label={key} passed={row.passed} total={row.total}/>;})}</ScreenSection>
    <ScreenSection title={am('admin.station_tests')}>{tests.length?tests.slice(0,20).map(test=><ListRow key={test.session_id} title={`${test.story_type} · ${test.station_number}`} subtitle={fmtDate(test.ended_at||test.started_at)} trailing={<MonoLabel>{Math.round(Number(test.accuracy)||0)}%</MonoLabel>} onPress={()=>onOpenTest(test.session_id)}/>):<EmptyState>{am('admin.no_tests')}</EmptyState>}</ScreenSection>
    <ScreenSection title={am('admin.favorite_words')}>{favorites.length?favorites.slice(0,20).map(w=><ListRow key={w.word_id} title={w.word_alan_cyrillic||w.word_alan_turkic||'—'}/>):<EmptyState>{am('admin.no_favorites')}</EmptyState>}</ScreenSection>
    <ConfirmDialog visible={pendingBlock} message={am(blocked?'admin.unblock_account_confirm':'admin.block_account_confirm',{nickname:detail.nickname||''})} confirmLabel={am(blocked?'admin.unblock_account':'admin.block_account')} cancelLabel={am('common.otmena')} onConfirm={toggleBlock} onCancel={()=>setPendingBlock(false)}/>
  </ScrollView>;
}
function TestDetail({sessionId,s,am}){
  const[detail,setDetail]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let alive=true;setLoading(true);fetchNativeStationTestDetail(sessionId).then(d=>{if(alive){setDetail(d);setLoading(false);}}).catch(e=>{if(alive){setError(e?.message||s('error'));setLoading(false);}});return()=>{alive=false;};},[sessionId]);
  if(loading)return <EmptyState>{s('loading')}</EmptyState>;
  if(error||!detail)return <EmptyState error>{error||s('error')}</EmptyState>;
  return <ScrollView contentContainerStyle={styles.scroll}><MetricStrip items={[[String(detail.correct_total||0),am('admin.correct_answers')],[String(detail.wrong_total||0),am('admin.wrong_answers')],[`${Math.round(Number(detail.accuracy)||0)}%`,am('admin.accuracy')]]}/>{(detail.words||[]).map((w,i)=><ListRow key={`${w.word_id}-${i}`} title={w.word_alan_cyrillic||w.word_alan_turkic||'—'} subtitle={w.translation_ru} trailing={<MonoLabel accent={w.result==='correct'}>{w.result==='correct'?'✓':'✕'}</MonoLabel>}/>)}</ScrollView>;
}


function fmtNumber(value){return new Intl.NumberFormat().format(Math.max(0,Number(value)||0));}
function monthLabel(value){const raw=String(value||'');if(!raw)return'—';try{return new Date(raw+'-01T00:00:00Z').toLocaleDateString(undefined,{month:'short',year:'2-digit',timeZone:'UTC'});}catch{return raw;}}
function AnalyticsChart({rows=[],series=[],xKey='date',monthly=false,s}){
  const list=Array.isArray(rows)?rows:[],width=720,height=210,left=34,right=10,top=14,bottom=26,innerW=width-left-right,innerH=height-top-bottom;
  if(!list.length)return <EmptyState>{s('emptySearch')}</EmptyState>;
  const max=Math.max(1,...list.flatMap(row=>series.map(item=>Number(row?.[item.key])||0)));
  const point=(row,index,key)=>({x:left+(list.length===1?innerW/2:index*innerW/(list.length-1)),y:top+innerH-((Number(row?.[key])||0)/max*innerH)});
  const linePoints=(key)=>list.map((row,index)=>{const p=point(row,index,key);return p.x.toFixed(1)+','+p.y.toFixed(1);}).join(' ');
  const palette=[C.text1,C.accent,C.success,C.warning,C.info];
  const firstLabel=monthly?monthLabel(list[0]?.[xKey]):String(list[0]?.[xKey]||'').slice(5);
  const lastLabel=monthly?monthLabel(list[list.length-1]?.[xKey]):String(list[list.length-1]?.[xKey]||'').slice(5);
  return <View style={styles.analyticsChart}><View style={styles.analyticsLegend}>{series.map((item,index)=><View key={item.key} style={styles.analyticsLegendItem}><View style={[styles.analyticsLegendLine,{backgroundColor:palette[index%palette.length]}]}/><Text style={styles.analyticsLegendText}>{item.label}</Text></View>)}</View><Svg width="100%" height={height} viewBox={'0 0 '+width+' '+height}><Line x1={left} y1={top} x2={width-right} y2={top} stroke={C.lineSoft}/><Line x1={left} y1={top+innerH/2} x2={width-right} y2={top+innerH/2} stroke={C.lineSoft}/><Line x1={left} y1={top+innerH} x2={width-right} y2={top+innerH} stroke={C.lineSoft}/>{series.map((item,index)=><React.Fragment key={item.key}><Polyline points={linePoints(item.key)} fill="none" stroke={palette[index%palette.length]} strokeWidth="2.2"/>{list.map((row,rowIndex)=>{const p=point(row,rowIndex,item.key);return <Circle key={item.key+'-'+rowIndex} cx={p.x} cy={p.y} r="3" fill={palette[index%palette.length]}/>;})}</React.Fragment>)}</Svg><View style={styles.analyticsChartLabels}><Text style={styles.analyticsChartLabel}>{firstLabel}</Text><Text style={styles.analyticsChartLabel}>{lastLabel}</Text></View></View>;
}
function UsageMetric({label,metric,actionLabel,s}){return <View style={styles.usageMetric}><Text style={styles.usageMetricLabel}>{label}</Text><Text style={styles.usageMetricValue}>{fmtNumber(metric?.people)+' '+s('usagePeopleShort')+' · '+fmtNumber(metric?.actions)+' '+actionLabel}</Text></View>;}
function UsageBlock({title,children}){return <View style={styles.usageBlock}><Text style={styles.usageBlockTitle}>{title}</Text>{children}</View>;}
function UsageSections({data,s,month,setMonth}){
  const months=Array.isArray(data?.usage_months)?data.usage_months:[];
  useEffect(()=>{if(!months.length)return;if(!month||!months.some(row=>row.month===month))setMonth(months[months.length-1]?.month||'');},[data,month,setMonth]);
  if(!months.length)return <EmptyState>{s('emptySearch')}</EmptyState>;
  const selected=months.find(row=>row.month===month)||months[months.length-1]||{};
  return <View style={styles.usageRoot}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.usageMonthScroll}><ProfileTabs items={months.map(row=>[row.month,monthLabel(row.month)])} activeId={selected.month} onChange={setMonth} style={styles.usageMonthTabs}/></ScrollView><UsageBlock title={s('usagePathUnderstanding')}><UsageMetric label={s('usageLearn')} metric={selected.understanding_learn} actionLabel={s('usageSets')} s={s}/><UsageMetric label={s('usageTests')} metric={selected.understanding_test} actionLabel={s('usageTestsCount')} s={s}/></UsageBlock><UsageBlock title={s('usagePathRoots')}><UsageMetric label={s('usageLearn')} metric={selected.roots_learn} actionLabel={s('usageSets')} s={s}/><UsageMetric label={s('usageTests')} metric={selected.roots_test} actionLabel={s('usageTestsCount')} s={s}/></UsageBlock><UsageBlock title={s('usageAshyk')}><UsageMetric label={s('usageAshykComputer')} metric={selected.ashyk_computer} actionLabel={s('usageGames')} s={s}/><UsageMetric label={s('usageAshykOnline')} metric={selected.ashyk_online} actionLabel={s('usageGames')} s={s}/></UsageBlock><UsageBlock title={s('usageSongs')}><UsageMetric label={s('usageLyrics')} metric={selected.song_lyrics} actionLabel={s('usageOpens')} s={s}/></UsageBlock></View>;
}
function VisitorAnalyticsPane({settings={}}){
  const s=(key,params)=>socialMessage(settings?.interface_language_code,key,params),[period,setPeriod]=useState(30),[usageMonth,setUsageMonth]=useState(''),[data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
  useEffect(()=>{let alive=true;setLoading(true);setError('');fetchNativeExtendedAnalytics(period).then(value=>{if(alive){setData(value||{});setLoading(false);}}).catch(e=>{if(alive){setError(e?.message||s('error'));setLoading(false);}});return()=>{alive=false;};},[period]);
  if(loading)return <View style={styles.inlineState}><EmptyState>{s('loading')}</EmptyState></View>;
  if(error)return <View style={styles.inlineState}><EmptyState error>{error}</EmptyState></View>;
  const summary=data?.summary||{};
  return <ScrollView style={styles.guestScroll} contentContainerStyle={styles.guestContent} showsVerticalScrollIndicator><View style={styles.analyticsPeriodTabs}><ProfileTabs items={[[7,s('guestPeriod7')],[30,s('guestPeriod30')],[90,s('guestPeriod90')],[0,s('guestPeriodAll')]]} activeId={period} onChange={setPeriod}/></View><ScreenSection title={s('visitorDailyTitle')}><View style={styles.analyticsHeadline}><Text style={styles.analyticsHeadlineValue}>{fmtNumber(summary.unique_visitors)}</Text><Text style={styles.analyticsHeadlineLabel}>{s('guestUniqueVisitors')}</Text></View><AnalyticsChart rows={data?.daily_visitors} series={[{key:'people',label:s('guestUniqueVisitors')}]} s={s}/></ScreenSection><ScreenSection title={s('visitorMonthlyTitle')}><AnalyticsChart monthly rows={data?.monthly_visitors} series={[{key:'d1',label:s('visitorDay1')},{key:'d3',label:s('visitorDay3')},{key:'d7',label:s('visitorDay7')},{key:'d14',label:s('visitorDay14')},{key:'d28',label:s('visitorDay28')}]} xKey="month" s={s}/></ScreenSection><ScreenSection title={s('usageTitle')}><UsageSections data={data} s={s} month={usageMonth} setMonth={setUsageMonth}/></ScreenSection></ScrollView>;
}

export function AdminUsersPane({settings={},onOpenUser}){
  const s=(key,params)=>socialMessage(settings?.interface_language_code,key,params),am=(key,params)=>msg(settings,key,params);
  const[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState(''),[statsMode,setStatsMode]=useState('users');
  useEffect(()=>{let alive=true;fetchNativeUserActivityList().then(list=>{if(alive){setRows(list);setLoading(false);}}).catch(e=>{if(alive){setError(e?.message||s('error'));setLoading(false);}});return()=>{alive=false;};},[]);
  return <View style={styles.embeddedPane}><ProfileTabs items={[["users",s('statsUsers')],["guests",s('statsVisitors')]]} activeId={statsMode} onChange={setStatsMode}/>{statsMode==='guests'?<VisitorAnalyticsPane settings={settings}/>:<><View style={styles.toolbar}><HeaderCircleButton icon={<SearchIcon size={theme.chrome.actionIconSize} color={C.text2}/>} onPress={()=>setSearchOpen(v=>!v)} accessibilityLabel={s('search')}/></View><UsersList rows={rows} loading={loading} error={error} onOpen={user=>onOpenUser?.(user)} s={s} am={am} settings={settings} searchOpen={searchOpen} query={query} onQueryChange={setQuery}/></>}</View>;
}

export function AdminUserDetailScreen({settings={},actorId,user,onBack}){
  const s=(key,params)=>socialMessage(settings?.interface_language_code,key,params),am=(key,params)=>msg(settings,key,params),[sessionId,setSessionId]=useState('');
  const userId=String(user?.user_id||'');
  const back=()=>{if(sessionId){setSessionId('');return;}onBack?.();};
  const title=sessionId?am('admin.test_result'):(user?.nickname||am('admin.user'));
  return <Screen><Header title={title} onBack={back}/><View style={styles.body}>{sessionId?<TestDetail sessionId={sessionId} s={s} am={am}/>:<UserDetail userId={userId} actorId={actorId} onOpenTest={setSessionId} s={s} am={am}/>}</View></Screen>;
}
const styles=StyleSheet.create({
  body:{flex:1,paddingTop:theme.control.header+theme.chrome.contentRestGap},
  embeddedPane:{flex:1,minHeight:0},
  toolbar:{minHeight:theme.chrome.actionSize,alignItems:'flex-end',justifyContent:'center',paddingHorizontal:theme.listTable.horizontalPadding,paddingBottom:4},
  scroll:{paddingHorizontal:14,paddingBottom:40,gap:14},
  searchBox:{marginBottom:4},
  searchInput:{minHeight:42,borderWidth:1,borderColor:C.line,borderRadius:12,paddingHorizontal:12,color:C.text1,backgroundColor:C.component},
  usersPane:{flex:1,minHeight:0},
  inlineState:{paddingHorizontal:theme.listTable.horizontalPadding,paddingTop:10},
  tableHorizontal:{flex:1,minHeight:0},
  tableHorizontalContent:{minHeight:'100%'},
  usersTable:{width:864,minHeight:'100%'},
  tableHead:{backgroundColor:C.appBg},
  tableBody:{flex:1,minHeight:0},
  tableRows:{paddingBottom:24},
  tableRow:{flexDirection:'row',alignItems:'stretch',borderBottomWidth:1,borderBottomColor:C.lineSoft,backgroundColor:'transparent'},
  tableCell:{paddingHorizontal:theme.listTable.horizontalPadding,justifyContent:'center',overflow:'hidden',backgroundColor:'transparent'},
  tableHeadCell:{height:theme.listTable.table.header,minHeight:theme.listTable.table.header},
  tableHeadText:{fontFamily:theme.font.terminal,fontWeight:'800',color:C.text2,textAlign:'center'},
  tableText:{color:C.text2,textAlign:'center'},
  tableNumber:{fontFamily:theme.font.terminal,fontWeight:'800',fontVariant:['tabular-nums']},
  userCell:{alignItems:'stretch'},
  userLink:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:5},
  userLinkPressed:{opacity:.6},
  rankLabel:{minWidth:23,fontFamily:theme.font.terminal,fontWeight:'800',color:C.text3},
  rankMedal:{width:14,textAlign:'center'},
  rankGold:{color:'#b58b23'},rankSilver:{color:'#8f969c'},rankBronze:{color:'#a8693d'},
  userName:{flex:1,minWidth:0,fontWeight:'800',color:C.text1},
  storyRow:{flexDirection:'row',alignItems:'center',gap:8,minHeight:24},
  storyLabel:{width:80,fontSize:11,color:C.text2},
  storyTrack:{flex:1,height:5,borderRadius:999,overflow:'hidden',backgroundColor:C.line},
  storyFill:{height:'100%',backgroundColor:C.accent},
  storyPercent:{width:44,textAlign:'right',fontSize:11,color:C.text2},
  blockBar:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:8,paddingTop:4},
  blockedTag:{fontSize:10,fontWeight:'800',color:C.dangerStrong,paddingHorizontal:8,paddingVertical:3,borderRadius:999,backgroundColor:C.dangerSoft},
  blockButton:{width:32,height:32,borderRadius:16,borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center',backgroundColor:C.surface0},
  blockButtonActive:{borderColor:C.dangerStrong},
  guestScroll:{flex:1,minHeight:0},
  guestContent:{paddingHorizontal:theme.listTable.horizontalPadding,paddingBottom:34,gap:12},
  analyticsPeriodTabs:{paddingTop:2,paddingBottom:4},
  analyticsHeadline:{flexDirection:'row',alignItems:'baseline',gap:8,paddingHorizontal:2,paddingBottom:4},
  analyticsHeadlineValue:{fontFamily:theme.font.terminal,fontWeight:'900',fontSize:16,color:C.text1},
  analyticsHeadlineLabel:{fontSize:10,color:C.text2},
  analyticsChart:{borderTopWidth:1,borderBottomWidth:1,borderColor:C.lineSoft,paddingTop:8,paddingBottom:6},
  analyticsLegend:{flexDirection:'row',flexWrap:'wrap',gap:10,alignItems:'center',paddingHorizontal:2,paddingBottom:4},
  analyticsLegendItem:{flexDirection:'row',alignItems:'center',gap:5},
  analyticsLegendLine:{width:13,height:2,borderRadius:999},
  analyticsLegendText:{fontSize:9,color:C.text2},
  analyticsChartLabels:{flexDirection:'row',justifyContent:'space-between',paddingHorizontal:4,marginTop:-14},
  analyticsChartLabel:{fontSize:9,color:C.text3,fontFamily:theme.font.terminal},
  usageRoot:{gap:10},
  usageMonthScroll:{paddingBottom:2},
  usageMonthTabs:{minWidth:360},
  usageBlock:{borderTopWidth:1,borderTopColor:C.lineSoft},
  usageBlockTitle:{fontSize:12,fontWeight:'800',color:C.text1,paddingVertical:9},
  usageMetric:{minHeight:42,borderBottomWidth:1,borderBottomColor:C.lineSoft,paddingVertical:7,gap:4},
  usageMetricLabel:{fontSize:11,color:C.text2},
  usageMetricValue:{fontFamily:theme.font.terminal,fontWeight:'800',fontSize:10,color:C.text1},
});
