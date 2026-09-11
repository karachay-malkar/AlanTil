import React,{useId,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {LEARN_SURFACE,cssGradientLine} from '../../packages/alantil-ui/learn-surface.js';
export function LearnSurface(){
 const id='learn'+useId().replace(/[^a-zA-Z0-9]/g,''),[size,setSize]=useState({width:0,height:0});
 return <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={event=>{const {width,height}=event.nativeEvent.layout;setSize(current=>current.width===width&&current.height===height?current:{width,height});}}>
  {size.width>0&&size.height>0?<Svg width={size.width} height={size.height}><Defs><LinearGradient id={id} gradientUnits="userSpaceOnUse" {...cssGradientLine(size.width,size.height)}><Stop offset="0" stopColor={LEARN_SURFACE.start} stopOpacity={LEARN_SURFACE.startOpacity}/><Stop offset="1" stopColor={LEARN_SURFACE.end} stopOpacity={LEARN_SURFACE.endOpacity}/></LinearGradient></Defs><Rect width={size.width} height={size.height} fill={`url(#${id})`}/></Svg>:null}
 </View>;
}
