import React from 'react';
import { View } from 'react-native';
import { theme } from './theme.js';
const C=theme.colors,CH=theme.chrome;
export function ChromeMask({edge,height}){const bottom=edge==='bottom',mask=bottom?CH.webMaskBottom:CH.webMaskTop,blur=`blur(${CH.blur}px) saturate(1.02)`;return <View pointerEvents="none" style={{position:'absolute',zIndex:29,elevation:29,left:0,right:0,[bottom?'bottom':'top']:0,height,backgroundColor:C.maskGlass,backdropFilter:blur,WebkitBackdropFilter:blur,maskImage:mask,WebkitMaskImage:mask}}/>}
