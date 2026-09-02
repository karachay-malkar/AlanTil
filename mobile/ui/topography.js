import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Ellipse } from 'react-native-svg';

export function Topography({ opacity = 0.28 }) {
  const rings = [
    [72,78,46,31],[72,78,63,43],[72,78,82,57],
    [320,250,62,46],[320,250,89,67],[320,250,118,89],
    [210,540,94,61],[210,540,126,82],[210,540,160,105],
  ];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill,{opacity}]}>
      <Svg width="100%" height="100%" viewBox="0 0 420 760" preserveAspectRatio="xMidYMid slice">
        {rings.map(([cx,cy,rx,ry],index)=><Ellipse key={index} cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke="rgba(73,78,57,0.22)" strokeWidth="1" />)}
      </Svg>
    </View>
  );
}
