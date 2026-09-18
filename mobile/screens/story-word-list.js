import React,{useDeferredValue,useEffect,useMemo,useRef,useState}from'react';
import{Animated,Easing,Pressable,SectionList,StyleSheet,Text,TextInput,useWindowDimensions,View}from'react-native';
import{buildStoryWordGroups,filterStoryWordGroups,isThematicCatalog}from'../../packages/alantil-core/story-word-list.js';
import{toggleFavorite}from'../../packages/alantil-core/favorites.js';
import{FavoriteButton,Header,HeaderCircleButton,Screen}from'../ui/components.js';
import{OverflowMarquee}from'../ui/parity.js';
import{CloseIcon,SearchIcon}from'../ui/icons.js';
import{Topography}from'../ui/topography.js';
import{msg}from'../i18n.js';
import{semanticTypography,theme}from'../ui/theme.js';
import{listRowHeight}from'../../packages/alantil-ui/list-table.js';
const C=theme.colors;

function flattenSections(groups){
  return groups.flatMap(({catalog,sections})=>sections.map((group,index)=>({
    key:`${String(catalog?.dictionaryId||catalog?.catalogId||catalog?.name)}::${String(group.section?.sectionId||group.section?.id||group.section?.name||index)}`,
    catalog,section:group.section,data:group.entries,showCatalog:index===0,thematic:isThematicCatalog(catalog),
  })));
}

export function StoryWordListScreen({story,settings,favorites,setFavorites,onBack}){
  const{width}=useWindowDimensions(),type=useMemo(()=>semanticTypography(settings?.text_size_code),[settings?.text_size_code]),[query,setQuery]=useState(''),deferredQuery=useDeferredValue(query),[searchOpen,setSearchOpen]=useState(false),searchProgress=useRef(new Animated.Value(0)).current;
  const groups=useMemo(()=>buildStoryWordGroups(story),[story]),visible=useMemo(()=>filterStoryWordGroups(groups,deferredQuery),[groups,deferredQuery]),sections=useMemo(()=>flattenSections(visible),[visible]),title=msg(settings,'common.spisok_slov'),searchLabel=msg(settings,'common.poisk_slova'),searchWidth=Math.min(width*.72,300),rowHeight=listRowHeight(settings?.text_size_code);
  useEffect(()=>{Animated.timing(searchProgress,{toValue:searchOpen?1:0,duration:theme.motion.normal,easing:Easing.out(Easing.quad),useNativeDriver:false}).start()},[searchOpen,searchProgress]);
  const animatedWidth=searchProgress.interpolate({inputRange:[0,1],outputRange:[36,searchWidth]}),closeSearch=()=>{setQuery('');setSearchOpen(false)},trailing=<Animated.View style={[styles.headerSearchWrap,{width:animatedWidth}]}>{searchOpen?<View style={styles.headerSearch}><TextInput autoFocus value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" returnKeyType="search" placeholder={searchLabel} placeholderTextColor={C.text3} accessibilityLabel={searchLabel} style={[styles.headerSearchInput,type.caption]}/><Pressable accessibilityRole="button" accessibilityLabel={searchLabel} onPress={closeSearch} style={styles.searchClose}><CloseIcon size={20} color={C.text2}/></Pressable></View>:<HeaderCircleButton icon={<SearchIcon size={20} color={C.text2}/>} accessibilityLabel={searchLabel} onPress={()=>setSearchOpen(true)}/>}</Animated.View>;
  const renderItem=({item:entry})=><View style={[styles.row,{height:rowHeight,minHeight:rowHeight}]}><Text style={[styles.ordinal,type.micro]}>{entry.ordinal}.</Text><View style={styles.copy}><Text numberOfLines={1} style={[styles.word,type.emphasis]}>{entry.word.word}</Text><OverflowMarquee textStyle={[styles.trans,type.caption]}>{entry.word.trans}</OverflowMarquee></View><FavoriteButton active={favorites.has(String(entry.word.id))} onPress={()=>setFavorites(toggleFavorite(favorites,entry.word.id).ids)}/></View>;
  const renderSectionHeader=({section})=><View style={styles.sectionHead}>{section.showCatalog&&section.catalog?.name?<Text style={[styles.catalogTitle,type.heading]}>{section.catalog.name}</Text>:null}{section.thematic&&section.section?.name?<Text style={[styles.sectionTitle,type.terminal]}>{section.section.name}</Text>:null}</View>;
  return <Screen><Topography opacity={.20} tileSize={460} align="left"/><Header title={searchOpen?'':title} onBack={onBack} trailing={trailing}/><SectionList sections={sections} keyExtractor={(entry)=>String(entry.word.id)} renderItem={renderItem} renderSectionHeader={renderSectionHeader} stickySectionHeadersEnabled={false} keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.list,!sections.length&&styles.emptyList]} showsVerticalScrollIndicator={false} initialNumToRender={18} maxToRenderPerBatch={16} updateCellsBatchingPeriod={32} windowSize={7} removeClippedSubviews ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyText}>—</Text></View>}/></Screen>;
}
const styles=StyleSheet.create({headerSearchWrap:{height:36,overflow:'visible'},headerSearch:{height:36,flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:6},headerSearchInput:{flex:1,minWidth:0,height:34,minHeight:34,paddingHorizontal:8,borderWidth:0,borderBottomWidth:1,borderBottomColor:C.controlBorder,borderRadius:0,color:C.text1,backgroundColor:'transparent'},searchClose:{width:36,height:36,alignItems:'center',justifyContent:'center'},list:{paddingTop:theme.control.header+8,paddingHorizontal:12,paddingBottom:18},emptyList:{flexGrow:1},sectionHead:{backgroundColor:'transparent'},catalogTitle:{marginTop:8,paddingHorizontal:7,paddingTop:10,paddingBottom:8,color:C.text1,borderBottomWidth:1,borderBottomColor:C.lineSoft},sectionTitle:{padding:7,color:C.accentStrong},row:{flexDirection:'row',alignItems:'center',paddingHorizontal:theme.listTable.horizontalPadding,paddingVertical:3,gap:theme.listTable.gap},ordinal:{width:theme.listTable.leadingSlot,color:C.text3,textAlign:'center'},copy:{flex:1,minWidth:0,minHeight:40,justifyContent:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft,overflow:'hidden'},word:{color:C.text1},trans:{color:C.text2},empty:{flex:1,paddingTop:36,paddingHorizontal:8,alignItems:'center',justifyContent:'center'},emptyText:{fontFamily:theme.font.terminal,fontSize:18,color:C.text3}});
