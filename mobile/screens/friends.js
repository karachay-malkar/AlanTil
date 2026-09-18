import React,{useEffect,useMemo,useRef,useState}from'react';
import{Pressable,ScrollView,StyleSheet,Text,TextInput,useWindowDimensions,View}from'react-native';
import{useSafeAreaInsets}from'react-native-safe-area-context';
import{formatRating}from'../../packages/alantil-core/social.js';
import{socialMessage}from'../../packages/alantil-core/social-i18n.js';
import{CONTROL_LAYOUT}from'../../packages/alantil-ui/control-layout.js';
import{listRowHeight,listTypography}from'../../packages/alantil-ui/list-table.js';
import{createAshykOnlineAdapter}from'../../packages/ashyk-game/online.js';
import{Button,HeaderCircleButton,Screen,ScreenState}from'../ui/components.js';
import{BlockIcon,CorrectIcon,GenderIcon,PendingIcon,SearchIcon,UserMinusIcon,UserPlusIcon,WrongIcon}from'../ui/icons.js';
import{ProfileTabs}from'../ui/profile-tabs.js';
import{theme}from'../ui/theme.js';
import{nativeSupabase}from'../platform/supabase.js';
import{fetchNativeActivityAccess}from'../platform/admin.js';
import{acceptNativeFriendRequest,blockNativeUser,declineNativeFriendRequest,loadNativeFriendsSnapshot,loadNativeLeaderboard,removeNativeFriend,searchNativeUsers,sendNativeFriendRequest,unblockNativeUser}from'../platform/social.js';
import{AdminUsersPane}from'./admin-users.js';
const C=theme.colors;
const EMPTY={friends:[],incoming:[],outgoing:[],blocked:[],ashyk_invites:[],ashyk_sent:[]};
const GENDER_COLOR={male:'#3f7fd1',female:'#d0679f'};
function genderColor(gender){return GENDER_COLOR[gender==='female'?'female':'male'];}
function MedalOrRank({rank}){if(rank>=1&&rank<=3){const color=rank===1?'#c9971f':rank===2?'#9aa1ab':'#b0713b';return <Text style={[s.rank,{color}]}>●</Text>;}return <Text style={s.rank}>#{rank}</Text>;}
function IconBtn({onPress,disabled,active,children,label}){const{width}=useWindowDimensions(),size=width<=CONTROL_LAYOUT.social.compactWidth?CONTROL_LAYOUT.social.compactActionSize:CONTROL_LAYOUT.social.actionSize;return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({pressed})=>[s.iconBtn,{width:size,height:size,borderRadius:size/2},active&&s.iconBtnActive,disabled&&s.iconBtnDisabled,pressed&&!disabled&&s.iconBtnPressed]}>{children}</Pressable>}
function RelationActions({user,t,onAdd,onAccept}){if(user.relation==='accepted')return <IconBtn disabled label={t('friends')}><CorrectIcon size={16} color={C.text2}/></IconBtn>;if(user.relation==='outgoing')return <IconBtn disabled label={t('requested')}><PendingIcon size={16} color={C.text3}/></IconBtn>;if(user.relation==='incoming'){const id=user.friendship_id;return id?<View style={s.actionsRow}><IconBtn label={t('accept')} active onPress={()=>onAccept(id)}><CorrectIcon size={16} color={C.successStrong}/></IconBtn></View>:null;}return <IconBtn label={t('add')} active onPress={()=>onAdd(user.user_id)}><UserPlusIcon size={16} color={C.accentStrong}/></IconBtn>;}
function Row({rank=0,nickname,gender,rightValue,secondary,actions,rowHeight,rowType}){return <View style={[s.row,{height:rowHeight,minHeight:rowHeight}]}>{rank?<View style={s.rankWrap}><MedalOrRank rank={rank}/></View>:null}<View style={s.rowBody}><View style={s.rowName}><GenderIcon size={14} color={genderColor(gender)}/><Text numberOfLines={1} style={[s.rowNickname,{fontSize:rowType?.primary}]}>{nickname||'—'}</Text></View>{secondary?<Text style={[s.rowMeta,{fontSize:rowType?.secondary}]}>{secondary}</Text>:null}</View>{rightValue?<Text style={[s.rowValue,{fontSize:rowType?.service}]}>{rightValue}</Text>:null}<View style={s.rowActions}>{actions}</View></View>;}
function Section({title,children}){return <View style={s.section}><Text style={s.sectionTitle}>{title}</Text>{children}</View>}

export function FriendsScreen({settings={},userId='',mode='rating',onModeChange,onSignIn,onOpenAshyk,onOpenStatsUser}){
  const language=settings?.interface_language_code||'ru',t=(key,p)=>socialMessage(language,key,p),insets=useSafeAreaInsets(),bottomPadding=theme.control.nav+theme.chrome.contentRestGap+insets.bottom,rowHeight=listRowHeight(settings?.text_size_code),rowType=listTypography(settings?.text_size_code),rowVisual={rowHeight,rowType};
  const[snapshot,setSnapshot]=useState(EMPTY),[leaderboard,setLeaderboard]=useState([]),[searchOpen,setSearchOpen]=useState(false),[query,setQuery]=useState(''),[searchResults,setSearchResults]=useState(null),[busy,setBusy]=useState(''),[loading,setLoading]=useState(Boolean(userId)),[error,setError]=useState(''),[accessState,setAccessState]=useState(userId?'checking':'denied'),request=useRef(0),online=useMemo(()=>createAshykOnlineAdapter(nativeSupabase),[]);

  const refresh=async()=>{if(!userId){setSnapshot(EMPTY);setLoading(false);return;}const id=++request.current;setLoading(true);setError('');try{const next=await loadNativeFriendsSnapshot();if(id===request.current)setSnapshot(next);}catch(e){if(id===request.current)setError(e?.message||t('error'));}finally{if(id===request.current)setLoading(false);}};
  const loadRank=async()=>{if(!userId)return;setBusy('rating');try{setLeaderboard(await loadNativeLeaderboard());}catch(e){setError(e?.message||t('error'));}finally{setBusy('');}};
  const runSearch=async(value)=>{if(!userId||!value.trim()){setSearchResults(null);return;}setBusy('search');try{setSearchResults(await searchNativeUsers(value));}catch(e){setError(e?.message||t('error'));}finally{setBusy('');}};

  useEffect(()=>{void refresh();if(!userId)return undefined;let timer=null;const schedule=()=>{clearTimeout(timer);timer=setTimeout(()=>void refresh(),120);};const channel=nativeSupabase.channel(`social-mobile:${userId}:${Date.now()}`).on('postgres_changes',{event:'*',schema:'public',table:'friendships'},schedule).on('postgres_changes',{event:'*',schema:'public',table:'ashyk_invites'},schedule).subscribe();return()=>{request.current+=1;clearTimeout(timer);try{channel.unsubscribe();}catch{}try{void nativeSupabase.removeChannel(channel);}catch{}};},[userId]);
  useEffect(()=>{if(!userId){setAccessState('denied');return;}let alive=true;setAccessState('checking');fetchNativeActivityAccess(userId).then(value=>{if(!alive)return;const next=value?'allowed':'denied';setAccessState(next);if(next==='denied'&&mode==='stats')onModeChange?.('rating');}).catch(()=>{if(alive){setAccessState('denied');if(mode==='stats')onModeChange?.('rating');}});return()=>{alive=false;};},[userId]);
  useEffect(()=>{if(mode==='rating'&&!leaderboard.length)void loadRank();},[mode,userId]);
  useEffect(()=>{const timer=setTimeout(()=>void runSearch(query),280);return()=>clearTimeout(timer);},[query,userId]);

  const mutate=async(key,fn)=>{if(busy)return;setBusy(key);setError('');try{await fn();await refresh();if(mode==='rating')await loadRank();if(query)await runSearch(query);}catch(e){setError(e?.message||t('error'));}finally{setBusy('');}};
  const onAdd=(id)=>void mutate(`add:${id}`,()=>sendNativeFriendRequest(id));
  const onAccept=(friendshipId)=>void mutate(`accept:${friendshipId}`,()=>acceptNativeFriendRequest(friendshipId));

  if(!userId)return <Screen bottomNav><View style={s.guest}><Text style={s.guestTitle}>{t('community')}</Text><Text style={s.guestText}>{t('signIn')}</Text><Button role="generic.primary" onPress={onSignIn}>{t('signInAction')}</Button></View></Screen>;

  const acceptInvite=async(invite)=>{if(busy)return;setBusy(`invite:${invite.invite_id}`);try{const result=await online.acceptInvite(invite.invite_id);await refresh();if(result.room)onOpenAshyk?.(result.room,result.invite);}catch(e){setError(e?.message||t('error'));}finally{setBusy('');}};
  const declineInvite=async(invite)=>{await mutate(`decline-invite:${invite.invite_id}`,()=>online.declineInvite(invite.invite_id));};

  let content=null;
  if(mode==='friends'){
    content=<>{snapshot.ashyk_invites.length?<Section title={t('invites')}>{snapshot.ashyk_invites.map((invite)=><Row {...rowVisual} key={invite.invite_id} nickname={invite.nickname} gender={invite.avatar_gender} actions={<View style={s.actionsRow}><IconBtn label={t('accept')} active onPress={()=>acceptInvite(invite)}><CorrectIcon size={16} color={C.successStrong}/></IconBtn><IconBtn label={t('decline')} onPress={()=>declineInvite(invite)}><WrongIcon size={16} color={C.dangerStrong}/></IconBtn></View>}/>)}</Section>:null}{snapshot.incoming.length?<Section title={t('requests')}>{snapshot.incoming.map((user)=><Row {...rowVisual} key={user.friendship_id} nickname={user.nickname} gender={user.avatar_gender} actions={<View style={s.actionsRow}><IconBtn label={t('accept')} active onPress={()=>onAccept(user.friendship_id)}><CorrectIcon size={16} color={C.successStrong}/></IconBtn><IconBtn label={t('decline')} onPress={()=>void mutate(`decline:${user.friendship_id}`,()=>declineNativeFriendRequest(user.friendship_id))}><WrongIcon size={16} color={C.dangerStrong}/></IconBtn></View>}/>)}</Section>:null}<Section title={t('friends')}>{snapshot.friends.length?snapshot.friends.map((user)=><Row {...rowVisual} key={user.user_id} nickname={user.nickname} gender={user.avatar_gender} secondary={t('streak',{count:Number(user.streak_days)||0})} actions={<View style={s.actionsRow}><IconBtn label={t('remove')} onPress={()=>void mutate(`remove:${user.user_id}`,()=>removeNativeFriend(user.user_id))}><UserMinusIcon size={16} color={C.text2}/></IconBtn><IconBtn label={t('block')} onPress={()=>void mutate(`block:${user.user_id}`,()=>blockNativeUser(user.user_id))}><BlockIcon size={16} color={C.dangerStrong}/></IconBtn></View>}/>):<Text style={s.empty}>{t('emptyFriends')}</Text>}</Section>{snapshot.blocked.length?<Section title={t('blocked')}>{snapshot.blocked.map((user)=><Row {...rowVisual} key={user.user_id} nickname={user.nickname} gender={user.avatar_gender} actions={<IconBtn label={t('unblock')} active onPress={()=>void mutate(`unblock:${user.user_id}`,()=>unblockNativeUser(user.user_id))}><CorrectIcon size={16} color={C.successStrong}/></IconBtn>}/>)}</Section>:null}</>;
  }else if(mode==='rating'){
    const rows=query.trim()?searchResults:leaderboard;
    content=<Section title={t('rating')}>{busy&&!rows?.length?<ScreenState>{t('loading')}</ScreenState>:(rows||[]).length?(rows||[]).map((user,index)=><Row {...rowVisual} key={user.user_id} rank={query.trim()?0:(Number(user.rank)||index+1)} nickname={user.nickname} gender={user.avatar_gender} rightValue={formatRating(user.rating_score)} actions={user.user_id===userId?null:<RelationActions user={user} t={t} onAdd={onAdd} onAccept={onAccept}/>}/>):<Text style={s.empty}>{t(query.trim()?'emptySearch':'emptyFriends')}</Text>}</Section>;
  }

  const tabs=[['rating',t('rating')],['friends',t('friends')],['stats',t('extendedStats')]];
  const changeMode=(id)=>{setSearchOpen(false);setQuery('');if(id==='stats'&&accessState==='denied'){onModeChange?.('rating');return;}onModeChange?.(id);};
  return <Screen bottomNav><ProfileTabs items={tabs} activeId={mode} onChange={changeMode} style={s.tabs}/>{mode==='stats'?<View style={s.statsBody}>{accessState==='checking'?<ScreenState>{t('loading')}</ScreenState>:accessState==='allowed'?<AdminUsersPane settings={settings} onOpenUser={onOpenStatsUser}/>:<ScreenState>{t('loading')}</ScreenState>}</View>:<ScrollView contentContainerStyle={[s.scroll,{paddingBottom:bottomPadding}]} keyboardShouldPersistTaps="handled">{error?<Text style={s.error}>{error}</Text>:null}{mode==='rating'?<View style={s.searchBar}><HeaderCircleButton icon={<SearchIcon size={theme.chrome.actionIconSize} color={C.text2}/>} onPress={()=>{setSearchOpen(v=>!v);if(searchOpen)setQuery('');}} accessibilityLabel={t('search')}/>{searchOpen?<TextInput value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} placeholder={t('searchPlaceholder')} placeholderTextColor={C.text3} style={s.searchInput}/>:null}</View>:null}{loading&&!snapshot.friends.length&&!snapshot.incoming.length&&!snapshot.ashyk_invites.length&&mode==='friends'?<ScreenState>{t('loading')}</ScreenState>:content}</ScrollView>}</Screen>;
}
const s=StyleSheet.create({
  tabs:{position:'relative',zIndex:theme.chrome.layers.tabs,elevation:theme.chrome.layers.tabs,minHeight:theme.chrome.profileTabs.height,marginTop:theme.chrome.profileTabs.top,paddingHorizontal:theme.chrome.profileTabs.side},
  scroll:{paddingHorizontal:16,gap:14},
  statsBody:{flex:1,minHeight:0,paddingBottom:theme.control.nav+theme.chrome.contentRestGap},
  searchBar:{flexDirection:'row',alignItems:'center',gap:8},
  searchInput:{flex:1,minHeight:CONTROL_LAYOUT.social.searchHeight,borderWidth:1,borderColor:C.lineStrong,borderRadius:CONTROL_LAYOUT.social.searchRadius,paddingHorizontal:12,fontSize:14,color:C.text1,backgroundColor:'rgba(246,242,233,.58)'},
  section:{gap:2},
  sectionTitle:{fontSize:13,fontWeight:'900',color:C.text1,textTransform:'uppercase',letterSpacing:.6,marginBottom:4},
  row:{flexDirection:'row',alignItems:'center',gap:theme.listTable.gap,minHeight:CONTROL_LAYOUT.social.rowHeight,paddingVertical:4,paddingHorizontal:theme.listTable.horizontalPadding,borderBottomWidth:1,borderBottomColor:C.lineSoft,backgroundColor:'transparent'},
  rankWrap:{width:CONTROL_LAYOUT.social.rankWidth,alignItems:'center'},
  rank:{fontSize:11,fontWeight:'800',color:C.text2,fontFamily:theme.font.terminal},
  rowBody:{flex:1,minWidth:0,gap:2},
  rowName:{flexDirection:'row',alignItems:'center',gap:7},
  rowNickname:{fontSize:14,fontWeight:'700',color:C.text1,flexShrink:1},
  rowMeta:{fontSize:11,color:C.text2},
  rowValue:{fontSize:13,fontWeight:'800',color:C.text1,fontFamily:theme.font.terminal},
  rowActions:{flexDirection:'row',gap:6},
  actionsRow:{flexDirection:'row',gap:theme.listTable.gap},
  iconBtn:{borderWidth:1,borderColor:C.line,alignItems:'center',justifyContent:'center',backgroundColor:C.surface0},
  iconBtnActive:{borderColor:C.accent,backgroundColor:C.accentSoft},
  iconBtnDisabled:{opacity:.55},
  iconBtnPressed:{opacity:.75,transform:[{scale:.95}]},
  empty:{fontSize:13,lineHeight:19,color:C.text2,paddingVertical:8},
  error:{fontSize:13,color:C.danger,paddingVertical:8},
  guest:{flex:1,alignItems:'center',justifyContent:'center',padding:28,gap:16},
  guestTitle:{fontSize:28,fontWeight:'900',color:C.text1},
  guestText:{maxWidth:360,textAlign:'center',fontSize:15,lineHeight:22,color:C.text2},
});
