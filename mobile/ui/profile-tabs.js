import React from'react';
import{Pressable,StyleSheet,Text,View}from'react-native';
import{theme}from'./theme.js';
const C=theme.colors;

export function ProfileTabs({items=[],activeId='',onChange,textSize,style}){
  return <View style={[styles.tabs,style]}>{items.map(([id,label])=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:activeId===id}} onPress={()=>onChange?.(id)} style={({pressed})=>[styles.profileTab,pressed&&styles.profileTabPressed]}><Text numberOfLines={1} style={[styles.profileTabText,textSize?{fontSize:textSize}:null,activeId===id&&styles.profileTabActive]}>{`[ ${label} ]`}</Text></Pressable>)}</View>;
}

const styles=StyleSheet.create({
  tabs:{flexDirection:'row',alignItems:'center',gap:theme.chrome.profileTabs.gap},
  profileTab:{flex:1,minHeight:30,paddingHorizontal:4,alignItems:'center',justifyContent:'center'},
  profileTabText:{fontFamily:theme.font.terminal,fontSize:10,fontWeight:'750',lineHeight:11,color:C.text3,textAlign:'center'},
  profileTabActive:{color:C.text1,fontWeight:'900'},
  profileTabPressed:{opacity:.68},
});
