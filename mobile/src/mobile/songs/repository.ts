import AsyncStorage from '@react-native-async-storage/async-storage';

import { readScopedJson, STORAGE_KEYS, updateScopedJson } from '@/src/mobile/storage';
import { enqueueSync } from '@/src/mobile/sync';

const SONGS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1aQseG2yQfeZiAbxX0dmhnoP7IkoR4w-N/edit';
const SONGS_CACHE_KEY = 'fc_songs_cache_v2';
const REQUEST_TIMEOUT_MS = 8000;
const FAVORITES_PLAYLIST_ID = '__fav__';

export type MobileSong = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  lyrics: string;
  translation: string;
  info: string;
  order: number;
  playlistId: string;
  playlistTitle: string;
  playlistDescription: string;
  playlistOrder: number;
};

export type MobilePlaylist = {
  id: string;
  title: string;
  description: string;
  order: number;
};

export type SongSearchMode = 'title' | 'artist' | 'lyrics';

export type SongCatalogState = {
  searchOpen: boolean;
  query: string;
  mode: SongSearchMode;
  scrollOffset: number;
  updated_at: string;
};

const DEFAULT_CATALOG_STATE: SongCatalogState = {
  searchOpen: false,
  query: '',
  mode: 'title',
  scrollOffset: 0,
  updated_at: '',
};

let songsCache: MobileSong[] | null = null;
let refreshPromise: Promise<MobileSong[]> | null = null;

function csvUrl(value: string) {
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? `https://docs.google.com/spreadsheets/d/${match[1]}/gviz/tq?tqx=out:csv` : value;
}

export function parseSongCsv(text: string) {
  const matrix: string[][] = [];
  let row: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (character === '"' && next === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else current += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') {
      row.push(current);
      current = '';
    } else if (character === '\n') {
      row.push(current);
      matrix.push(row);
      row = [];
      current = '';
    } else if (character !== '\r') current += character;
  }
  if (current.length || row.length) {
    row.push(current);
    matrix.push(row);
  }
  if (!matrix.length) return [] as Record<string, string>[];
  const headers = matrix[0].map((value, index) => String(value || '').trim().toLowerCase().replace(index === 0 ? /^\uFEFF/ : /$^/, ''));
  return matrix.slice(1).filter((columns) => columns.some((value) => String(value || '').trim())).map((columns) => {
    const result: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) result[header] = columns[index] ?? '';
    });
    return result;
  });
}

function first(row: Record<string, string>, names: string[], fallback = '') {
  for (const name of names) {
    const value = String(row[name] ?? '').trim();
    if (value) return value;
  }
  return fallback;
}

function numberValue(value: string, fallback: number) {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function slug(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

function normalizeSong(row: Record<string, string>, index: number): MobileSong | null {
  const title = first(row, ['title', 'song', 'song_title', 'song_name', 'name', 'название', 'песня']);
  const playlistTitle = first(row, ['playlist_title', 'playlisttitle', 'playlist_name', 'playlist', 'album', 'плейлист', 'сборник'], 'Songs');
  const playlistId = first(row, ['playlist_id', 'playlistid', 'playlist_code', 'album_id'], slug(playlistTitle) || 'songs');
  const id = first(row, ['id', 'song_id', 'code'], `${playlistId}-${slug(title) || index + 1}`);
  if (!id || !title) return null;
  return {
    id,
    title,
    artist: first(row, ['artist', 'performer', 'performer_name', 'singer', 'author', 'исполнитель', 'автор']),
    audioUrl: first(row, ['audio_url', 'audiourl', 'audio_link', 'audio_src', 'audio', 'mp3', 'file_url', 'ссылка_аудио']),
    lyrics: first(row, ['lyrics', 'lyrics_kb', 'lyrics_alan', 'text_kb', 'original_text', 'text', 'song_text', 'alan_text', 'текст']),
    translation: first(row, ['translation', 'lyrics_ru', 'text_ru', 'russian_text', 'translation_text', 'trans', 'перевод']),
    info: first(row, ['info', 'description', 'about', 'note', 'информация', 'описание']),
    order: numberValue(first(row, ['song_order', 'order', 'position', 'порядок']), index + 1),
    playlistId,
    playlistTitle,
    playlistDescription: first(row, ['playlist_description', 'playlistdescription', 'playlist_info', 'album_description', 'описание_плейлиста']),
    playlistOrder: numberValue(first(row, ['playlist_order', 'playlistorder', 'album_order', 'порядок_плейлиста']), 0),
  };
}

function normalizeSongs(values: unknown): MobileSong[] {
  if (!Array.isArray(values)) return [];
  const unique = new Map<string, MobileSong>();
  values.forEach((value, index) => {
    const song = normalizeSong((value ?? {}) as Record<string, string>, index);
    if (song) unique.set(song.id, song);
  });
  return Array.from(unique.values()).sort((left, right) => left.playlistOrder - right.playlistOrder
    || left.playlistTitle.localeCompare(right.playlistTitle, 'ru')
    || left.order - right.order
    || left.title.localeCompare(right.title, 'ru'));
}

async function fetchSongs() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(csvUrl(SONGS_SHEET_URL), { headers: { Accept: 'text/csv' }, signal: controller.signal });
    if (!response.ok) throw new Error(`songs_http_${response.status}`);
    const songs = normalizeSongs(parseSongCsv(await response.text()));
    if (!songs.length) throw new Error('songs_empty');
    await AsyncStorage.setItem(SONGS_CACHE_KEY, JSON.stringify(songs));
    songsCache = songs;
    return songs;
  } finally {
    clearTimeout(timer);
  }
}

export async function refreshSongs() {
  if (!refreshPromise) refreshPromise = fetchSongs().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function loadSongs({ force = false } = {}) {
  if (force) return refreshSongs();
  if (songsCache) return songsCache;
  let cached: MobileSong[] = [];
  try {
    const raw = await AsyncStorage.getItem(SONGS_CACHE_KEY);
    cached = normalizeSongs(raw ? JSON.parse(raw) : []);
  } catch { /* A corrupt cache falls through to the network. */ }
  if (cached.length) {
    songsCache = cached;
    void refreshSongs().catch(() => undefined);
    return cached;
  }
  return refreshSongs();
}

export function playlistsFrom(songs: MobileSong[]): MobilePlaylist[] {
  const map = new Map<string, MobilePlaylist>();
  songs.forEach((song) => {
    if (!map.has(song.playlistId)) map.set(song.playlistId, {
      id: song.playlistId,
      title: song.playlistTitle,
      description: song.playlistDescription,
      order: song.playlistOrder,
    });
  });
  return Array.from(map.values()).sort((left, right) => left.order - right.order || left.title.localeCompare(right.title, 'ru'));
}

export async function loadSongFavorites(userId?: string | null) {
  return new Set((await readScopedJson<string[]>(STORAGE_KEYS.songFavorites, [], userId)).map(String).map((value) => value.trim()).filter(Boolean));
}

export async function setSongFavorite(userId: string | null | undefined, songId: string, active: boolean) {
  const id = String(songId ?? '').trim();
  const values = await updateScopedJson<string[]>(STORAGE_KEYS.songFavorites, [], (current) => {
    const next = new Set(current.map(String).map((value) => value.trim()).filter(Boolean));
    if (active) next.add(id);
    else next.delete(id);
    return Array.from(next);
  }, userId);
  if (id) await enqueueSync('song_favorite', { song_id: id, is_active: active, updated_at: new Date().toISOString() }, userId, { entryId: `song_favorite:${id}` });
  return new Set(values);
}

function validMode(value: unknown): SongSearchMode {
  return value === 'artist' || value === 'lyrics' ? value : 'title';
}

export async function readSongCatalogState(userId: string | null | undefined, playlistId: string) {
  const states = await readScopedJson<Record<string, Partial<SongCatalogState>>>(STORAGE_KEYS.songsCatalogState, {}, userId);
  const state = states[playlistId] ?? {};
  return {
    ...DEFAULT_CATALOG_STATE,
    ...state,
    mode: validMode(state.mode),
    query: String(state.query ?? ''),
    searchOpen: Boolean(state.searchOpen),
    scrollOffset: Math.max(0, Number(state.scrollOffset) || 0),
  } satisfies SongCatalogState;
}

export async function writeSongCatalogState(userId: string | null | undefined, playlistId: string, state: Omit<SongCatalogState, 'updated_at'>) {
  await updateScopedJson<Record<string, SongCatalogState>>(STORAGE_KEYS.songsCatalogState, {}, (current) => ({
    ...current,
    [playlistId]: { ...state, updated_at: new Date().toISOString() },
  }), userId);
}

export { FAVORITES_PLAYLIST_ID };
