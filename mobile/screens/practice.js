import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Header, Screen } from '../ui/components.js';
import { FavoriteIcon, ListChecksIcon, MusicIcon, PracticeIcon, PuzzleIcon } from '../ui/icons.js';
import { ListRow } from '../ui/parity.js';
import { getNativeAuthSession, subscribeNativeAuth } from '../platform/auth.js';
import { getNativeDictionarySnapshot } from '../platform/dictionary.js';
import { msg } from '../i18n.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;
const ASHYK_GAME_ASSET=require('../assets/ashyk-game/index.html');

function publicGameSession(session){
  if(!session?.access_token||!session?.refresh_token||!session?.user?.id)return null;
  return{access_token:session.access_token,refresh_token:session.refresh_token,user:{id:session.user.id}};
}

function ashykDictionaryWords(){
  const words=getNativeDictionarySnapshot()?.words||[];
  const seen=new Set();
  return words.flatMap((word)=>{
    const dictionaryId=String(word?.dictionary_id||word?.dictionaryId||'').trim();
    const storyId=String(word?.story_id||word?.storyId||'').trim();
    const id=String(word?.id||word?.word_id||'').trim();
    const alan=String(word?.word||word?.wordAlanCyrillic||'').trim();
    const trans=String(word?.trans||word?.translationRu||'').trim();
    const pos=String(word?.pos||'').trim().toLowerCase();
    if(dictionaryId!=='intermediate'||storyId!=='roots'||word?.usedInTest!==true||!id||!alan||!trans||!pos||seen.has(id))return[];
    seen.add(id);
    return[{id,word:alan,trans,pos,synonyms:Array.isArray(word?.synonyms)?word.synonyms:[]}];
  });
}

export function PracticeScreen({settings={},openTest,openMatch,openFavorites,openSongs}){
  const m=(key,params)=>msg(settings,key,params),insets=useSafeAreaInsets(),rowProps={style:styles.menuRow,titleStyle:styles.menuTitle,subtitleStyle:styles.menuSubtitle,leadingStyle:styles.menuLeading};
  const [gameOpen,setGameOpen]=useState(false),[gameUri,setGameUri]=useState(''),[gameError,setGameError]=useState(''),[authSession,setAuthSession]=useState(()=>getNativeAuthSession());
  const gameRef=useRef(null);

  const postAuth=(session=authSession)=>{
    gameRef.current?.postMessage(JSON.stringify({type:'alantil-auth',session:publicGameSession(session)}));
  };
  const postDictionary=()=>{
    gameRef.current?.postMessage(JSON.stringify({type:'alantil-dictionary',words:ashykDictionaryWords()}));
  };

  useEffect(()=>subscribeNativeAuth((session)=>{setAuthSession(session||null);if(gameOpen)postAuth(session||null);}),[gameOpen]);

  const openGame=async()=>{
    setGameOpen(true);setGameError('');setGameUri('');
    try{
      const asset=Asset.fromModule(ASHYK_GAME_ASSET);
      if(!asset.localUri)await asset.downloadAsync();
      const uri=asset.localUri||asset.uri||'';
      if(!uri)throw new Error('Local Ashyk asset is unavailable');
      setGameUri(uri);
    }catch{setGameError('Не удалось открыть локальный модуль Ашыкъ оюн.');}
  };

  const closeGame=()=>{setGameOpen(false);setGameUri('');setGameError('');};
  const onGameMessage=(event)=>{
    try{
      const payload=JSON.parse(event?.nativeEvent?.data||'{}');
      if(payload?.type==='ashyk-auth-request')postAuth();
      if(payload?.type==='ashyk-dictionary-request')postDictionary();
    }catch{}
  };

  return <>
    <Screen bottomNav><ScrollView contentContainerStyle={[styles.scroll,{paddingBottom:theme.control.nav+theme.chrome.contentRestGap+insets.bottom}]} showsVerticalScrollIndicator={false}><View style={styles.menu}>
      <ListRow {...rowProps} title={m('mobile.practice.test')} subtitle={m('mobile.practice.test_sub')} leading={<ListChecksIcon size={23} color={C.text2}/>} onPress={openTest}/>
      <ListRow {...rowProps} title={m('mobile.practice.match')} subtitle={m('mobile.practice.match_sub')} leading={<PuzzleIcon size={23} color={C.text2}/>} onPress={openMatch}/>
      <ListRow {...rowProps} title={m('mobile.practice.favorites')} subtitle={m('mobile.practice.favorites_sub')} leading={<FavoriteIcon size={23} color={C.favorite} filled/>} onPress={openFavorites}/>
      <ListRow {...rowProps} title={m('mobile.practice.songs')} subtitle={m('mobile.practice.songs_sub')} leading={<MusicIcon size={23} color={C.text2}/>} onPress={openSongs}/>
      <ListRow {...rowProps} title="Ашыкъ оюн" subtitle="3D · Возвращение к истокам · Alan → RU" leading={<PracticeIcon size={23} color={C.text2}/>} onPress={openGame}/>
    </View></ScrollView></Screen>
    <Modal visible={gameOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={closeGame}>
      <SafeAreaView style={styles.gameSafe} edges={['top','right','bottom','left']}>
        <Screen>
          <Header title="Ашыкъ оюн" onBack={closeGame}/>
          <View style={styles.gameBody}>
            {gameUri?<WebView
              ref={gameRef}
              source={{uri:gameUri}}
              style={styles.gameWeb}
              originWhitelist={['*']}
              javaScriptEnabled
              domStorageEnabled
              allowFileAccess
              allowUniversalAccessFromFileURLs
              mixedContentMode="never"
              onLoadEnd={()=>{postAuth();postDictionary();}}
              onMessage={onGameMessage}
            />:<View style={styles.gameLoading}>{gameError?<Text style={styles.gameError}>{gameError}</Text>:<><ActivityIndicator color={C.accent}/><Text style={styles.gameLoadingText}>Открываем Ашыкъ оюн…</Text></>}</View>}
          </View>
        </Screen>
      </SafeAreaView>
    </Modal>
  </>;
}
const styles=StyleSheet.create({
  scroll:{width:'100%',maxWidth:720,alignSelf:'center',paddingTop:theme.control.header+theme.chrome.contentRestGap,paddingHorizontal:16,paddingBottom:28},
  menu:{overflow:'hidden'},
  menuRow:{minHeight:68,paddingHorizontal:2,paddingVertical:10,gap:10},
  menuLeading:{width:36,height:36},
  menuTitle:{fontSize:15,fontWeight:'800',lineHeight:18},
  menuSubtitle:{marginTop:2,fontSize:11,lineHeight:14.3},
  gameSafe:{flex:1,backgroundColor:C.appBg},
  gameBody:{flex:1,paddingTop:theme.control.header,backgroundColor:C.appBg},
  gameWeb:{flex:1,backgroundColor:C.appBg},
  gameLoading:{flex:1,alignItems:'center',justifyContent:'center',gap:12,padding:24,backgroundColor:C.appBg},
  gameLoadingText:{fontSize:12,color:C.text2},
  gameError:{fontSize:12,lineHeight:18,textAlign:'center',color:C.dangerStrong||C.text2},
});
