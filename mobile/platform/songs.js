import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeGoogleSheetCsvUrl, parseCsvRows } from '../../packages/alantil-core/csv.js';
import { normalizeSongCollection } from '../../packages/alantil-core/song-catalog.js';

const SONGS_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1aQseG2yQfeZiAbxX0dmhnoP7IkoR4w-N/edit?usp=drivesdk&ouid=111397706846712470648&rtpof=true&sd=true';
const CACHE_KEY = 'alantil:16.1:songs-cache-v2';
const TIMEOUT_MS = 8000;

export async function loadNativeSongs() {
  try {
    const cachedRaw = await AsyncStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      const cached = normalizeSongCollection(JSON.parse(cachedRaw));
      if (cached.length) return cached;
    }
  } catch {}

  const url = normalizeGoogleSheetCsvUrl(SONGS_SHEET_URL);
  if (!url) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url,{signal:controller.signal,headers:{Accept:'text/csv'}});
    if (!response.ok) throw new Error(`Songs CSV load failed: ${response.status}`);
    const parsed = parseCsvRows(await response.text());
    const songs = normalizeSongCollection(parsed.rows);
    if (songs.length) await AsyncStorage.setItem(CACHE_KEY,JSON.stringify(songs));
    return songs;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
