import React,{memo,useId,useMemo,useState} from 'react';
import {StyleSheet,View} from 'react-native';
import Svg,{Defs,Pattern,RadialGradient,Rect,Stop} from 'react-native-svg';
import {topographyLayers} from '../../packages/alantil-ui/topography.js';

export const Topography=memo(function Topography({opacity=.28,tileSize=420,align='center'}){
  const [width,setWidth]=useState(0),id=useId().replace(/[^a-zA-Z0-9]/g,''),layers=useMemo(()=>topographyLayers(tileSize),[tileSize]);
  return <View pointerEvents="none" onLayout={event=>setWidth(event.nativeEvent.layout.width)} style={[StyleSheet.absoluteFill,{opacity}]}>
    <Svg width="100%" height="100%">
      <Defs>
        {layers.map((layer,index)=><RadialGradient key={index} id={`${id}g${index}`} gradientUnits="userSpaceOnUse" cx={layer.cx} cy={layer.cy} fx={layer.cx} fy={layer.cy} rx={layer.rx} ry={layer.ry}>
          {layer.stops.map(([offset,alpha],stop)=><Stop key={stop} offset={offset} stopColor="#494e39" stopOpacity={alpha}/>)}
        </RadialGradient>)}
        <Pattern id={`${id}tile`} width={tileSize} height={tileSize} patternUnits="userSpaceOnUse" viewBox={`0 0 ${tileSize} ${tileSize}`} patternTransform={`translate(${align==='center'?(width-tileSize)/2:0} 0)`}>
          {layers.map((_,index)=><Rect key={index} width={tileSize} height={tileSize} fill={`url(#${id}g${index})`}/>)}
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id}tile)`}/>
    </Svg>
  </View>;
});
