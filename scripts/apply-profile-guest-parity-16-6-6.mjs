import fs from 'node:fs';
import assert from 'node:assert/strict';

const file='mobile/screens/profile-main.js';
let source=fs.readFileSync(file,'utf8');
if(source.includes("lockedState:{width:'100%',maxWidth:430")){
  console.log('16.6.6 Profile guest parity already applied');
  process.exit(0);
}
const replace=(before,after,label)=>{
  assert.ok(source.includes(before),`Profile guest parity source mismatch: ${label}`);
  source=source.replace(before,after);
};
replace(
  "import{Image,Pressable,StyleSheet,Text,TextInput,View}from'react-native';",
  "import{Image,Pressable,StyleSheet,Text,TextInput,View}from'react-native';\nimport Svg,{Circle,Path}from'react-native-svg';",
  'react-native-svg import',
);
replace(
  `function AvatarFigure({gender,locked=false}){return <View style={styles.avatarVisual}><Image source={gender==='female'?PROFILE_AVATAR_FEMALE:PROFILE_AVATAR_MALE} resizeMode="contain" style={[styles.avatarImage,locked&&styles.avatarLocked]}/>{locked?<View style={styles.avatarLock}><LockedIcon size={24} color={C.text2}/></View>:null}</View>}`,
  `function AvatarFigure({gender,locked=false}){const generic=locked&&!gender;return <View style={styles.avatarVisual}>{generic?<Svg viewBox="0 0 180 230" style={styles.avatarSvg}><Circle cx="90" cy="64" r="44" fill={C.text2}/><Path d="M25 217c2-69 25-108 65-108s63 39 65 108z" fill={C.text2}/><Path d="M55 31c10-13 22-19 36-19 17 0 30 8 39 23-22-8-47-9-75-4z" fill={C.appBgDeep} stroke={C.text3} strokeWidth="2"/></Svg>:<Image source={gender==='female'?PROFILE_AVATAR_FEMALE:PROFILE_AVATAR_MALE} resizeMode="contain" style={[styles.avatarImage,locked&&styles.avatarLocked]}/>} {locked?<View pointerEvents="none" style={styles.avatarLock}><LockedIcon size={42} color={C.text1}/></View>:null}</View>}`,
  'locked avatar figure',
);
replace(
  `if(guest)return <FadedScrollView topFade={theme.chrome.scrollFades.profile.top} bottomFade={bottomPadding} contentContainerStyle={[styles.scroll,{paddingTop:theme.chrome.scrollFades.profile.top,paddingBottom:bottomPadding}]} showsVerticalScrollIndicator={false}><View style={styles.identity}><View style={[styles.avatarFrame,styles.avatarFrameLocked]}><MonoLabel style={styles.avatarStatus}>{m('mobile.profile.title').toUpperCase()}</MonoLabel><AvatarFigure locked/><Pressable accessibilityRole="button" accessibilityLabel={m('mobile.profile.account')} onPress={onAccount} style={({pressed})=>[styles.accountCircle,pressed&&styles.storyPressed]}><ProfileIcon size={20} color={C.text1}/></Pressable></View><Text style={[styles.nickname,type.title]}>{m('mobile.profile.unavailable')}</Text><Text style={[styles.guestExplain,type.caption]}>{m('mobile.profile.signin_hint')}</Text><Button role="profile.guestAccount" style={styles.guestAction} onPress={onAccount}>{m('mobile.profile.signin')}</Button></View></FadedScrollView>;`,
  `if(guest)return <FadedScrollView topFade={theme.chrome.scrollFades.profile.top} bottomFade={bottomPadding} contentContainerStyle={[styles.scroll,styles.lockedScroll,{paddingTop:theme.chrome.scrollFades.profile.top,paddingBottom:bottomPadding}]} showsVerticalScrollIndicator={false}><View style={styles.lockedState}><View style={[styles.avatarFrame,styles.avatarFrameLocked]}><MonoLabel style={styles.avatarStatus}>{m('mobile.profile.title').toUpperCase()}</MonoLabel><AvatarFigure locked/><Pressable accessibilityRole="button" accessibilityLabel={m('mobile.profile.account')} onPress={onAccount} style={({pressed})=>[styles.accountCircle,pressed&&styles.storyPressed]}><ProfileIcon size={20} color={C.text1}/></Pressable></View><Text style={[type.emphasis,styles.guestHeading]}>{m('mobile.profile.unavailable')}</Text><Text style={[type.caption,styles.guestExplain]}>{m('mobile.profile.signin_hint')}</Text><Button role="profile.guestAccount" style={styles.guestAction} onPress={onAccount}>{m('mobile.profile.signin')}</Button></View></FadedScrollView>;`,
  'locked profile structure',
);
replace(
  `scroll:{width:'100%',maxWidth:520,alignSelf:'center',paddingTop:10,paddingHorizontal:2,paddingBottom:28,gap:20},identity:{width:'100%',alignItems:'center'},avatarFrame:{position:'relative',width:'72%',maxWidth:286,aspectRatio:.8,marginTop:6,borderWidth:1,borderColor:C.lineStrong,borderRadius:2,backgroundColor:C.paperSoft,alignItems:'center',justifyContent:'flex-end',overflow:'visible'},avatarFrameLocked:{borderColor:C.line},avatarStatus:{position:'absolute',left:9,top:8,letterSpacing:1.4},avatarVisual:{width:'100%',height:'100%',alignItems:'center',justifyContent:'flex-end'},avatarImage:{width:'82%',height:'90%'},avatarLocked:{opacity:.28},avatarLock:{position:'absolute',left:'50%',top:'46%',width:46,height:46,marginLeft:-23,marginTop:-23,borderWidth:1,borderColor:C.lineStrong,borderRadius:23,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center'},`,
  `scroll:{width:'100%',maxWidth:520,alignSelf:'center',paddingTop:10,paddingHorizontal:2,paddingBottom:28,gap:20},lockedScroll:{flexGrow:1,justifyContent:'center',gap:0},lockedState:{width:'100%',maxWidth:430,alignSelf:'center',alignItems:'center',justifyContent:'center',gap:9},identity:{width:'100%',alignItems:'center'},avatarFrame:{position:'relative',width:'72%',maxWidth:286,aspectRatio:.8,marginTop:6,borderWidth:1,borderColor:C.lineStrong,borderRadius:2,backgroundColor:C.paperSoft,alignItems:'center',justifyContent:'flex-end',overflow:'visible'},avatarFrameLocked:{width:'58%',maxWidth:218,marginBottom:8,borderColor:C.line,opacity:.72},avatarStatus:{position:'absolute',left:9,top:8,letterSpacing:1.4},avatarVisual:{width:'100%',height:'100%',alignItems:'center',justifyContent:'flex-end'},avatarSvg:{width:'82%',height:'90%'},avatarImage:{width:'82%',height:'90%'},avatarLocked:{opacity:.72},avatarLock:{position:'absolute',left:0,right:0,top:0,bottom:0,alignItems:'center',justifyContent:'center'},`,
  'locked profile geometry',
);
replace(
  `nickname:{marginTop:11,color:C.text1,textAlign:'center'},guestExplain:{maxWidth:320,marginTop:8,color:C.text2,textAlign:'center'},guestAction:{width:190,marginTop:14},`,
  `nickname:{marginTop:11,color:C.text1,textAlign:'center'},guestHeading:{color:C.text1,fontSize:19,fontWeight:'800',lineHeight:23,textAlign:'center'},guestExplain:{maxWidth:320,color:C.text2,fontSize:13,lineHeight:18.85,textAlign:'center'},guestAction:{minWidth:150,marginTop:5},`,
  'locked profile copy/action geometry',
);
fs.writeFileSync(file,source);
console.log('16.6.6 Profile guest parity correction applied');
