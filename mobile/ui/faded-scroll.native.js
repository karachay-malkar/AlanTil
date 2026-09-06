import React from 'react';
import{ScrollView,StyleSheet,useWindowDimensions}from'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg,{Defs,LinearGradient,Rect,Stop}from'react-native-svg';
function FadeMask({topFade,bottomFade,height}){const top=Math.max(0,Math.min(.49,topFade/Math.max(1,height))),bottom=Math.max(.51,Math.min(1,1-bottomFade/Math.max(1,height)));return <Svg width="100%" height="100%" preserveAspectRatio="none"><Defs><LinearGradient id="scrollFade" x1="0" y1="0" x2="0" y2="1"><Stop offset="0%" stopColor="#000" stopOpacity="0"/><Stop offset={`${top*100}%`} stopColor="#000" stopOpacity="1"/><Stop offset={`${bottom*100}%`} stopColor="#000" stopOpacity="1"/><Stop offset="100%" stopColor="#000" stopOpacity="0"/></LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#scrollFade)"/></Svg>}
export function FadedScrollView({topFade=0,bottomFade=0,style,...props}){const{height}=useWindowDimensions();return <MaskedView style={[styles.mask,style]} maskElement={<FadeMask topFade={topFade} bottomFade={bottomFade} height={height}/> }><ScrollView {...props} style={styles.scroll}/></MaskedView>}
const styles=StyleSheet.create({mask:{flex:1},scroll:{flex:1}});
