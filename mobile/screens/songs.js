import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { buildSongLyricsModel, filterSongs } from '../../packages/alantil-core/songs.js';
import { buildSongPlaylists } from '../../packages/alantil-core/song-catalog.js';
import { FavoriteButton, Header, Screen, SectionLabel } from '../ui/components.js';
import { theme } from '../ui/theme.js';
import { loadNativeSongs } from '../platform/songs.js';
import { loadNativeSessionSnapshot, saveNativeSessionSnapshot } from '../platform/session-store.js';

const C = theme.colors;
const T = theme.type;

function SearchModes({ value, onChange }) {
  return <View style={styles.modeList}>{[['title', 'Название'], ['artist', 'Автор'], ['lyrics', 'Текст']].map(([id, label]) => <Pressable key={id} onPress={() => onChange(id)} style={[styles.modeItem, value === id && styles.modeItemActive]}><Text style={[styles.modeText, value === id && styles.modeTextActive]}>{label}</Text></Pressable>)}</View>;
}

function PlaylistsScreen({ songs, loading, favoriteIds, onOpenPlaylist, onBack }) {
  const playlists = useMemo(() => buildSongPlaylists(songs), [songs]);
  const favoriteCount = songs.filter((song) => favoriteIds.has(String(song.id))).length;
  const items = [{ id: '__favorites__', title: 'Избранные песни', count: favoriteCount, favorite: true }, ...playlists];
  return <Screen><Header title="Песни" onBack={onBack} /><ScrollView contentContainerStyle={styles.playlistsScroll}><SectionLabel>ПЕСНИ</SectionLabel>{loading ? <View style={styles.empty}><Text style={styles.emptyTitle}>Загружаем песни…</Text></View> : <View style={styles.playlistList}>{items.map((playlist) => <Pressable key={playlist.id} onPress={() => onOpenPlaylist(playlist.id)} style={({ pressed }) => [styles.playlistRow, pressed && styles.rowPressed]}><View style={styles.playlistCopy}><Text numberOfLines={1} style={[styles.playlistTitle, playlist.favorite && styles.favoritePlaylist]}>{playlist.title}</Text>{playlist.description ? <Text numberOfLines={2} style={styles.playlistDescription}>{playlist.description}</Text> : null}</View><Text style={styles.playlistCount}>{playlist.count || 0}</Text><Text style={styles.chevron}>›</Text></Pressable>)}</View>}{!loading && !playlists.length ? <Text style={styles.playlistsEmpty}>Песни пока не добавлены.</Text> : null}</ScrollView></Screen>;
}

function SongCatalog({ songs, loading, onOpen, favoriteIds, onFavorite, onBack, title = 'Песни', query, mode, onQueryChange, onModeChange }) {
  const rows = useMemo(() => filterSongs(songs, { searchQuery: query, searchMode: mode, favoriteIds }), [songs, query, mode, favoriteIds]);
  return <Screen><Header title={title} onBack={onBack} /><ScrollView contentContainerStyle={styles.catalogScroll} keyboardShouldPersistTaps="handled"><View style={styles.searchBar}><TextInput value={query} onChangeText={onQueryChange} placeholder="Поиск" placeholderTextColor={C.text3} style={styles.searchInput} /><SearchModes value={mode} onChange={onModeChange} /></View>{loading ? <View style={styles.empty}><Text style={styles.emptyTitle}>Загружаем песни…</Text></View> : rows.length ? rows.map((song) => <View key={song.id} style={styles.songRow}><Pressable onPress={() => onOpen(song.id)} style={({ pressed }) => [styles.songMain, pressed && styles.rowPressed]}><Text numberOfLines={1} style={styles.songTitle}>{song.title}</Text><Text numberOfLines={1} style={styles.songArtist}>{song.artist || '—'}</Text></Pressable><FavoriteButton active={favoriteIds.has(String(song.id))} onPress={() => onFavorite(song.id)} /></View>) : <View style={styles.empty}><Text style={styles.emptyTitle}>Песни не найдены</Text><Text style={styles.emptyText}>Измените поиск или выберите другой плейлист.</Text></View>}</ScrollView></Screen>;
}

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function LyricLine({ line, onWord }) {
  return <Text style={styles.original}>{line.tokens?.length ? line.tokens.map((entry, index) => entry.word ? <Text key={index} onPress={() => onWord(entry.word)} style={styles.songWord}>{entry.token}</Text> : <Text key={index}>{entry.token}</Text>) : line.text}</Text>;
}

function WordCard({ word, onClose }) {
  if (!word) return null;
  return <View style={styles.wordCard}><View style={styles.wordCardHead}><Text style={styles.wordCardWord}>{word.word}</Text><Pressable onPress={onClose} style={styles.wordCardClose}><Text style={styles.wordCardCloseText}>×</Text></Pressable></View><Text style={styles.wordCardTrans}>{word.trans}</Text>{word.synonyms ? <Text style={styles.wordCardMeta}>{word.synonyms}</Text> : null}</View>;
}

function SongDetail({ song, words, onBack, favorite, onFavorite }) {
  const model = useMemo(() => buildSongLyricsModel(song?.lyrics || '', song?.translation || '', words), [song, words]);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [activeWord, setActiveWord] = useState(null);
  const player = useAudioPlayer(song?.audioUrl ? { uri: song.audioUrl } : null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const duration = Math.max(0, Number(status.duration || 0));
  const current = Math.max(0, Number(status.currentTime || 0));
  const percent = duration ? Math.min(100, (current / duration) * 100) : 0;
  const mediaError = !song?.audioUrl ? 'Аудио для этой песни не указано.' : status?.error ? String(status.error?.message || status.error) : '';
  const toggle = () => { if (!song?.audioUrl || mediaError) return; if (status.playing) player.pause(); else player.play(); };
  const seek = (event) => {
    if (!duration || !timelineWidth) return;
    const location = Math.max(0, Math.min(timelineWidth, Number(event.nativeEvent?.locationX || 0)));
    Promise.resolve(player.seekTo((location / timelineWidth) * duration)).catch(() => {});
  };
  return <Screen><Header title={song?.title || 'Песня'} subtitle={song?.artist || ''} onBack={onBack} trailing={<FavoriteButton active={favorite} onPress={onFavorite} />} /><ScrollView contentContainerStyle={styles.detailScroll}><View style={styles.player}><Pressable onPress={toggle} disabled={!song?.audioUrl || Boolean(mediaError)} style={[styles.playButton, (!song?.audioUrl || mediaError) && styles.disabledPlayer]}><Text style={styles.playGlyph}>{status.playing ? 'Ⅱ' : '▶'}</Text></Pressable><View style={styles.timelineWrap}><View style={styles.mediaTimeline}><Text style={styles.time}>{formatTime(current)}</Text><Pressable onLayout={(event) => setTimelineWidth(event.nativeEvent.layout.width)} onPress={seek} style={styles.timeline}><View style={styles.timelineTrack} /><View style={[styles.timelineFill, { width: `${percent}%` }]} /></Pressable><Text style={styles.time}>{formatTime(duration)}</Text></View>{mediaError ? <Text style={styles.mediaError}>{mediaError}</Text> : null}</View></View><WordCard word={activeWord} onClose={() => setActiveWord(null)} /><View style={styles.lyrics}>{model.length ? model.map((block, index) => <View key={index} style={[styles.stanza, block.type === 'chorus' && styles.chorus]}>{block.originalLines.map((line, lineIndex) => <View key={lineIndex} style={styles.linePair}><LyricLine line={line} onWord={setActiveWord} />{block.translationLines[lineIndex] ? <Text style={styles.translation}>{block.translationLines[lineIndex]}</Text> : null}</View>)}</View>) : <Text style={styles.emptyText}>Текст песни отсутствует.</Text>}</View></ScrollView></Screen>;
}

export function SongsScreen({ songs: initialSongs = [], words = [], onBack, favoriteIds = new Set(), onFavorite }) {
  const [activePlaylistId, setActivePlaylistId] = useState('');
  const [activeSongId, setActiveSongId] = useState('');
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('title');
  const [songs, setSongs] = useState(initialSongs);
  const [loading, setLoading] = useState(!initialSongs.length);
  const [navigationReady, setNavigationReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadNativeSessionSnapshot('songs-ui').then((saved) => {
      if (!alive) return;
      if (saved) {
        setActivePlaylistId(String(saved.activePlaylistId || ''));
        setActiveSongId(String(saved.activeSongId || ''));
        setQuery(String(saved.query || ''));
        setMode(['title','artist','lyrics'].includes(saved.mode) ? saved.mode : 'title');
      }
      setNavigationReady(true);
    }).catch(() => { if (alive) setNavigationReady(true); });
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    if (!navigationReady) return;
    saveNativeSessionSnapshot('songs-ui',{activePlaylistId,activeSongId,query,mode}).catch(() => {});
  }, [navigationReady,activePlaylistId,activeSongId,query,mode]);
  useEffect(() => {
    let alive = true;
    if (initialSongs.length) { setSongs(initialSongs); setLoading(false); return () => { alive = false; }; }
    (async () => { const loaded = await loadNativeSongs(); if (alive) { setSongs(loaded); setLoading(false); } })();
    return () => { alive = false; };
  }, [initialSongs]);
  const activeSong = useMemo(() => songs.find((song)=>String(song.id)===String(activeSongId)) || null,[songs,activeSongId]);
  const closePlaylist = () => { setActivePlaylistId(''); setActiveSongId(''); };
  if (!navigationReady) return <Screen><Header title="Песни" onBack={onBack} /><View style={styles.empty}><Text style={styles.emptyTitle}>Восстанавливаем состояние…</Text></View></Screen>;
  if (activeSong) return <SongDetail song={activeSong} words={words} onBack={() => setActiveSongId('')} favorite={favoriteIds.has(String(activeSong.id))} onFavorite={() => onFavorite(activeSong.id)} />;
  if (activePlaylistId) {
    const favoritesOnly = activePlaylistId === '__favorites__';
    const playlist = buildSongPlaylists(songs).find((item) => item.id === activePlaylistId);
    const catalogSongs = favoritesOnly ? songs.filter((song) => favoriteIds.has(String(song.id))) : songs.filter((song) => String(song.playlistId) === String(activePlaylistId));
    return <SongCatalog songs={catalogSongs} loading={loading} onOpen={setActiveSongId} favoriteIds={favoriteIds} onFavorite={onFavorite} onBack={closePlaylist} title={favoritesOnly ? 'Избранные песни' : playlist?.title || 'Песни'} query={query} mode={mode} onQueryChange={setQuery} onModeChange={setMode} />;
  }
  return <PlaylistsScreen songs={songs} loading={loading} favoriteIds={favoriteIds} onOpenPlaylist={setActivePlaylistId} onBack={onBack} />;
}

const styles = StyleSheet.create({
  playlistsScroll: { paddingTop: theme.control.header + 8, paddingHorizontal: 12, paddingBottom: 24 },
  playlistList: { width: '100%' },
  playlistRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingHorizontal: 2, paddingVertical: 8 },
  playlistCopy: { flex: 1, minWidth: 0 },
  playlistTitle: { fontSize: 15, fontWeight: '800', color: C.text1 },
  favoritePlaylist: { color: C.favorite },
  playlistDescription: { marginTop: 2, fontSize: 11, lineHeight: 14, color: C.text2 },
  playlistCount: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '700', color: C.text3 },
  chevron: { fontSize: 22, lineHeight: 22, color: C.text3 },
  playlistsEmpty: { paddingVertical: 14, fontSize: T.caption, color: C.text3, textAlign: 'center' },
  rowPressed: { opacity: .68 },
  catalogScroll: { paddingTop: theme.control.header + 12, paddingHorizontal: 12, paddingBottom: 24 },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  searchInput: { flex: 1, minWidth: 92, height: 32, minHeight: 32, borderWidth: 1, borderColor: C.line, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.28)', paddingHorizontal: 10, fontSize: 12, color: C.text1 },
  modeList: { flexDirection: 'row', padding: 2, borderWidth: 1, borderColor: C.line, borderRadius: 999 },
  modeItem: { minHeight: 26, paddingHorizontal: 6, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  modeItemActive: { backgroundColor: 'rgba(246,242,233,.84)' },
  modeText: { fontFamily: theme.font.terminal, fontSize: 9, fontWeight: '700', color: C.text3 },
  modeTextActive: { color: C.text1 },
  songRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: C.lineSoft },
  songMain: { flex: 1, minHeight: 58, justifyContent: 'center', paddingHorizontal: 2 },
  songTitle: { fontSize: 15, fontWeight: '800', color: C.text1 },
  songArtist: { fontSize: 12, color: C.text2, marginTop: 3 },
  empty: { paddingVertical: 32, paddingHorizontal: 18, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: C.text1, marginBottom: 5 },
  emptyText: { fontSize: 12, lineHeight: 18, color: C.text3, textAlign: 'center' },
  detailScroll: { paddingTop: theme.control.header + 12, paddingHorizontal: 12, paddingBottom: 28 },
  player: { marginBottom: 13, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 9 },
  playButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.accentStrong, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  disabledPlayer: { opacity: .35 },
  playGlyph: { fontSize: 16, color: C.inverse, marginLeft: 2 },
  timelineWrap: { flex: 1 },
  mediaTimeline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeline: { flex: 1, height: 14, justifyContent: 'center', position: 'relative' },
  timelineTrack: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 999, backgroundColor: C.line },
  timelineFill: { height: 4, borderRadius: 999, backgroundColor: C.accent },
  time: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '650', color: C.text2 },
  mediaError: { fontSize: 12, color: C.danger, marginTop: 8 },
  wordCard: { marginBottom: 13, padding: 12, borderWidth: 1, borderColor: C.line, borderRadius: theme.radius.sm, backgroundColor: C.surface0 },
  wordCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordCardWord: { fontSize: 20, fontWeight: '800', color: C.text1 },
  wordCardClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  wordCardCloseText: { fontSize: 22, color: C.text2 },
  wordCardTrans: { fontSize: 14, color: C.text2, marginTop: 4 },
  wordCardMeta: { fontSize: 11, color: C.text3, marginTop: 5 },
  lyrics: { gap: 18, paddingBottom: 20 },
  stanza: { paddingVertical: 10, paddingHorizontal: 2, borderLeftWidth: 2, borderLeftColor: C.line },
  chorus: { borderLeftColor: C.accent },
  linePair: { marginTop: 10 },
  original: { fontSize: 17, fontWeight: '700', lineHeight: 26, color: C.text1 },
  songWord: { textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationColor: C.accent },
  translation: { fontSize: 14, lineHeight: 21, color: C.text2, marginTop: 2 },
});
