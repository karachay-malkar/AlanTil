import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import { theme } from './theme.js';

const C=theme.colors,CH=theme.chrome;
function gradientStops(edge){if(edge!=='bottom')return CH.maskStops;return CH.maskStops.map((stop)=>({offset:1-stop.offset,alpha:stop.alpha})).sort((a,b)=>a.offset-b.offset)}
function MaskGradient({edge}){const stops=gradientStops(edge);return <Svg width="100%" height="100%" preserveAspectRatio="none"><Defs><LinearGradient id="chromeMask" x1="0" y1="0" x2="0" y2="1">{stops.map((stop,index)=><Stop key={index} offset={`${stop.offset*100}%`} stopColor="#fff" stopOpacity={stop.alpha}/>)}</LinearGradient></Defs><Rect width="100%" height="100%" fill="url(#chromeMask)"/></Svg>}
export function ChromeMask({edge,height}){const bottom=edge==='bottom';return <View pointerEvents="none" style={[styles.mask,bottom?styles.bottom:styles.top,{height}]}><MaskedView pointerEvents="none" style={StyleSheet.absoluteFill} maskElement={<MaskGradient edge={edge}/>}><BlurView pointerEvents="none" intensity={CH.nativeBlurIntensity} tint="light" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill}/><View pointerEvents="none" style={[StyleSheet.absoluteFill,{backgroundColor:C.maskGlass}]}/></MaskedView></View>}
const styles=StyleSheet.create({mask:{position:'absolute',zIndex:29,elevation:29,left:0,right:0,overflow:'hidden'},top:{top:0},bottom:{bottom:0}});
