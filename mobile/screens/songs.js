import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { buildSongLyricsModel, filterSongs } from '../../packages/alantil-core/songs.js';
import { loadNativeSongs } from '../platform/songs.js';
import { FavoriteButton, Header, Screen, SectionLabel } from '../ui/components.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function SearchModes({ value, onChange }) {
  return <View style={styles.modeList}>{[['title','Название'],['artist','Автор'],['lyrics','Текст']].map(([id,label]) => <Pressable key={id} onPress={() => onChange(id)} style={[styles.modeItem,value===id&&styles.modeItemActive]}><Text style={[styles.modeText,value===id&&styles.modeTextActive]}>{label}</Text></Pressable>)}</View>;
}

function SongCatalog({ songs, loading, onOpen, favoriteIds, onFavorite }) {
  const [query,setQuery] = useState('');
  const [mode,setMode] = useState('title');
  const rows = useMemo(() => filterSongs(songs,{searchQuery:query,searchMode:mode,favoriteIds}),[songs,query,mode,favoriteIds]);
  return (
    <Screen>
      <Header title="Песни" />
      <ScrollView contentContainerStyle={styles.catalogScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.searchBar}><TextInput value={query} onChangeText={setQuery} placeholder="Поиск" placeholderTextColor={C.text3} style={styles.searchInput}/><SearchModes value={mode} onChange={setMode}/></View>
        <SectionLabel>ПЕСНИ</SectionLabel>
        {loading ? <View style={styles.empty}><Text style={styles.emptyTitle}>Загрузка</Text><Text style={styles.emptyText}>Получаем тот же каталог, который использует сайт.</Text></View> : rows.length ? rows.map((song) => <View key={song.id} style={styles.songRow}><Pressable onPress={() => onOpen(song)} style={styles.songMain}><Text style={styles.songTitle}>{song.title}</Text><Text style={styles.songArtist}>{song.artist||'—'}</Text></Pressable><FavoriteButton active={favoriteIds.has(song.id)} onPress={() => onFavorite(song.id)}/></View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>Песни не найдены</Text><Text style={styles.emptyText}>{query?'Измените запрос или режим поиска.':'Каталог сейчас недоступен. Повторите после подключения к интернету.'}</Text></View>}
      </ScrollView>
    </Screen>
  );
}

function SongDetail({ song, words, onBack, favorite, onFavorite }) {
  const model = useMemo(() => buildSongLyricsModel(song?.lyrics||'',song?.translation||'',words),[song,words]);
  return (
    <Screen>
      <Header title={song?.title||'Песня'} subtitle={song?.artist||''} onBack={onBack} trailing={<FavoriteButton active={favorite} onPress={onFavorite}/>}/>
      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.player}><View style={styles.playButton}><Text style={styles.playGlyph}>▶</Text></View><View style={styles.timelineWrap}><View style={styles.timeline}><View style={styles.timelineFill}/></View><View style={styles.timeRow}><Text style={styles.time}>0:00</Text><Text style={styles.time}>0:00</Text></View></View></View>
        <View style={styles.lyrics}>{model.length ? model.map((block,index) => <View key={index} style={[styles.stanza,block.type==='chorus'&&styles.chorus]}>{block.originalLines.map((line,lineIndex) => <View key={lineIndex} style={styles.linePair}><Text style={styles.original}>{line.text}</Text>{block.translationLines[lineIndex]?<Text style={styles.translation}>{block.translationLines[lineIndex]}</Text>:null}</View>)}</View>) : <Text style={styles.emptyText}>Текст песни отсутствует.</Text>}</View>
      </ScrollView>
    </Screen>
  );
}

export function SongsScreen({ songs: suppliedSongs = null, words = [], favoriteIds = new Set(), onFavorite }) {
  const [activeSong,setActiveSong] = useState(null);
  const [loadedSongs,setLoadedSongs] = useState(() => Array.isArray(suppliedSongs)&&suppliedSongs.length ? suppliedSongs : []);
  const [loading,setLoading] = useState(!(Array.isArray(suppliedSongs)&&suppliedSongs.length));
  useEffect(() => {
    if (Array.isArray(suppliedSongs) && suppliedSongs.length) { setLoadedSongs(suppliedSongs);setLoading(false);return; }
    let active=true;
    setLoading(true);
    loadNativeSongs().then((collection) => { if(active)setLoadedSongs(collection); }).finally(() => { if(active)setLoading(false); });
    return () => { active=false; };
  },[suppliedSongs]);
  if(activeSong) return <SongDetail song={activeSong} words={words} onBack={() => setActiveSong(null)} favorite={favoriteIds.has(activeSong.id)} onFavorite={() => onFavorite(activeSong.id)}/>;
  return <SongCatalog songs={loadedSongs} loading={loading} onOpen={setActiveSong} favoriteIds={favoriteIds} onFavorite={onFavorite}/>;
}

const styles=StyleSheet.create({
  catalogScroll:{paddingTop:theme.control.header+12,paddingHorizontal:12,paddingBottom:24},searchBar:{gap:6,marginBottom:10},searchInput:{height:32,minHeight:32,borderWidth:1,borderColor:C.line,borderRadius:999,backgroundColor:'rgba(255,255,255,.28)',paddingHorizontal:10,fontSize:12,color:C.text1},modeList:{alignSelf:'flex-end',flexDirection:'row',padding:2,borderWidth:1,borderColor:C.line,borderRadius:999},modeItem:{minHeight:26,paddingHorizontal:7,borderRadius:999,alignItems:'center',justifyContent:'center'},modeItemActive:{backgroundColor:'rgba(246,242,233,.84)'},modeText:{fontSize:9,fontWeight:'700',color:C.text3},modeTextActive:{color:C.text1},songRow:{minHeight:58,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:C.lineSoft},songMain:{flex:1,minHeight:58,justifyContent:'center',paddingHorizontal:2},songTitle:{fontSize:15,fontWeight:'800',color:C.text1},songArtist:{fontSize:12,color:C.text2,marginTop:3},empty:{paddingVertical:32,paddingHorizontal:18,borderWidth:1,borderStyle:'dashed',borderColor:C.line,borderRadius:theme.radius.md,alignItems:'center'},emptyTitle:{fontSize:18,fontWeight:'800',color:C.text1,marginBottom:5},emptyText:{fontSize:12,lineHeight:18,color:C.text3,textAlign:'center'},detailScroll:{paddingTop:theme.control.header+12,paddingHorizontal:12,paddingBottom:28},player:{marginBottom:13,paddingVertical:9,borderBottomWidth:1,borderBottomColor:C.lineSoft,flexDirection:'row',alignItems:'center',gap:9},playButton:{width:44,height:44,borderRadius:22,borderWidth:1,borderColor:C.accentStrong,backgroundColor:C.accent,alignItems:'center',justifyContent:'center'},playGlyph:{fontSize:16,color:C.inverse,marginLeft:2},timelineWrap:{flex:1},timeline:{height:4,borderRadius:999,backgroundColor:C.line,overflow:'hidden'},timelineFill:{width:'0%',height:4,backgroundColor:C.accent},timeRow:{flexDirection:'row',justifyContent:'space-between',marginTop:5},time:{fontSize:10,color:C.text2},lyrics:{gap:18,paddingBottom:20},stanza:{paddingVertical:10,paddingLeft:10,borderLeftWidth:2,borderLeftColor:C.line},chorus:{borderLeftColor:C.accent},linePair:{marginTop:10},original:{fontSize:17,fontWeight:'700',lineHeight:26,color:C.text1},translation:{fontSize:14,lineHeight:21,color:C.text2,marginTop:2},
});
