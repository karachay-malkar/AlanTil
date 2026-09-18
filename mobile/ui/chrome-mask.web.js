import React from 'react';
import { View } from 'react-native';
import { theme } from './theme.js';
const C=theme.colors,CH=theme.chrome;
const rgba=(hex,alpha)=>{const raw=String(hex||'').replace('#','');if(raw.length!==6)return `rgba(238,233,223,${alpha})`;const n=parseInt(raw,16);return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${alpha})`;};
export function ChromeMask({edge,height}){const bottom=edge==='bottom',mask=bottom?CH.mask.web.bottom:CH.mask.web.top,blur=`blur(${CH.mask.blur}px) saturate(1.02)`;return <View pointerEvents="none" style={{position:'absolute',zIndex:CH.layers.mask,elevation:CH.layers.mask,left:0,right:0,[bottom?'bottom':'top']:0,height,backgroundColor:rgba(C.appBg,CH.mask.glassAlpha),backdropFilter:blur,WebkitBackdropFilter:blur,maskImage:mask,WebkitMaskImage:mask}}/>}
