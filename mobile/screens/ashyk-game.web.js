import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ASHYK_GAME_RENDERER_URL } from '../../packages/alantil-core/ashyk-game.js';
import { Header, Screen } from '../ui/components.js';
import { theme } from '../ui/theme.js';

export function AshykGameScreen({onBack}){
  return <Screen>
    <Header title="Ашыкъ оюн" onBack={onBack}/>
    <View style={styles.content}>
      <View style={styles.surface}>
        {React.createElement('iframe',{
          title:'Ашыкъ оюн',
          src:ASHYK_GAME_RENDERER_URL,
          allow:'fullscreen; gamepad',
          referrerPolicy:'strict-origin-when-cross-origin',
          style:{display:'block',width:'100%',height:'100%',border:0,background:'#08100d'},
        })}
      </View>
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  content:{flex:1,paddingTop:theme.control.header+theme.chrome.contentRestGap,paddingHorizontal:6,paddingBottom:6,backgroundColor:theme.colors.appBg},
  surface:{flex:1,overflow:'hidden',borderWidth:1,borderColor:theme.colors.lineSoft,borderRadius:theme.radius.lg,backgroundColor:'#08100d'},
});
