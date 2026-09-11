import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeGoogleSheetCsvUrl, parseCsvRows } from '../../packages/alantil-core/csv.js';
import { normalizeSongCollection } from '../../packages/alantil-core/song-catalog.js';

const SONGS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1aQseG2yQfeZiAbxX0dmhnoP7IkoR4w-N/edit?usp=drivesdk&ouid=111397706846712470648&rtpof=true&sd=true';
const CACHE_KEY = 'alantil:16.1:songs-cache-v2';
const TIMEOUT_MS = 8000;

const CACHE_TTL_MS = 60 * 60 * 1000;
let refreshPromise = null;

async function refreshSongs() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(normalizeGoogleSheetCsvUrl(SONGS_SHEET_URL), {
        signal: controller.signal, headers: {Accept: 'text/csv'},
      });
      if (!response.ok) throw new Error(`Songs CSV load failed: ${response.status}`);
      const parsed = parseCsvRows(await response.text());
      const titleHeaders = ['title','song','song_title','song_name','name','название','песня'];
      if (!parsed.headers.some(header => titleHeaders.includes(header))) throw new Error('Invalid songs catalog');
      const songs = normalizeSongCollection(parsed.rows);
      if (parsed.rows.length && !songs.length) throw new Error('Invalid songs rows');
      // A failed cache write must not hide a successfully downloaded catalog.
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({songs, fetchedAt: Date.now()})).catch(() => {});
      return songs;
    } finally {
      clearTimeout(timer);
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}

export async function loadNativeSongs({force=false,onCached,onWarning}={}) {
  let cached = null, fetchedAt = 0;
  try {
    const value = JSON.parse(await AsyncStorage.getItem(CACHE_KEY));
    const rows = Array.isArray(value) ? value : value?.songs;
    if (Array.isArray(rows)) {
      const normalized = normalizeSongCollection(rows);
      if (!rows.length || normalized.length) cached = normalized;
      fetchedAt = Array.isArray(value) ? 0 : Number(value?.fetchedAt || 0);
    }
  } catch {}
  const age = Date.now() - fetchedAt;
  if (!force && cached !== null && fetchedAt > 0 && age >= 0 && age < CACHE_TTL_MS) return cached;
  if (cached !== null) onCached?.(cached);
  try {
    return await refreshSongs();
  } catch (error) {
    if (cached !== null) { onWarning?.(error); return cached; }
    throw error;
  }
}
