import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { buildStoryWordGroups, filterStoryWordGroups, isThematicCatalog } from '../../packages/alantil-core/story-word-list.js';
import { toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { FavoriteButton, Header, HeaderCircleButton, Screen } from '../ui/components.js';
import { SearchIcon } from '../ui/icons.js';
import { Topography } from '../ui/topography.js';
import { msg } from '../i18n.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;

export function StoryWordListScreen({story,settings,favorites,setFavorites,onBack}){
  const {width}=useWindowDimensions();
  const [query,setQuery]=useState(''),[searchOpen,setSearchOpen]=useState(false);
  const groups=useMemo(()=>buildStoryWordGroups(story),[story]);
  const visible=useMemo(()=>filterStoryWordGroups(groups,query),[groups,query]);
  const title=msg(settings,'common.spisok_slov');
  const searchLabel=msg(settings,'common.poisk_slova');
  const searchWidth=Math.min(width*.72,300);
  const trailing=searchOpen?<View style={[styles.headerSearch,{width:searchWidth}]}><TextInput autoFocus value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" returnKeyType="search" placeholder={searchLabel} placeholderTextColor={C.text3} accessibilityLabel={searchLabel} style={styles.headerSearchInput}/><Pressable accessibilityRole="button" accessibilityLabel={searchLabel} onPress={()=>{setQuery('');setSearchOpen(false);}} style={styles.searchClose}><Text style={styles.searchCloseText}>×</Text></Pressable></View>:<HeaderCircleButton icon={<SearchIcon size={20} color={C.text2}/>} accessibilityLabel={searchLabel} onPress={()=>setSearchOpen(true)}/>;
  return <Screen><Topography opacity={0.20}/><Header title={title} onBack={onBack} trailing={trailing}/><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>{visible.length?visible.map(({catalog,sections})=><View key={String(catalog?.dictionaryId||catalog?.catalogId||catalog?.name)}>{catalog?.name?<Text style={styles.catalogTitle}>{catalog.name}</Text>:null}{sections.map(({section,entries})=><View key={String(section?.sectionId||section?.id||section?.name)}>{isThematicCatalog(catalog)&&section?.name?<Text style={styles.sectionTitle}>{section.name}</Text>:null}{entries.map((entry)=><View key={String(entry.word.id)} style={styles.row}><Text style={styles.ordinal}>{entry.ordinal}.</Text><View style={styles.copy}><Text numberOfLines={1} style={styles.word}>{entry.word.word}</Text><Text numberOfLines={1} style={styles.trans}>{entry.word.trans}</Text></View><FavoriteButton active={favorites.has(String(entry.word.id))} onPress={()=>setFavorites(toggleFavorite(favorites,entry.word.id).ids)}/></View>)}</View>)}</View>):<View style={styles.empty}><Text style={styles.emptyText}>—</Text></View>}</ScrollView></Screen>;
}

const styles=StyleSheet.create({
  headerSearch:{height:36,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:6},
  headerSearchInput:{flex:1,minWidth:0,height:34,minHeight:34,paddingHorizontal:8,borderWidth:0,borderBottomWidth:1,borderBottomColor:C.controlBorder,borderRadius:0,fontSize:13,fontWeight:'600',color:C.text1,backgroundColor:'transparent'},
  searchClose:{width:36,height:36,alignItems:'center',justifyContent:'center'},searchCloseText:{fontSize:25,lineHeight:25,fontWeight:'500',color:C.text2},
  list:{paddingTop:theme.control.header+8,paddingHorizontal:12,paddingBottom:18},
  catalogTitle:{marginTop:8,paddingHorizontal:7,paddingTop:10,paddingBottom:8,fontSize:15,fontWeight:'850',lineHeight:18,color:C.text1,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  sectionTitle:{padding:7,fontFamily:theme.font.terminal,fontSize:11,fontWeight:'800',lineHeight:13,color:C.accentStrong},
  row:{height:52,minHeight:52,flexDirection:'row',alignItems:'center',paddingHorizontal:2,paddingVertical:3},
  ordinal:{width:36,fontFamily:theme.font.terminal,fontSize:10,fontWeight:'700',lineHeight:10,color:C.text3,textAlign:'center'},
  copy:{flex:1,minWidth:0,height:44,justifyContent:'center',borderBottomWidth:1,borderBottomColor:'rgba(54,50,43,.0864)'},
  word:{fontSize:15,fontWeight:'800',lineHeight:21,color:C.text1},
  trans:{fontSize:12,lineHeight:18,color:C.text2},
  empty:{paddingTop:theme.control.header+36,paddingHorizontal:8,alignItems:'center'},
  emptyText:{fontFamily:theme.font.terminal,fontSize:18,color:C.text3},
});
