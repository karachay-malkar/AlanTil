import React from'react';
import{Pressable,StyleSheet,Text,View}from'react-native';
import{useSemanticTypography}from'./runtime-settings.js';
import{theme}from'./theme.js';
const C=theme.colors,T=theme.chrome.profileTabs;

export function ProfileTabs({items=[],activeId='',onChange,style}){
  const type=useSemanticTypography();
  return <View style={[styles.tabs,style]}>{items.map(([id,label])=><Pressable key={id} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{selected:activeId===id}} onPress={()=>onChange?.(id)} style={({pressed})=>[styles.profileTab,pressed&&styles.profileTabPressed]}><Text numberOfLines={1} style={[styles.profileTabText,{fontSize:type.caption.fontSize,lineHeight:type.caption.lineHeight},activeId===id&&styles.profileTabActive]}>{`[ ${label} ]`}</Text></Pressable>)}</View>;
}

const styles=StyleSheet.create({
  tabs:{flexDirection:'row',alignItems:'center',gap:T.gap},
  profileTab:{flex:1,minHeight:T.itemMinHeight,paddingHorizontal:T.itemPaddingHorizontal,alignItems:'center',justifyContent:'center'},
  profileTabText:{fontFamily:theme.font.terminal,fontWeight:'750',color:C.text3,textAlign:'center'},
  profileTabActive:{color:C.text1,fontWeight:'900'},
  profileTabPressed:{opacity:.68},
});
