import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, Screen } from '../ui/components.js';
import { FavoriteIcon, ListChecksIcon, MusicIcon, PuzzleIcon } from '../ui/icons.js';
import { ListRow } from '../ui/parity.js';
import { msg } from '../i18n.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;
function AshykIcon({size=23,color=C.text2}){return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="M7.2 6.1a3.3 3.3 0 1 0-4.7 4.7 3.3 3.3 0 0 0 2.6.9l7.2 7.2a3.3 3.3 0 0 0 .9 2.6 3.3 3.3 0 1 0 4.7-4.7 3.3 3.3 0 0 0-2.6-.9L8.1 8.7a3.3 3.3 0 0 0-.9-2.6Z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></Svg>}
export function PracticeScreen({settings={},openTest,openMatch,openFavorites,openSongs,openAshyk}){
  const m=(key,params)=>msg(settings,key,params),insets=useSafeAreaInsets(),rowProps={style:styles.menuRow,titleStyle:styles.menuTitle,subtitleStyle:styles.menuSubtitle,leadingStyle:styles.menuLeading};
  return <Screen bottomNav><Header title="osuyat"/><ScrollView contentContainerStyle={[styles.scroll,{paddingBottom:theme.control.nav+theme.chrome.contentRestGap+insets.bottom}]} showsVerticalScrollIndicator={false}><View style={styles.panelHead}><Text style={styles.panelTitle}>{m('practice.praktika')}</Text></View><View style={styles.menu}>
    <ListRow {...rowProps} title={m('practice.test')} subtitle={m('practice.proverka_slov_iz_vybrannyh_razdelov')} leading={<ListChecksIcon size={23} color={C.text2}/>} onPress={openTest}/>
    <ListRow {...rowProps} title={m('practice.sopostavlenie')} subtitle={m('practice.soedinenie_slov_i_perevodov')} leading={<PuzzleIcon size={23} color={C.text2}/>} onPress={openMatch}/>
    <ListRow {...rowProps} title={m('common.izbrannoe')} subtitle={m('learn.uchit_slova')} leading={<FavoriteIcon size={23} color={C.text2}/>} onPress={openFavorites}/>
    <ListRow {...rowProps} title={m('practice.pesni')} subtitle={m('practice.yazyk_v_zhivom_kontekste')} leading={<MusicIcon size={23} color={C.text2}/>} onPress={openSongs}/>
    <ListRow {...rowProps} title="Ашыкъ оюн" subtitle="Народная 3D-игра" leading={<AshykIcon/>} onPress={openAshyk}/>
  </View></ScrollView></Screen>;
}
const styles=StyleSheet.create({scroll:{width:'100%',maxWidth:720,alignSelf:'center',paddingTop:theme.control.header+theme.chrome.contentRestGap,paddingHorizontal:16,paddingBottom:28},panelHead:{minHeight:42,justifyContent:'center',paddingHorizontal:2,borderBottomWidth:1,borderBottomColor:C.lineSoft},panelTitle:{fontSize:16,fontWeight:'800',lineHeight:20,color:C.text1},menu:{overflow:'hidden'},menuRow:{minHeight:68,paddingHorizontal:2,paddingVertical:10,gap:10},menuLeading:{width:36,height:36},menuTitle:{fontSize:15,fontWeight:'800',lineHeight:18},menuSubtitle:{marginTop:2,fontSize:11,lineHeight:14.3}});
