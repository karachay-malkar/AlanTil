import React,{useState}from'react';
import{StyleSheet,View}from'react-native';
import Svg,{Polygon}from'react-native-svg';

export function CutCornerFrame({fill='transparent',stroke='transparent',strokeWidth=1,cut=7,inset=0,style}){
  const[size,setSize]=useState({width:0,height:0});
  const w=Math.max(0,size.width-inset*2),h=Math.max(0,size.height-inset*2),c=Math.max(0,Math.min(cut,w/2,h/2));
  const points=`${c},0 ${w},0 ${w},${Math.max(0,h-c)} ${Math.max(0,w-c)},${h} 0,${h} 0,${c}`;
  return <View pointerEvents="none" onLayout={event=>setSize(event.nativeEvent.layout)} style={[StyleSheet.absoluteFill,style]}>{w>0&&h>0?<Svg width={w} height={h} style={{position:'absolute',left:inset,top:inset}}><Polygon points={points} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/></Svg>:null}</View>;
}
