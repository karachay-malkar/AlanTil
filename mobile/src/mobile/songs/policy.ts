import type { MobileWord } from '@/src/mobile/dictionary';
import type { MobileSong, SongSearchMode } from '@/src/mobile/songs/repository';
import {
  SONG_PROGRESS_THRESHOLDS,
  buildSongWordIndex as buildSharedSongWordIndex,
  crossedSongThresholds,
  defaultSongWordForms,
  filterSongs as filterSharedSongs,
  normalizeSongToken,
  pairLyrics,
  parseLyricsBlocks,
  tokenizeSongLine,
} from '../../../../packages/alantil-core/songs.js';
import type {
  LyricsBlock,
  PairedLyricsBlock,
  SongLineToken,
} from '../../../../packages/alantil-core/songs.js';

export { SONG_PROGRESS_THRESHOLDS, crossedSongThresholds, normalizeSongToken, pairLyrics, parseLyricsBlocks, tokenizeSongLine };
export type { LyricsBlock, PairedLyricsBlock, SongLineToken };

export function wordForms(word: MobileWord) {
  return defaultSongWordForms(word);
}

export function buildSongWordIndex(words: MobileWord[]) {
  return buildSharedSongWordIndex(words, wordForms);
}

export function filterSongs(songs: MobileSong[], query: string, mode: SongSearchMode) {
  return filterSharedSongs(songs, query, mode);
}
