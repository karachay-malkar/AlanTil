import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { buildStoryWordGroups, filterStoryWordGroups, isThematicCatalog } from '../../packages/alantil-core/story-word-list.js';
import { toggleFavorite } from '../../packages/alantil-core/favorites.js';
import { FavoriteButton, Header, Screen } from '../ui/components.js';
import { msg } from '../i18n.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;

export function StoryWordListScreen({story,settings,favorites,setFavorites,onBack}){
  const [query,setQuery]=useState('');
  const groups=useMemo(()=>buildStoryWordGroups(story),[story]);
  const visible=useMemo(()=>filterStoryWordGroups(groups,query),[groups,query]);
  const title=msg(settings,'common.spisok_slov');
  const searchLabel=msg(settings,'common.poisk_slova');
  return <Screen><Header title={title} onBack={onBack}/><View style={styles.searchWrap}><TextInput value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" returnKeyType="search" placeholder={searchLabel} placeholderTextColor={C.text3} accessibilityLabel={searchLabel} style={styles.search}/></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>{visible.length?visible.map(({catalog,sections})=><View key={String(catalog?.dictionaryId||catalog?.catalogId||catalog?.name)} style={styles.catalogGroup}>{catalog?.name?<Text style={styles.catalogTitle}>{catalog.name}</Text>:null}{sections.map(({section,entries})=><View key={String(section?.sectionId||section?.id||section?.name)} style={styles.sectionGroup}>{isThematicCatalog(catalog)&&section?.name?<Text style={styles.sectionTitle}>{section.name}</Text>:null}{entries.map((entry)=><View key={String(entry.word.id)} style={styles.row}><Text style={styles.ordinal}>{entry.ordinal}.</Text><View style={styles.copy}><Text numberOfLines={1} style={styles.word}>{entry.word.word}</Text><Text numberOfLines={1} style={styles.trans}>{entry.word.trans}</Text></View><FavoriteButton active={favorites.has(String(entry.word.id))} onPress={()=>setFavorites(toggleFavorite(favorites,entry.word.id).ids)}/></View>)}</View>)}</View>):<View style={styles.empty}><Text style={styles.emptyText}>—</Text></View>}</ScrollView></Screen>;
}

const styles=StyleSheet.create({
  searchWrap:{position:'absolute',zIndex:20,top:theme.control.header,left:12,right:12,height:46,justifyContent:'center'},
  search:{height:34,borderWidth:1,borderColor:C.line,borderRadius:2,paddingHorizontal:11,fontSize:13,color:C.text1,backgroundColor:C.paperSoft},
  list:{paddingTop:theme.control.header+52,paddingHorizontal:12,paddingBottom:28},
  catalogGroup:{marginBottom:22},
  catalogTitle:{fontSize:15,fontWeight:'850',lineHeight:19,color:C.text1,paddingBottom:7,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  sectionGroup:{marginTop:9},
  sectionTitle:{fontSize:12,fontWeight:'800',lineHeight:16,color:C.text2,paddingVertical:5},
  row:{minHeight:54,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft,paddingVertical:6},
  ordinal:{width:34,fontFamily:theme.font.terminal,fontSize:10,fontWeight:'700',color:C.text3},
  copy:{flex:1,minWidth:0},
  word:{fontSize:14,fontWeight:'800',lineHeight:18,color:C.text1},
  trans:{marginTop:2,fontSize:12,lineHeight:16,color:C.text2},
  empty:{minHeight:180,alignItems:'center',justifyContent:'center'},
  emptyText:{fontFamily:theme.font.terminal,fontSize:18,color:C.text3},
});
