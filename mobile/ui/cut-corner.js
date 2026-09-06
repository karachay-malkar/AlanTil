import React,{useState}from'react';
import{StyleSheet,View}from'react-native';
import Svg,{Path}from'react-native-svg';

export function CutCornerFrame({fill='transparent',stroke='transparent',strokeWidth=1,cut=7,radius=14,inset=0,style}){
  const[size,setSize]=useState({width:0,height:0});
  const w=Math.max(0,size.width-inset*2),h=Math.max(0,size.height-inset*2),c=Math.max(0,Math.min(cut,w/2,h/2)),r=Math.max(0,Math.min(radius,w/2,h/2));
  const d=`M ${c} 0 L ${Math.max(c,w-r)} 0 Q ${w} 0 ${w} ${r} L ${w} ${Math.max(r,h-c)} L ${Math.max(0,w-c)} ${h} L ${r} ${h} Q 0 ${h} 0 ${Math.max(0,h-r)} L 0 ${c} Z`;
  return <View pointerEvents="none" onLayout={event=>setSize(event.nativeEvent.layout)} style={[StyleSheet.absoluteFill,style]}>{w>0&&h>0?<Svg width={w} height={h} style={{position:'absolute',left:inset,top:inset}}><Path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth}/></Svg>:null}</View>;
}
