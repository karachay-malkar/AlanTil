import { applyAlanCyrillicDialect } from './alan-display.js';

const CHORUS_MARKER = /^(?:припев|рефрен|chorus|къайтарыу|къайтарыуу|кайтарыу)\s*\d*\s*[:.]?$/iu;
const VERSE_MARKER = /^(?:куплет|строфа|verse)\s*\d*\s*[:.]?$/iu;

export function normalizeSongToken(value) {
  return String(value || '')
    .normalize('NFC')
    .toLocaleLowerCase('ru')
    .replace(/[’‘`]/g, "'")
    .replace(/^[-'’]+|[-'’]+$/g, '')
    .trim();
}

export function songWordForms(word) {
  const canonicalCyrillic = String(word?.wordAlanCyrillic || '');
  return [
    word?.word,
    canonicalCyrillic,
    applyAlanCyrillicDialect(canonicalCyrillic, 'karachay'),
    applyAlanCyrillicDialect(canonicalCyrillic, 'balkar'),
    word?.wordAlanTurkic,
  ]
    .flatMap((value) => String(value || '').split(/\s*[\/|]\s*/g).map(normalizeSongToken))
    .filter(Boolean);
}

export function buildSongWordIndex(words) {
  const index = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    songWordForms(word).forEach((form) => {
      if (!index.has(form)) index.set(form, word);
    });
  });
  return index;
}

function cleanLines(rawBlock) {
  return String(rawBlock || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

export function parseLyricsBlocks(text) {
  const source = String(text || '').replace(/\r\n?/g, '\n').trim();
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

export function tokenizeSongLine(line, wordIndex = new Map()) {
  const tokens = String(line || '').match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*|[^\p{L}\p{M}]+/gu) || [];
  return tokens.map((token) => ({ token, word: wordIndex.get(normalizeSongToken(token)) || null }));
}

export function buildSongLyricsModel(lyrics, translation, words) {
  const originalBlocks = parseLyricsBlocks(lyrics);
  if (!originalBlocks.length) return [];
  const translationBlocks = parseLyricsBlocks(translation);
  const wordIndex = buildSongWordIndex(words);
  return originalBlocks.map((block, index) => {
    const translatedBlock = translationBlocks[index] || null;
    return {
      type: block.type === 'chorus' || translatedBlock?.type === 'chorus' ? 'chorus' : 'verse',
      repeated: Boolean(block.repeated),
      originalLines: block.lines.map((line) => ({ text: line, tokens: tokenizeSongLine(line, wordIndex) })),
      translationLines: (translatedBlock?.lines || []).map((line) => String(line)),
      paired: block.lines.length === (translatedBlock?.lines || []).length && (translatedBlock?.lines || []).length > 0,
    };
  });
}
