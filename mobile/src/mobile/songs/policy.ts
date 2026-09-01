import type { MobileWord } from '@/src/mobile/dictionary';
import type { MobileSong, SongSearchMode } from '@/src/mobile/songs/repository';

const CHORUS_MARKER = /^(?:припев|рефрен|chorus|nakarat|kъaytaryu|къайтарыу|къайтарыуу|кайтарыу)\s*\d*\s*[:.]?$/iu;
const VERSE_MARKER = /^(?:куплет|строфа|verse|kıta|kita)\s*\d*\s*[:.]?$/iu;
export const SONG_PROGRESS_THRESHOLDS = [25, 50, 75, 90] as const;

export type LyricsBlock = { type: 'verse' | 'chorus'; lines: string[]; repeated: boolean };
export type PairedLyricsBlock = {
  type: 'verse' | 'chorus';
  repeated: boolean;
  lines: { original: string; translation: string }[];
};
export type SongLineToken = { text: string; normalized: string; wordLike: boolean };

export function normalizeSongToken(value: unknown) {
  return String(value ?? '').normalize('NFC').toLocaleLowerCase('ru').replace(/[’‘`]/g, "'").replace(/^[-'’]+|[-'’]+$/g, '').trim();
}

function cleanLines(rawBlock: string) {
  return String(rawBlock || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

export function parseLyricsBlocks(text: unknown): LyricsBlock[] {
  const source = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const blocks: LyricsBlock[] = [];
  let lastChorus: string[] | null = null;
  source.split(/\n\s*\n+/g).forEach((rawBlock) => {
    const lines = cleanLines(rawBlock);
    if (!lines.length) return;
    if (CHORUS_MARKER.test(lines[0])) {
      const chorusLines = lines.slice(1);
      if (chorusLines.length) {
        lastChorus = chorusLines;
        blocks.push({ type: 'chorus', lines: chorusLines, repeated: false });
      } else if (lastChorus?.length) blocks.push({ type: 'chorus', lines: [...lastChorus], repeated: true });
      return;
    }
    if (VERSE_MARKER.test(lines[0])) {
      const verseLines = lines.slice(1);
      if (verseLines.length) blocks.push({ type: 'verse', lines: verseLines, repeated: false });
      return;
    }
    blocks.push({ type: 'verse', lines, repeated: false });
  });
  return blocks;
}

export function pairLyrics(lyrics: unknown, translation: unknown): PairedLyricsBlock[] {
  const originals = parseLyricsBlocks(lyrics);
  const translations = parseLyricsBlocks(translation);
  return originals.map((block, blockIndex) => {
    const translated = translations[blockIndex];
    const count = Math.max(block.lines.length, translated?.lines.length ?? 0);
    return {
      type: block.type === 'chorus' || translated?.type === 'chorus' ? 'chorus' : 'verse',
      repeated: block.repeated,
      lines: Array.from({ length: count }, (_, lineIndex) => ({
        original: block.lines[lineIndex] ?? '',
        translation: translated?.lines[lineIndex] ?? '',
      })),
    };
  });
}

export function tokenizeSongLine(line: unknown): SongLineToken[] {
  const tokens = String(line ?? '').match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*|[^\p{L}\p{M}]+/gu) || [];
  return tokens.map((text) => ({ text, normalized: normalizeSongToken(text), wordLike: /[\p{L}\p{M}]/u.test(text) }));
}

export function wordForms(word: MobileWord) {
  const cyrillic = String(word.word_alan_cyrillic ?? '');
  return [
    cyrillic,
    cyrillic.replaceAll('Җ', 'Ж').replaceAll('җ', 'ж'),
    cyrillic.replaceAll('Җ', 'Дж').replaceAll('җ', 'дж'),
    word.word_alan_turkic,
  ].flatMap((value) => String(value ?? '').split(/\s*[\/|]\s*/g).map(normalizeSongToken)).filter(Boolean);
}

export function buildSongWordIndex(words: MobileWord[]) {
  const index = new Map<string, MobileWord>();
  words.forEach((word) => wordForms(word).forEach((form) => {
    if (!index.has(form)) index.set(form, word);
  }));
  return index;
}

export function filterSongs(songs: MobileSong[], query: string, mode: SongSearchMode) {
  const normalizedQuery = normalizeSongToken(query).replace(/\s+/g, ' ');
  if (!normalizedQuery) return songs;
  return songs.filter((song) => {
    const value = mode === 'artist' ? song.artist : mode === 'lyrics' ? song.lyrics : song.title;
    return normalizeSongToken(value).replace(/\s+/g, ' ').includes(normalizedQuery);
  });
}

export function crossedSongThresholds(currentTime: number, duration: number, seen: ReadonlySet<number>) {
  if (!Number.isFinite(duration) || duration <= 0) return [] as number[];
  const percent = (Math.max(0, currentTime) / duration) * 100;
  return SONG_PROGRESS_THRESHOLDS.filter((threshold) => percent >= threshold && !seen.has(threshold));
}
