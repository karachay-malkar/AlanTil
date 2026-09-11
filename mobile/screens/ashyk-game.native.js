import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ASHYK_GAME_RENDERER_URL } from '../../packages/alantil-core/ashyk-game.js';
import { Header, Screen } from '../ui/components.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;
const RENDERER_ORIGIN=new URL(ASHYK_GAME_RENDERER_URL).origin;

export function AshykGameScreen({onBack}){
  const allowRequest=(request)=>{
    const url=String(request?.url||'');
    if(url==='about:blank')return true;
    try{return new URL(url).origin===RENDERER_ORIGIN;}catch{return false;}
  };
  return <Screen>
    <Header title="Ашыкъ оюн" onBack={onBack}/>
    <View style={styles.content}>
      <View style={styles.surface}>
        <WebView
          source={{uri:ASHYK_GAME_RENDERER_URL}}
          originWhitelist={['https://*']}
          onShouldStartLoadWithRequest={allowRequest}
          javaScriptEnabled
          domStorageEnabled
          cacheEnabled
          allowsFullscreenVideo
          overScrollMode="never"
          startInLoadingState
          renderLoading={()=><View style={styles.loading}><ActivityIndicator color={C.accentStrong}/><Text style={styles.loadingText}>Подготовка игры…</Text></View>}
          style={styles.webView}
        />
      </View>
    </View>
  </Screen>;
}

const styles=StyleSheet.create({
  content:{flex:1,paddingTop:theme.control.header+theme.chrome.contentRestGap,paddingHorizontal:6,paddingBottom:6,backgroundColor:C.appBg},
  surface:{flex:1,overflow:'hidden',borderWidth:1,borderColor:C.lineSoft,borderRadius:theme.radius.lg,backgroundColor:'#08100d'},
  webView:{flex:1,backgroundColor:'#08100d'},
  loading:{...StyleSheet.absoluteFillObject,alignItems:'center',justifyContent:'center',gap:10,backgroundColor:C.appBg},
  loadingText:{fontSize:12,fontWeight:'700',color:C.text2},
});
