export type LyricsBlock = { type: 'verse' | 'chorus'; lines: string[]; repeated: boolean };
export type PairedLyricsBlock = {
  type: 'verse' | 'chorus';
  repeated: boolean;
  lines: { original: string; translation: string }[];
};
export type SongLineToken = { text: string; normalized: string; wordLike: boolean };
export type SongSearchMode = 'title' | 'artist' | 'lyrics';
export type SongLike = { title?: unknown; artist?: unknown; lyrics?: unknown };
export type SongWordLike = {
  word?: unknown;
  word_alan_cyrillic?: unknown;
  wordAlanCyrillic?: unknown;
  word_alan_turkic?: unknown;
  wordAlanTurkic?: unknown;
  [key: string]: unknown;
};

export const SONG_PROGRESS_THRESHOLDS: readonly number[];
export function normalizeSongToken(value: unknown): string;
export function parseLyricsBlocks(text: unknown): LyricsBlock[];
export function pairLyrics(lyrics: unknown, translation: unknown): PairedLyricsBlock[];
export function tokenizeSongLine(line: unknown): SongLineToken[];
export function defaultSongWordForms(word: SongWordLike): string[];
export function buildSongWordIndex<T extends SongWordLike>(words: T[], getForms?: (word: T) => string[]): Map<string, T>;
export function filterSongs<T extends SongLike>(songs: T[], query: string, mode?: SongSearchMode): T[];
export function crossedSongThresholds(currentTime: number, duration: number, seen?: ReadonlySet<number>): number[];
