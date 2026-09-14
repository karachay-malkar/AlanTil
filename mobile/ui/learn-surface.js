import React,{useId,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import Svg,{Defs,LinearGradient,Rect,Stop} from 'react-native-svg';
import {LEARN_SURFACE,cssGradientLine} from '../../packages/alantil-ui/learn-surface.js';
let lastMeasuredSize={width:560,height:620};
export function LearnSurface(){
 const id='learn'+useId().replace(/[^a-zA-Z0-9]/g,''),[size,setSize]=useState(lastMeasuredSize),safe={width:Math.max(1,size.width||lastMeasuredSize.width),height:Math.max(1,size.height||lastMeasuredSize.height)};
 return <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={event=>{const {width,height}=event.nativeEvent.layout;if(!width||!height)return;const next={width,height};lastMeasuredSize=next;setSize(current=>current.width===width&&current.height===height?current:next);}}>
  <Svg width="100%" height="100%" viewBox={`0 0 ${safe.width} ${safe.height}`} preserveAspectRatio="none"><Defs><LinearGradient id={id} gradientUnits="userSpaceOnUse" {...cssGradientLine(safe.width,safe.height)}><Stop offset="0" stopColor={LEARN_SURFACE.start} stopOpacity={LEARN_SURFACE.startOpacity}/><Stop offset="1" stopColor={LEARN_SURFACE.end} stopOpacity={LEARN_SURFACE.endOpacity}/></LinearGradient></Defs><Rect width={safe.width} height={safe.height} fill={`url(#${id})`}/></Svg>
 </View>;
}
