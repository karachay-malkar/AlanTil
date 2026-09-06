import React from 'react';
import{ScrollView}from'react-native';
export function FadedScrollView({topFade=0,bottomFade=0,style,...props}){const mask=`linear-gradient(to bottom,transparent 0,#000 ${Math.max(0,topFade)}px,#000 calc(100% - ${Math.max(0,bottomFade)}px),transparent 100%)`;return <ScrollView {...props} style={[style,{maskImage:mask,WebkitMaskImage:mask}]}/>;}
