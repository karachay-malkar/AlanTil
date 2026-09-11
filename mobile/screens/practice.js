import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, Screen } from '../ui/components.js';
import { FavoriteIcon, ListChecksIcon, MusicIcon, PuzzleIcon } from '../ui/icons.js';
import { ListRow } from '../ui/parity.js';
import { msg } from '../i18n.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;
export function PracticeScreen({settings={},openTest,openMatch,openFavorites,openSongs}){
  const m=(key,params)=>msg(settings,key,params),insets=useSafeAreaInsets(),rowProps={style:styles.menuRow,titleStyle:styles.menuTitle,subtitleStyle:styles.menuSubtitle,leadingStyle:styles.menuLeading};
  return <Screen bottomNav><Header title="Alan Til!"/><ScrollView contentContainerStyle={[styles.scroll,{paddingBottom:theme.control.nav+theme.chrome.contentRestGap+insets.bottom}]} showsVerticalScrollIndicator={false}><View style={styles.panelHead}><Text style={styles.panelTitle}>{m('mobile.practice.title')}</Text></View><View style={styles.menu}>
    <ListRow {...rowProps} title={m('mobile.practice.test')} subtitle={m('mobile.practice.test_sub')} leading={<ListChecksIcon size={23} color={C.text2}/>} onPress={openTest}/>
    <ListRow {...rowProps} title={m('mobile.practice.match')} subtitle={m('mobile.practice.match_sub')} leading={<PuzzleIcon size={23} color={C.text2}/>} onPress={openMatch}/>
    <ListRow {...rowProps} title={m('mobile.practice.favorites')} subtitle={m('mobile.practice.favorites_sub')} leading={<FavoriteIcon size={23} color={C.favorite} filled/>} onPress={openFavorites}/>
    <ListRow {...rowProps} title={m('mobile.practice.songs')} subtitle={m('mobile.practice.songs_sub')} leading={<MusicIcon size={23} color={C.text2}/>} onPress={openSongs}/>
  </View></ScrollView></Screen>;
}
const styles=StyleSheet.create({scroll:{width:'100%',maxWidth:720,alignSelf:'center',paddingTop:theme.control.header+theme.chrome.contentRestGap,paddingHorizontal:16,paddingBottom:28},panelHead:{minHeight:42,justifyContent:'center',paddingHorizontal:2,borderBottomWidth:1,borderBottomColor:C.lineSoft},panelTitle:{fontSize:16,fontWeight:'800',lineHeight:20,color:C.text1},menu:{overflow:'hidden'},menuRow:{minHeight:68,paddingHorizontal:2,paddingVertical:10,gap:10},menuLeading:{width:36,height:36},menuTitle:{fontSize:15,fontWeight:'800',lineHeight:18},menuSubtitle:{marginTop:2,fontSize:11,lineHeight:14.3}});