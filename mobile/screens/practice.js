import React from 'react';
import {ScrollView,StyleSheet,View} from 'react-native';
import {useSafeAreaInsets} from'react-native-safe-area-context';
import {CONTROL_LAYOUT} from '../../packages/alantil-ui/control-layout.js';
import {FavoriteIcon,ListChecksIcon,MusicIcon,PuzzleIcon} from '../ui/icons.js';
import {ListRow} from '../ui/parity.js';
import {Screen} from '../ui/components.js';
import {msg} from '../i18n.js';
import {theme} from '../ui/theme.js';
import {ashykMessages} from '../../packages/ashyk-game/i18n.js';

const C=theme.colors,P=CONTROL_LAYOUT.practice;
export function PracticeScreen({settings={},openTest,openMatch,openFavorites,openSongs,openAshyk}){
  const m=(key,params)=>msg(settings,key,params),insets=useSafeAreaInsets(),rowProps={style:styles.menuRow,titleStyle:styles.menuTitle,subtitleStyle:styles.menuSubtitle,leadingStyle:styles.menuLeading},ashyk=ashykMessages(settings.interface_language_code);
  return <Screen bottomNav><ScrollView contentContainerStyle={[styles.scroll,{paddingBottom:theme.control.nav+theme.chrome.contentRestGap+insets.bottom}]} showsVerticalScrollIndicator={false}><View style={styles.menu}>
    <ListRow {...rowProps} title={m('mobile.practice.test')} subtitle={m('mobile.practice.test_sub')} leading={<ListChecksIcon size={P.iconSize} color={C.text2}/>} onPress={openTest}/>
    <ListRow {...rowProps} title={m('mobile.practice.match')} subtitle={m('mobile.practice.match_sub')} leading={<PuzzleIcon size={P.iconSize} color={C.text2}/>} onPress={openMatch}/>
    <ListRow {...rowProps} title={m('mobile.practice.favorites')} subtitle={m('mobile.practice.favorites_sub')} leading={<FavoriteIcon size={P.iconSize} color={C.favorite} filled/>} onPress={openFavorites}/>
    <ListRow {...rowProps} title={m('mobile.practice.songs')} subtitle={m('mobile.practice.songs_sub')} leading={<MusicIcon size={P.iconSize} color={C.text2}/>} onPress={openSongs}/>
    <ListRow {...rowProps} style={[styles.menuRow,styles.singleRow]} title={ashyk.title} leading={<PuzzleIcon size={P.iconSize} color={C.text2}/>} onPress={openAshyk}/>
  </View></ScrollView></Screen>;
}
const styles=StyleSheet.create({
  scroll:{width:'100%',maxWidth:720,alignSelf:'center',paddingTop:theme.control.header+theme.chrome.contentRestGap,paddingHorizontal:16,paddingBottom:28},
  menu:{overflow:'hidden'},
  menuRow:{minHeight:P.rowHeight,paddingHorizontal:2,paddingVertical:10,gap:P.gap},
  singleRow:{minHeight:P.singleRowHeight},
  menuLeading:{width:P.leadingSize,height:P.leadingSize},
  menuTitle:{fontSize:P.titleSize,fontWeight:'800',lineHeight:18},
  menuSubtitle:{marginTop:2,fontSize:P.subtitleSize,lineHeight:14.3},
});
