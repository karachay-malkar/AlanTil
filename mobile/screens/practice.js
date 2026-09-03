import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Header, Screen, SectionLabel } from '../ui/components.js';
import { FavoriteIcon, ListChecksIcon, MusicIcon, PuzzleIcon } from '../ui/icons.js';
import { ListRow, SurfaceCard } from '../ui/parity.js';
import { msg } from '../i18n.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;
export function PracticeScreen({settings={},openTest,openMatch,openFavorites,openSongs}){
  const m=(key,params)=>msg(settings,key,params);
  return <Screen bottomNav><Header title=""/><ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}><SectionLabel>{m('mobile.practice.title')}</SectionLabel><SurfaceCard flat style={styles.menu}>
    <ListRow title={m('mobile.practice.test')} subtitle={m('mobile.practice.test_sub')} leading={<ListChecksIcon size={23} color={C.text2}/>} onPress={openTest}/>
    <ListRow title={m('mobile.practice.match')} subtitle={m('mobile.practice.match_sub')} leading={<PuzzleIcon size={23} color={C.text2}/>} onPress={openMatch}/>
    <ListRow title={m('mobile.practice.favorites')} subtitle={m('mobile.practice.favorites_sub')} leading={<FavoriteIcon size={23} color={C.favorite} filled/>} onPress={openFavorites}/>
    <ListRow title={m('mobile.practice.songs')} subtitle={m('mobile.practice.songs_sub')} leading={<MusicIcon size={23} color={C.text2}/>} onPress={openSongs}/>
  </SurfaceCard></ScrollView></Screen>;
}
const styles=StyleSheet.create({scroll:{width:'100%',maxWidth:720,alignSelf:'center',paddingTop:theme.control.header+10,paddingHorizontal:16,paddingBottom:theme.control.nav+28,gap:8},menu:{overflow:'hidden',borderTopWidth:1,borderTopColor:C.lineSoft}});
