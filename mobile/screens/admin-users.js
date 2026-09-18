import React,{useEffect,useMemo,useState}from'react';
import{Pressable,ScrollView,StyleSheet,Text,TextInput,View}from'react-native';
import{socialMessage}from'../../packages/alantil-core/social-i18n.js';
import{listRowHeight,listTypography}from'../../packages/alantil-ui/list-table.js';
import{msg}from'../i18n.js';
import{Header,HeaderCircleButton,Screen}from'../ui/components.js';
import{ConfirmDialog}from'../ui/modal.js';
import{EmptyState,ListRow,MetricStrip,MonoLabel,ScreenSection}from'../ui/parity.js';
import{BlockIcon,SearchIcon,UnlockedIcon}from'../ui/icons.js';
import{theme}from'../ui/theme.js';
import{blockNativeUserAccount,fetchNativeStationTestDetail,fetchNativeUserActivityDetail,fetchNativeUserActivityList,fetchNativeUserFavorites,fetchNativeUserTestHistory,unblockNativeUserAccount}from'../platform/admin.js';
const C=theme.colors;
const STORY_ORDER=['oblivion','roots','ascent','pathways'];
function fmtDate(value){if(!value)return'—';try{return new Date(value).toLocaleDateString();}catch{return'—';}}
function storyValue(stories,key){const value=stories?.[key]||{};return `${Math.max(0,Number(value.passed)||0)} / ${Math.max(0,Number(value.total)||0)}`;}
function RankMark({rank}){if(rank>=1&&rank<=3)return <Text style={[styles.rankMedal,rank===1&&styles.rankGold,rank===2&&styles.rankSilver,rank===3&&styles.rankBronze]}>●</Text>;return null;}
function TableCell({children,width,head=false,numeric=false,style}){return <View style={[styles.tableCell,{width,minWidth:width},head&&styles.tableHeadCell,style]}>{typeof children==='string'||typeof children==='number'?<Text numberOfLines={head?2:1} style={[head?styles.tableHeadText:styles.tableText,numeric&&styles.tableNumber]}>{children}</Text>:children}</View>;}
function UsersList({rows,loading,error,onOpen,s,am,settings,searchOpen,query,onQueryChange}){
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(r=>String(r.nickname||'').toLowerCase().includes(q));},[rows,query]),rowHeight=listRowHeight(settings?.text_size_code),text=listTypography(settings?.text_size_code);
  const storyKeys=[['oblivion',am('admin.story_oblivion')],['roots',am('admin.story_roots')],['ascent',am('admin.story_ascent')],['pathways',am('admin.story_pathways')]];
  return <View style={styles.usersPane}>
    {searchOpen?<View style={styles.searchBox}><TextInput value={query} onChangeText={onQueryChange} autoCapitalize="none" autoCorrect={false} placeholder={s('searchPlaceholder')} placeholderTextColor={C.text3} style={styles.searchInput}/></View>:null}
    {loading?<View style={styles.inlineState}><EmptyState>{s('loading')}</EmptyState></View>:error?<View style={styles.inlineState}><EmptyState>{error}</EmptyState></View>:!filtered.length?<View style={styles.inlineState}><EmptyState>{s('emptySearch')}</EmptyState></View>:<ScrollView horizontal style={styles.tableHorizontal} contentContainerStyle={styles.tableHorizontalContent} showsHorizontalScrollIndicator>
      <View style={styles.usersTable}>
        <View style={[styles.tableRow,styles.tableHead,{height:theme.listTable.table.header,minHeight:theme.listTable.table.header}]}>
          <TableCell width={170} head style={styles.userCell}>{am('admin.user')}</TableCell><TableCell width={88} head>{am('admin.last_visit')}</TableCell><TableCell width={72} head>{am('admin.streak')}</TableCell>{storyKeys.map(([key,label])=><TableCell key={key} width={110} head>{label}</TableCell>)}<TableCell width={94} head>{am('admin.mastered_words')}</TableCell>
        </View>
        <ScrollView style={styles.tableBody} showsVerticalScrollIndicator contentContainerStyle={styles.tableRows}>
          {filtered.map((user,index)=>{const rank=Math.max(1,Number(user.rank)||index+1);return <View key={user.user_id} style={[styles.tableRow,{height:rowHeight,minHeight:rowHeight}]}>
            <TableCell width={170} style={styles.userCell}><Pressable accessibilityRole="button" onPress={()=>onOpen(user.user_id)} style={({pressed})=>[styles.userLink,pressed&&styles.userLinkPressed]}><Text style={styles.rankLabel}>№{rank}</Text><RankMark rank={rank}/><Text numberOfLines={1} style={[styles.userName,{fontSize:text.primary}]}>{user.nickname||'—'}</Text></Pressable></TableCell>
            <TableCell width={88} numeric>{fmtDate(user.last_seen_at)}</TableCell><TableCell width={72} numeric>{Math.max(0,Number(user.streak_days)||0)}</TableCell>{storyKeys.map(([key])=><TableCell key={key} width={110} numeric>{storyValue(user.stories,key)}</TableCell>)}<TableCell width={94} numeric>{Math.max(0,Number(user.mastered_words)||0)}</TableCell>
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
    {!isSelf?<View style={styles.blockBar}>
      {blocked?<Text style={styles.blockedTag}>{am('admin.account_blocked_status')}</Text>:null}
      <Pressable accessibilityRole="button" accessibilityLabel={am(blocked?'admin.unblock_account':'admin.block_account')} onPress={()=>setPendingBlock(true)} disabled={busy} style={[styles.blockButton,blocked&&styles.blockButtonActive]}>
        {blocked?<UnlockedIcon size={16} color={C.dangerStrong}/>:<BlockIcon size={16} color={C.text2}/>}
      </Pressable>
    </View>:null}
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
  return <ScrollView contentContainerStyle={styles.scroll}>
    <MetricStrip items={[[String(detail.correct_total||0),am('admin.correct_answers')],[String(detail.wrong_total||0),am('admin.wrong_answers')],[`${Math.round(Number(detail.accuracy)||0)}%`,am('admin.accuracy')]]}/>
    {(detail.words||[]).map((w,i)=><ListRow key={`${w.word_id}-${i}`} title={w.word_alan_cyrillic||w.word_alan_turkic||'—'} subtitle={w.translation_ru} trailing={<MonoLabel accent={w.result==='correct'}>{w.result==='correct'?'✓':'✕'}</MonoLabel>}/>)}
  </ScrollView>;
}

export function AdminUsersPane({settings={},actorId,onBack}){
  const s=(key,params)=>socialMessage(settings?.interface_language_code,key,params),am=(key,params)=>msg(settings,key,params);
  const[view,setView]=useState('list'),[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[userId,setUserId]=useState(''),[sessionId,setSessionId]=useState(''),[searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState('');
  useEffect(()=>{let alive=true;fetchNativeUserActivityList().then(list=>{if(alive){setRows(list);setLoading(false);}}).catch(e=>{if(alive){setError(e?.message||s('error'));setLoading(false);}});return()=>{alive=false;};},[]);
  const back=()=>{if(view==='test'){setView('detail');return;}if(view==='detail'){setView('list');setUserId('');return;}onBack?.();};
  const title=view==='list'?am('admin.users'):view==='detail'?(rows.find(r=>r.user_id===userId)?.nickname||am('admin.user')):am('admin.test_result');
  return <Screen><Header title={title} onBack={back} trailing={view==='list'?<HeaderCircleButton icon={<SearchIcon size={18} color={C.text2}/>} onPress={()=>setSearchOpen(v=>!v)} accessibilityLabel={s('search')}/>:null}/>
    <View style={styles.body}>
      {view==='list'?<UsersList rows={rows} loading={loading} error={error} onOpen={id=>{setUserId(id);setView('detail');}} s={s} am={am} settings={settings} searchOpen={searchOpen} query={query} onQueryChange={setQuery}/>:null}
      {view==='detail'?<UserDetail userId={userId} actorId={actorId} onOpenTest={id=>{setSessionId(id);setView('test');}} s={s} am={am}/>:null}
      {view==='test'?<TestDetail sessionId={sessionId} s={s} am={am}/>:null}
    </View>
  </Screen>;
}
const styles=StyleSheet.create({
  body:{flex:1,paddingTop:theme.control.header+theme.chrome.contentRestGap},
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
  tableHeadText:{fontFamily:theme.font.terminal,fontSize:10,fontWeight:'800',lineHeight:11,color:C.text2,textAlign:'center'},
  tableText:{fontSize:12,color:C.text2,textAlign:'center'},
  tableNumber:{fontFamily:theme.font.terminal,fontSize:10,fontWeight:'800',fontVariant:['tabular-nums']},
  userCell:{alignItems:'stretch'},
  userLink:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',gap:5},
  userLinkPressed:{opacity:.6},
  rankLabel:{minWidth:23,fontFamily:theme.font.terminal,fontSize:9,fontWeight:'800',color:C.text3},
  rankMedal:{width:14,fontSize:12,textAlign:'center'},
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
});
