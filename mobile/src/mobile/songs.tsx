import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { trackMobileEvent } from '@/src/mobile/analytics';
import { AlanIcon } from '@/src/mobile/icons';
import {
  displayedAlanWord,
  displayedExamples,
  displayedTranslation,
  loadAllWords,
  type MobileWord,
} from '@/src/mobile/dictionary';
import { useI18n } from '@/src/mobile/i18n';
import { OverflowMarquee } from '@/src/mobile/overflow-marquee';
import { PracticeHeader } from '@/src/mobile/practice/common';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import {
  buildSongWordIndex,
  crossedSongThresholds,
  filterSongs,
  pairLyrics,
  tokenizeSongLine,
} from '@/src/mobile/songs/policy';
import {
  FAVORITES_PLAYLIST_ID,
  loadSongFavorites,
  loadSongs,
  playlistsFrom,
  readSongCatalogState,
  setSongFavorite,
  writeSongCatalogState,
  type MobileSong,
  type SongSearchMode,
} from '@/src/mobile/songs/repository';
import { theme } from '@/src/mobile/theme';
import { AppText as Text } from '@/src/mobile/typography';

function Loading() {
  return <View style={styles.center}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
}

function Empty({ text }: { text: string }) {
  return <View style={styles.center}><Text style={styles.emptyTitle}>{text}</Text></View>;
}

function ErrorState({ message, retry, retryLabel }: { message: string; retry: () => void; retryLabel: string }) {
  return (
    <View accessibilityRole="alert" style={styles.center}>
      <Text style={styles.error}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={retry} style={styles.retryButton}><Text style={styles.retryText}>{retryLabel}</Text></Pressable>
    </View>
  );
}

function StarButton({ active, onPress, label }: { active: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={8}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}
    >
      <Text style={[styles.star, active && styles.starActive]}>{active ? '★' : '☆'}</Text>
    </Pressable>
  );
}

export function SongsPlaylistsScreen() {
  const auth = useSession();
  const { t } = useI18n();
  const [songs, setSongs] = useState<MobileSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    try {
      const items = await loadSongs({ force });
      setSongs(items);
      void trackMobileEvent('songs_open', { playlist_count: playlistsFrom(items).length }, auth.user?.id);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [auth.user?.id]);

  useEffect(() => { void load(); }, [load]);
  const playlists = useMemo(() => playlistsFrom(songs), [songs]);

  const openPlaylist = (playlistId: string) => {
    router.push({ pathname: '/practice/songs/catalog', params: { playlistId } });
  };

  return (
    <View style={styles.screen}>
      <PracticeHeader title={t('songs.title')} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? <Loading /> : error ? <ErrorState message={t('songs.load_error')} retry={() => void load(true)} retryLabel={t('common.retry')} /> : (
          <>
            <Pressable accessibilityRole="button" onPress={() => openPlaylist(FAVORITES_PLAYLIST_ID)} style={({ pressed }) => [styles.playlistRow, pressed && styles.pressed]}>
              <View style={styles.favoriteGlyph}><AlanIcon color={theme.colors.accentStrong} name="favorite" size={19} /></View>
              <Text style={styles.playlistTitle}>{t('songs.favorites')}</Text>
              <AlanIcon color={theme.colors.textSoft} name="chevron" size={17} />
            </Pressable>
            {playlists.map((playlist) => (
              <Pressable accessibilityRole="button" key={playlist.id} onPress={() => openPlaylist(playlist.id)} style={({ pressed }) => [styles.playlistRow, pressed && styles.pressed]}>
                <View style={styles.musicGlyph}><AlanIcon color={theme.colors.accentStrong} name="songs" size={19} /></View>
                <Text numberOfLines={2} style={styles.playlistTitle}>{playlist.title}</Text>
                <AlanIcon color={theme.colors.textSoft} name="chevron" size={17} />
              </Pressable>
            ))}
            {!playlists.length ? <Empty text={t('songs.empty')} /> : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function SearchModeSelector({ mode, onChange }: { mode: SongSearchMode; onChange: (mode: SongSearchMode) => void }) {
  const { t } = useI18n();
  const modes: { value: SongSearchMode; label: string }[] = [
    { value: 'title', label: t('songs.search_title') },
    { value: 'artist', label: t('songs.search_artist') },
    { value: 'lyrics', label: t('songs.search_lyrics') },
  ];
  return (
    <View accessibilityRole="radiogroup" style={styles.searchModes}>
      {modes.map((entry) => {
        const active = mode === entry.value;
        return (
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: active }} key={entry.value} onPress={() => onChange(entry.value)} style={({ pressed }) => [styles.searchMode, active && styles.searchModeActive, pressed && styles.pressed]}>
            <Text numberOfLines={1} style={[styles.searchModeText, active && styles.searchModeTextActive]}>{entry.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SongsCatalogScreen() {
  const auth = useSession();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ playlistId?: string }>();
  const playlistId = String(params.playlistId ?? '');
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const restoredPlaylistRef = useRef('');
  const trackedPlaylistRef = useRef('');
  const [songs, setSongs] = useState<MobileSong[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SongSearchMode>('title');
  const [searchOpen, setSearchOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [favoriteError, setFavoriteError] = useState(false);

  const load = useCallback(async (force = false, restoreState = false) => {
    setLoading(true);
    setError(false);
    try {
      const [items, favoriteIds, saved] = await Promise.all([
        loadSongs({ force }),
        loadSongFavorites(auth.user?.id),
        restoreState ? readSongCatalogState(auth.user?.id, playlistId) : Promise.resolve(null),
      ]);
      setSongs(items);
      setFavorites(favoriteIds);
      if (saved) {
        setQuery(saved.query);
        setMode(saved.mode);
        setSearchOpen(saved.searchOpen);
        scrollOffsetRef.current = saved.scrollOffset;
      }
      setReady(true);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [auth.user?.id, playlistId]);

  useEffect(() => {
    setReady(false);
    restoredPlaylistRef.current = '';
    void load(false, true);
  }, [load]);

  const playlist = useMemo(() => playlistsFrom(songs).find((item) => item.id === playlistId), [playlistId, songs]);
  const available = useMemo(() => playlistId === FAVORITES_PLAYLIST_ID ? songs.filter((song) => favorites.has(song.id)) : songs.filter((song) => song.playlistId === playlistId), [favorites, playlistId, songs]);
  const visible = useMemo(() => filterSongs(available, query, mode), [available, mode, query]);
  const title = playlistId === FAVORITES_PLAYLIST_ID ? t('songs.favorites') : playlist?.title || t('songs.title');

  useEffect(() => {
    const trackingKey = `${auth.user?.id ?? 'guest'}:${playlistId}`;
    if (!ready || loading || trackedPlaylistRef.current === trackingKey) return;
    trackedPlaylistRef.current = trackingKey;
    void trackMobileEvent('playlist_open', { playlist_id: playlistId, song_count: available.length }, auth.user?.id);
  }, [auth.user?.id, available.length, loading, playlistId, ready]);

  const persistState = useCallback(() => writeSongCatalogState(auth.user?.id, playlistId, {
    searchOpen,
    query,
    mode,
    scrollOffset: scrollOffsetRef.current,
  }), [auth.user?.id, mode, playlistId, query, searchOpen]);

  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => { void persistState(); }, 250);
    return () => clearTimeout(timer);
  }, [persistState, ready]);

  useEffect(() => {
    if (!ready || loading || restoredPlaylistRef.current === playlistId) return;
    restoredPlaylistRef.current = playlistId;
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y: scrollOffsetRef.current, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [loading, playlistId, ready]);

  useEffect(() => {
    if (!ready || !searchOpen || !query.trim()) return;
    const timer = setTimeout(() => {
      void trackMobileEvent(visible.length ? 'search_result' : 'search_empty', {
        search_area: 'songs',
        search_mode: mode,
        query_length: query.trim().length,
        result_count: visible.length,
      }, auth.user?.id);
    }, 600);
    return () => clearTimeout(timer);
  }, [auth.user?.id, mode, query, ready, searchOpen, visible.length]);

  const toggleSearch = () => {
    const next = !searchOpen;
    setSearchOpen(next);
    if (next) void trackMobileEvent('search_open', { search_area: 'songs', search_mode: mode }, auth.user?.id);
  };

  const toggleFavorite = async (song: MobileSong) => {
    setFavoriteError(false);
    const nextActive = !favorites.has(song.id);
    try {
      const next = await setSongFavorite(auth.user?.id, song.id, nextActive);
      setFavorites(new Set(next));
      void trackMobileEvent(nextActive ? 'favorite_song_add' : 'favorite_song_remove', { song_id: song.id, playlist_id: song.playlistId }, auth.user?.id);
    } catch {
      setFavoriteError(true);
    }
  };

  const saveScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffsetRef.current = Math.max(0, event.nativeEvent.contentOffset.y);
    void persistState();
  };

  const searchAction = (
    <Pressable
      accessibilityLabel={searchOpen ? t('songs.search_close') : t('songs.search_open')}
      accessibilityRole="button"
      accessibilityState={{ expanded: searchOpen }}
      onPress={toggleSearch}
      style={[styles.headerSearch, searchOpen && styles.headerSearchActive]}
    >
      <AlanIcon color={theme.colors.text} name={searchOpen ? 'close' : 'search'} size={searchOpen ? 22 : 21} />
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <PracticeHeader action={searchAction} title={title} />
      {searchOpen ? (
        <View style={styles.searchPanel}>
          <TextInput
            accessibilityLabel={t('songs.search_placeholder')}
            autoFocus
            onChangeText={setQuery}
            placeholder={t('songs.search_placeholder')}
            placeholderTextColor={theme.colors.textSoft}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          <SearchModeSelector mode={mode} onChange={setMode} />
        </View>
      ) : null}
      {favoriteError ? <Text accessibilityRole="alert" style={styles.inlineError}>{t('songs.favorite_error')}</Text> : null}
      {loading ? <Loading /> : error ? <ErrorState message={t('songs.load_error')} retry={() => void load(true)} retryLabel={t('common.retry')} /> : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          onMomentumScrollEnd={saveScroll}
          onScroll={(event) => { scrollOffsetRef.current = event.nativeEvent.contentOffset.y; }}
          onScrollEndDrag={saveScroll}
          ref={scrollRef}
          scrollEventThrottle={100}
          showsVerticalScrollIndicator={false}
        >
          {!visible.length ? <Empty text={playlistId === FAVORITES_PLAYLIST_ID && !query.trim() ? t('songs.favorites_empty') : t('songs.nothing_found')} /> : null}
          {visible.map((song) => {
            const active = favorites.has(song.id);
            return (
              <Pressable
                accessibilityRole="button"
                key={song.id}
                onPress={() => {
                  void persistState();
                  router.push({ pathname: '/practice/songs/song', params: { songId: song.id } });
                }}
                style={({ pressed }) => [styles.songRow, pressed && styles.pressed]}
              >
                <View style={styles.rowCopy}>
                  <OverflowMarquee style={styles.rowTitle}>{song.title}</OverflowMarquee>
                  <Text numberOfLines={1} style={styles.rowSubtitle}>{song.artist || '—'}</Text>
                </View>
                <StarButton active={active} label={active ? t('songs.remove_favorite') : t('songs.add_favorite')} onPress={() => void toggleFavorite(song)} />
                <AlanIcon color={theme.colors.textSoft} name="chevron" size={17} />
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function timeLabel(value: number) {
  const seconds = Math.max(0, Math.round(value || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function SongAudioPlayer({ song, userId }: { song: MobileSong; userId?: string | null }) {
  const { t } = useI18n();
  const player = useAudioPlayer(song.audioUrl || null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [trackWidth, setTrackWidth] = useState(0);
  const seenRef = useRef(new Set<number>());
  const wasPlayingRef = useRef(false);
  const lastTimeRef = useRef(0);
  const listenedRef = useRef(0);
  const completedRef = useRef(false);
  const latestStatusRef = useRef(status);
  latestStatusRef.current = status;

  const analyticsParameters = useCallback(() => ({
    song_id: song.id,
    playlist_id: song.playlistId,
    position_sec: Math.max(0, Math.round(latestStatusRef.current.currentTime || 0)),
    duration_sec: Math.max(0, Math.round(latestStatusRef.current.duration || 0)),
  }), [song.id, song.playlistId]);

  useEffect(() => {
    const current = Math.max(0, Number(status.currentTime || 0));
    const duration = Math.max(0, Number(status.duration || 0));
    const delta = current - lastTimeRef.current;
    if (wasPlayingRef.current && delta > 0 && delta <= 5) listenedRef.current += delta;
    crossedSongThresholds(current, duration, seenRef.current).forEach((threshold) => {
      seenRef.current.add(threshold);
      void trackMobileEvent('song_progress', { ...analyticsParameters(), progress_percent: threshold }, userId);
    });
    if (status.playing && !wasPlayingRef.current) void trackMobileEvent('song_play', analyticsParameters(), userId);
    if (!status.playing && wasPlayingRef.current && !status.didJustFinish) void trackMobileEvent('song_pause', analyticsParameters(), userId);
    if (status.didJustFinish && !completedRef.current) {
      completedRef.current = true;
      void trackMobileEvent('song_complete', {
        song_id: song.id,
        playlist_id: song.playlistId,
        listened_sec: Math.max(0, Math.round(listenedRef.current)),
        audio_duration_sec: Math.max(0, Math.round(duration)),
      }, userId);
    }
    lastTimeRef.current = current;
    wasPlayingRef.current = status.playing;
  }, [analyticsParameters, song.id, song.playlistId, status.currentTime, status.didJustFinish, status.duration, status.playing, userId]);

  useEffect(() => () => {
    if (latestStatusRef.current.playing) void trackMobileEvent('song_pause', analyticsParameters(), userId);
  }, [analyticsParameters, userId]);

  if (!song.audioUrl) return <Text style={styles.noAudio}>{t('songs.audio_missing')}</Text>;
  const duration = Math.max(0, Number(status.duration || 0));
  const current = Math.max(0, Number(status.currentTime || 0));
  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  const seek = (event: GestureResponderEvent) => {
    if (!trackWidth || duration <= 0) return;
    const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / trackWidth));
    const next = duration * ratio;
    lastTimeRef.current = next;
    void player.seekTo(next);
  };

  const retry = async () => {
    player.replace(song.audioUrl);
    player.play();
  };

  return (
    <View style={styles.player}>
      <Pressable
        accessibilityLabel={status.playing ? t('songs.pause') : t('songs.play')}
        accessibilityRole="button"
        onPress={() => status.playing ? player.pause() : player.play()}
        style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
      >
        <Text style={styles.playGlyph}>{status.playing ? 'Ⅱ' : '▶'}</Text>
      </Pressable>
      <View style={styles.playerBody}>
        <Pressable
          accessibilityLabel={t('songs.seek')}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(current), text: `${timeLabel(current)} / ${timeLabel(duration)}` }}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          onPress={seek}
          style={styles.progressTouch}
        >
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} /></View>
        </Pressable>
        <View style={styles.timeRow}><Text style={styles.time}>{timeLabel(current)}</Text><Text style={styles.time}>{timeLabel(duration)}</Text></View>
        {status.isBuffering ? <Text style={styles.playerStatus}>{t('songs.buffering')}</Text> : null}
        {status.error ? (
          <View accessibilityRole="alert" style={styles.audioErrorRow}>
            <Text style={styles.audioError}>{t('songs.audio_error')}</Text>
            <Pressable accessibilityRole="button" onPress={() => void retry()}><Text style={styles.audioRetry}>{t('common.retry')}</Text></Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SheetModal({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.modalScrim}>
        <SafeAreaView style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text numberOfLines={1} style={styles.modalTitle}>{title}</Text>
            <Pressable accessibilityLabel={t('songs.close')} accessibilityRole="button" onPress={onClose} style={styles.modalClose}><Text style={styles.modalCloseText}>×</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SongInformationModal({ song, visible, onClose }: { song: MobileSong; visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <SheetModal onClose={onClose} title={t('songs.info')} visible={visible}>
      {song.artist ? <View style={styles.infoRow}><Text style={styles.infoLabel}>{t('songs.artist')}</Text><Text style={styles.infoValue}>{song.artist}</Text></View> : null}
      <View style={styles.infoRow}><Text style={styles.infoLabel}>{t('songs.playlist')}</Text><Text style={styles.infoValue}>{song.playlistTitle}</Text></View>
      {song.info ? <Text selectable style={styles.infoText}>{song.info}</Text> : null}
    </SheetModal>
  );
}

function WordCardModal({ word, onClose }: { word: MobileWord | null; onClose: () => void }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  if (!word) return null;
  const alan = displayedAlanWord(word, settings);
  const translation = displayedTranslation(word, settings);
  const examples = displayedExamples(word, settings);
  return (
    <SheetModal onClose={onClose} title={t('songs.word_card')} visible>
      <Text selectable style={styles.wordAlan}>{alan}</Text>
      <Text selectable style={styles.wordTranslation}>{translation}</Text>
      {examples.length ? (
        <View style={styles.examples}>
          <Text style={styles.examplesTitle}>{t('songs.examples')}</Text>
          {examples.map((example, index) => (
            <View key={`${example.example}:${index}`} style={styles.exampleRow}>
              <Text selectable style={styles.exampleAlan}>{example.example}</Text>
              {example.translation ? <Text selectable style={styles.exampleTranslation}>{example.translation}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </SheetModal>
  );
}

function InteractiveSongLine({ line, wordIndex, onWord }: { line: string; wordIndex: Map<string, MobileWord>; onWord: (word: MobileWord) => void }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <Text selectable style={styles.originalLine}>
      {tokenizeSongLine(line).map((token, index) => {
        const word = token.wordLike ? wordIndex.get(token.normalized) : undefined;
        if (!word) return <Text key={`${index}:${token.text}`}>{token.text}</Text>;
        const display = displayedAlanWord(word, settings) || token.text;
        return (
          <Text
            accessibilityLabel={t('songs.open_word', { word: display })}
            accessibilityRole="button"
            key={`${index}:${token.text}`}
            onPress={() => onWord(word)}
            style={styles.interactiveWord}
          >
            {display}
          </Text>
        );
      })}
    </Text>
  );
}

export function SongScreen() {
  const auth = useSession();
  const { t } = useI18n();
  const { settings } = useSettings();
  const params = useLocalSearchParams<{ songId?: string }>();
  const songId = String(params.songId ?? '');
  const [song, setSong] = useState<MobileSong | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [words, setWords] = useState<MobileWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [favoriteError, setFavoriteError] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<MobileWord | null>(null);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    try {
      const [items, favoriteIds, dictionary] = await Promise.all([loadSongs({ force }), loadSongFavorites(auth.user?.id), loadAllWords()]);
      const found = items.find((item) => item.id === songId) ?? null;
      setSong(found);
      setFavorite(favoriteIds.has(songId));
      setWords(dictionary);
      if (found) void trackMobileEvent('song_open', { song_id: found.id, playlist_id: found.playlistId, has_audio: Boolean(found.audioUrl) }, auth.user?.id);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [auth.user?.id, songId]);

  useEffect(() => { void load(); }, [load]);
  const lyricBlocks = useMemo(() => pairLyrics(song?.lyrics, song?.translation), [song?.lyrics, song?.translation]);
  const wordIndex = useMemo(() => buildSongWordIndex(words), [words]);

  const toggleFavorite = async () => {
    if (!song) return;
    setFavoriteError(false);
    try {
      const active = !favorite;
      const ids = await setSongFavorite(auth.user?.id, song.id, active);
      setFavorite(ids.has(song.id));
      void trackMobileEvent(active ? 'favorite_song_add' : 'favorite_song_remove', { song_id: song.id, playlist_id: song.playlistId }, auth.user?.id);
    } catch {
      setFavoriteError(true);
    }
  };

  const openWord = (word: MobileWord) => {
    setSelectedWord(word);
    void trackMobileEvent('word_result', {
      word_id: word.word_id,
      source: 'song',
      result: 'opened',
      dictionary_id: word.dictionary_id || '',
      section_id: word.section_id || '',
      set_id: word.set_id || '',
      direction: 'none',
    }, auth.user?.id);
  };

  if (loading) return <View style={styles.screen}><PracticeHeader title={t('songs.song')} /><Loading /></View>;
  if (error) return <View style={styles.screen}><PracticeHeader title={t('songs.song')} /><ErrorState message={t('songs.load_error')} retry={() => void load(true)} retryLabel={t('common.retry')} /></View>;
  if (!song) return <View style={styles.screen}><PracticeHeader title={t('songs.song')} /><Empty text={t('songs.not_found')} /></View>;

  const infoAction = (
    <Pressable accessibilityLabel={t('songs.info')} accessibilityRole="button" onPress={() => setInfoOpen(true)} style={styles.infoButton}>
      <Text style={styles.infoButtonText}>Info</Text>
    </Pressable>
  );

  return (
    <View style={styles.screen}>
      <PracticeHeader action={infoAction} subtitle={song.artist || undefined} title={song.title} />
      <ScrollView contentContainerStyle={styles.songContent} showsVerticalScrollIndicator={false}>
        <View style={styles.songHead}>
          <View style={styles.songHeadCopy}>
            <Text style={styles.songTitle}>{song.title}</Text>
            {song.artist ? <Text style={styles.songArtist}>{song.artist}</Text> : null}
          </View>
          <StarButton active={favorite} label={favorite ? t('songs.remove_favorite') : t('songs.add_favorite')} onPress={() => void toggleFavorite()} />
        </View>
        {favoriteError ? <Text accessibilityRole="alert" style={styles.inlineError}>{t('songs.favorite_error')}</Text> : null}
        <SongAudioPlayer song={song} userId={auth.user?.id} />
        {lyricBlocks.length ? lyricBlocks.map((block, blockIndex) => (
          <View key={`${block.type}:${blockIndex}`} style={[styles.stanza, block.type === 'chorus' && styles.chorus]}>
            {block.lines.map((line, lineIndex) => (
              <View key={`${blockIndex}:${lineIndex}`} style={styles.linePair}>
                {line.original ? <InteractiveSongLine line={line.original} onWord={openWord} wordIndex={wordIndex} /> : null}
                {line.translation ? <Text selectable style={styles.translatedLine}>{line.translation}</Text> : null}
              </View>
            ))}
          </View>
        )) : <Empty text={t('songs.no_lyrics')} />}
      </ScrollView>
      <SongInformationModal onClose={() => setInfoOpen(false)} song={song} visible={infoOpen} />
      <WordCardModal onClose={() => setSelectedWord(null)} word={selectedWord} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 16, paddingVertical: 8, paddingBottom: 36 },
  listContent: { paddingHorizontal: 16, paddingBottom: 36 },
  center: { minHeight: 160, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 14 },
  emptyTitle: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  error: { color: theme.colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  retryButton: { minHeight: 44, minWidth: 118, paddingHorizontal: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.text },
  retryText: { color: theme.colors.inverse, fontSize: 12, fontWeight: '800' },
  pressed: { opacity: 0.65 },
  playlistRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  favoriteGlyph: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.surface2, alignItems: 'center', justifyContent: 'center' },
  favoriteGlyphText: { color: theme.colors.accentStrong, fontSize: 19 },
  musicGlyph: { width: 42, height: 42, borderRadius: 12, backgroundColor: theme.colors.surface2, alignItems: 'center', justifyContent: 'center' },
  musicGlyphText: { color: theme.colors.accentStrong, fontSize: 22 },
  playlistTitle: { flex: 1, color: theme.colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  chevron: { color: theme.colors.textSoft, fontSize: 26 },
  headerSearch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerSearchActive: { backgroundColor: theme.colors.surface2 },
  headerSearchGlyph: { color: theme.colors.text, fontSize: 25, lineHeight: 27 },
  searchPanel: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, gap: 8 },
  searchInput: { height: 44, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: 'rgba(246,242,233,0.7)', paddingHorizontal: 12, color: theme.colors.text, fontSize: 14 },
  searchModes: { minHeight: 50, padding: 3, borderRadius: 11, backgroundColor: theme.colors.surface2, flexDirection: 'row' },
  searchMode: { flex: 1, minWidth: 0, minHeight: 44, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  searchModeActive: { backgroundColor: theme.colors.surface },
  searchModeText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' },
  searchModeTextActive: { color: theme.colors.text },
  inlineError: { color: theme.colors.danger, fontSize: 11, lineHeight: 16, paddingHorizontal: 16, paddingVertical: 7, textAlign: 'center' },
  songRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  rowCopy: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  rowSubtitle: { color: theme.colors.textMuted, fontSize: 11 },
  starButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  star: { color: theme.colors.textSoft, fontSize: 23 },
  starActive: { color: theme.colors.accentStrong },
  player: { minHeight: 70, borderRadius: 15, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.lineSoft, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  playButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  playButtonPressed: { transform: [{ scale: 0.96 }] },
  playGlyph: { color: theme.colors.inverse, fontSize: 15, fontWeight: '900' },
  playerBody: { flex: 1, minWidth: 0 },
  progressTouch: { minHeight: 24, justifyContent: 'center' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: theme.colors.surface3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.accentStrong },
  timeRow: { marginTop: 2, flexDirection: 'row', justifyContent: 'space-between' },
  time: { color: theme.colors.textSoft, fontSize: 9, fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  playerStatus: { color: theme.colors.textMuted, fontSize: 9, marginTop: 3 },
  audioErrorRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  audioError: { flex: 1, color: theme.colors.danger, fontSize: 9 },
  audioRetry: { color: theme.colors.accentStrong, fontSize: 10, fontWeight: '800', textDecorationLine: 'underline' },
  noAudio: { color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', paddingVertical: 14 },
  songContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 48, gap: 18 },
  songHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  songHeadCopy: { flex: 1, minWidth: 0 },
  songTitle: { color: theme.colors.text, fontSize: 20, fontWeight: '900', lineHeight: 25 },
  songArtist: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  infoButton: { minWidth: 48, height: 44, paddingHorizontal: 7, alignItems: 'center', justifyContent: 'center' },
  infoButtonText: { color: theme.colors.accentStrong, fontSize: 12, fontWeight: '800' },
  stanza: { paddingVertical: 4, gap: 11 },
  chorus: { marginHorizontal: -8, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(139,107,59,0.08)', borderLeftWidth: 3, borderLeftColor: theme.colors.accent },
  linePair: { gap: 3 },
  originalLine: { color: theme.colors.text, fontSize: 16, lineHeight: 25, fontWeight: '600' },
  interactiveWord: { color: theme.colors.accentStrong, textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  translatedLine: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 21 },
  modalScrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,28,24,0.42)' },
  modalSheet: { maxHeight: '84%', minHeight: 260, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: theme.colors.surface },
  modalHeader: { minHeight: 56, paddingLeft: 18, paddingRight: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { flex: 1, color: theme.colors.text, fontSize: 16, fontWeight: '900' },
  modalClose: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  modalCloseText: { color: theme.colors.text, fontSize: 28 },
  modalContent: { padding: 20, paddingBottom: 34, gap: 16 },
  infoRow: { gap: 4 },
  infoLabel: { color: theme.colors.textSoft, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  infoText: { paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.lineSoft, color: theme.colors.textMuted, fontSize: 13, lineHeight: 20 },
  wordAlan: { color: theme.colors.text, fontSize: 30, lineHeight: 38, fontWeight: '900', textAlign: 'center' },
  wordTranslation: { color: theme.colors.textMuted, fontSize: 17, lineHeight: 24, textAlign: 'center' },
  examples: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.lineSoft, gap: 12 },
  examplesTitle: { color: theme.colors.text, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  exampleRow: { gap: 3 },
  exampleAlan: { color: theme.colors.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  exampleTranslation: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
});
