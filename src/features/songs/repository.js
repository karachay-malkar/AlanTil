import { SONGS_CACHE_KEY, SONGS_SHEET_URL } from "../../config/songs.js?v=13.8";
import { normalizeToCsvUrl, parseCsvRows } from "../../shared/data/csv.js?v=13.8";
import { readJson, writeJson } from "../../shared/state/storage.js?v=13.8";

let songs = null;
let loadingPromise = null;
let requestCount = 0;

function first(row, names, fallback = "") {
  for (const name of names) {
    const value = row?.[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return String(value).trim();
  }
  return fallback;
}

function toNumber(value, fallback = 0) {
  const number = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(number) ? number : fallback;
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeSong(row, index = 0) {
  if (!row || typeof row !== "object") return null;

  const title = first(row, ["title", "song", "song_title", "song_name", "name", "название", "песня"]);
  const playlistTitle = first(row, ["playlist_title", "playlistTitle", "playlist_name", "playlist", "album", "плейлист", "сборник"], "Песни");
  const playlistId = first(row, ["playlist_id", "playlistId", "playlist_code", "album_id"], slug(playlistTitle) || "songs");
  const id = first(row, ["id", "song_id", "code"], `${playlistId}-${slug(title) || index + 1}`);
  const lyrics = first(row, ["lyrics", "lyrics_kb", "lyrics_alan", "text_kb", "original_text", "text", "song_text", "alan_text", "текст"]);
  const translation = first(row, ["translation", "lyrics_ru", "text_ru", "russian_text", "translation_text", "trans", "перевод"]);

  if (!id || !title) return null;

  return {
    id,
    title,
    artist: first(row, ["artist", "performer", "performer_name", "singer", "author", "исполнитель", "автор"]),
    audioUrl: first(row, ["audio_url", "audioUrl", "audio_link", "audio_src", "audio", "mp3", "file_url", "ссылка_аудио"]),
    lyrics,
    translation,
    info: first(row, ["info", "description", "about", "note", "информация", "описание"]),
    order: toNumber(first(row, ["song_order", "order", "position", "порядок"]), index + 1),
    playlistId,
    playlistTitle,
    playlistDescription: first(row, ["playlist_description", "playlistDescription", "playlist_info", "album_description", "описание_плейлиста"]),
    playlistOrder: toNumber(first(row, ["playlist_order", "playlistOrder", "album_order", "порядок_плейлиста"]), 0),
    coverUrl: first(row, ["cover_url", "coverUrl", "cover", "image_url", "обложка"]),
    metadata: first(row, ["metadata", "tags", "keywords", "метаданные"]),
  };
}

function normalizeCollection(collection) {
  const normalized = (Array.isArray(collection) ? collection : [])
    .map((row, index) => normalizeSong(row, index))
    .filter(Boolean);
  const unique = new Map();
  normalized.forEach((song) => unique.set(song.id, song));
  return Array.from(unique.values()).sort((left, right) =>
    left.playlistOrder - right.playlistOrder
    || left.playlistTitle.localeCompare(right.playlistTitle, "ru")
    || left.order - right.order
    || left.title.localeCompare(right.title, "ru"));
}

async function fetchSongs() {
  const csvUrl = normalizeToCsvUrl(SONGS_SHEET_URL);
  if (!csvUrl || !csvUrl.startsWith("http")) return [];
  requestCount += 1;
  const response = await fetch(csvUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Songs CSV load failed: ${response.status}`);
  const parsed = parseCsvRows(await response.text());
  return normalizeCollection(parsed.rows);
}

export async function getSongs() {
  if (songs) return songs;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const cached = normalizeCollection(readJson(SONGS_CACHE_KEY, null));
    if (cached.length) {
      songs = cached;
      return songs;
    }

    try {
      const remote = await fetchSongs();
      if (remote.length) {
        songs = remote;
        writeJson(SONGS_CACHE_KEY, songs);
        return songs;
      }
    } catch (error) {
      console.warn("songs-repository: fetch failed", error);
    }

    songs = [];
    return songs;
  })().finally(() => {
    loadingPromise = null;
  });

  return loadingPromise;
}

export async function getSongById(songId) {
  const collection = await getSongs();
  return collection.find((song) => song.id === String(songId || "")) || null;
}

export async function getSongsByPlaylist(playlistId) {
  const collection = await getSongs();
  return collection.filter((song) => song.playlistId === String(playlistId || ""));
}

export async function getPlaylists() {
  const collection = await getSongs();
  const grouped = new Map();

  collection.forEach((song) => {
    if (!grouped.has(song.playlistId)) {
      grouped.set(song.playlistId, {
        id: song.playlistId,
        title: song.playlistTitle,
        description: song.playlistDescription,
        order: song.playlistOrder,
        coverUrl: song.coverUrl,
        count: 0,
      });
    }
    grouped.get(song.playlistId).count += 1;
  });

  return Array.from(grouped.values()).sort((left, right) =>
    left.order - right.order || left.title.localeCompare(right.title, "ru"));
}

export function clearSongsCache() {
  songs = null;
  loadingPromise = null;
  try {
    localStorage.removeItem(SONGS_CACHE_KEY);
  } catch {
    // Storage may be unavailable in private or restricted WebViews.
  }
}

export function getSongsRepositoryDiagnostics() {
  return { requestCount, cached: Array.isArray(songs), size: songs?.length || 0 };
}
