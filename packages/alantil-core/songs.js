const CHORUS_MARKER = /^(?:припев|рефрен|chorus|nakarat|kъaytaryu|къайтарыу|къайтарыуу|кайтарыу)\s*\d*\s*[:.]?$/iu;
const VERSE_MARKER = /^(?:куплет|строфа|verse|kıta|kita)\s*\d*\s*[:.]?$/iu;

export const SONG_PROGRESS_THRESHOLDS = Object.freeze([25, 50, 75, 90]);

export function normalizeSongToken(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLocaleLowerCase('ru')
    .replace(/[’‘`]/g, "'")
    .replace(/^[-'’]+|[-'’]+$/g, '')
    .trim();
}

function cleanLines(rawBlock) {
  return String(rawBlock || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

export function parseLyricsBlocks(text) {
  const source = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!source) return [];
  const blocks = [];
  let lastChorus = null;
  source.split(/\n\s*\n+/g).forEach((rawBlock) => {
    const lines = cleanLines(rawBlock);
    if (!lines.length) return;
    if (CHORUS_MARKER.test(lines[0])) {
      const chorusLines = lines.slice(1);
      if (chorusLines.length) {
        lastChorus = chorusLines;
        blocks.push({ type: 'chorus', lines: chorusLines, repeated: false });
      } else if (lastChorus?.length) {
        blocks.push({ type: 'chorus', lines: [...lastChorus], repeated: true });
      }
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

export function pairLyrics(lyrics, translation) {
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

export function tokenizeSongLine(line) {
  const tokens = String(line ?? '').match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*|[^\p{L}\p{M}]+/gu) || [];
  return tokens.map((text) => ({
    text,
    normalized: normalizeSongToken(text),
    wordLike: /[\p{L}\p{M}]/u.test(text),
  }));
}

export function defaultSongWordForms(word) {
  const cyrillic = String(word?.word_alan_cyrillic ?? word?.wordAlanCyrillic ?? word?.word ?? '');
  const turkic = word?.word_alan_turkic ?? word?.wordAlanTurkic ?? '';
  return [
    word?.word ?? '',
    cyrillic,
    cyrillic.replaceAll('Җ', 'Ж').replaceAll('җ', 'ж'),
    cyrillic.replaceAll('Җ', 'Дж').replaceAll('җ', 'дж'),
    turkic,
  ].flatMap((value) => String(value ?? '').split(/\s*[\/|]\s*/g).map(normalizeSongToken)).filter(Boolean);
}

export function buildSongWordIndex(words, getForms = defaultSongWordForms) {
  const index = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    const forms = getForms(word) || [];
    forms.map(normalizeSongToken).filter(Boolean).forEach((form) => {
      if (!index.has(form)) index.set(form, word);
    });
  });
  return index;
}

export function filterSongs(songs, query, mode = 'title') {
  const normalizedQuery = normalizeSongToken(query).replace(/\s+/g, ' ');
  if (!normalizedQuery) return Array.isArray(songs) ? songs : [];
  return (Array.isArray(songs) ? songs : []).filter((song) => {
    const value = mode === 'artist' ? song?.artist : mode === 'lyrics' ? song?.lyrics : song?.title;
    return normalizeSongToken(value).replace(/\s+/g, ' ').includes(normalizedQuery);
  });
}

export function crossedSongThresholds(currentTime, duration, seen = new Set()) {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const percent = (Math.max(0, Number(currentTime) || 0) / duration) * 100;
  return SONG_PROGRESS_THRESHOLDS.filter((threshold) => percent >= threshold && !seen.has(threshold));
}
