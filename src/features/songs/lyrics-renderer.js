import { escapeHtml } from "../../shared/ui/word-renderers.js";
import { applyAlanCyrillicDialect } from "../../shared/domain/alan-display.js";

const CHORUS_MARKER = /^(?:припев|рефрен|chorus|къайтарыу|къайтарыуу|кайтарыу)\s*\d*\s*[:.]?$/iu;
const VERSE_MARKER = /^(?:куплет|строфа|verse)\s*\d*\s*[:.]?$/iu;

function normalizeToken(value) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase("ru")
    .replace(/[’‘`]/g, "'")
    .replace(/^[-'’]+|[-'’]+$/g, "")
    .trim();
}

function wordForms(word) {
  const canonicalCyrillic = String(word?.wordAlanCyrillic || "");
  return [
    word?.word,
    canonicalCyrillic,
    applyAlanCyrillicDialect(canonicalCyrillic, "karachay"),
    applyAlanCyrillicDialect(canonicalCyrillic, "balkar"),
    word?.wordAlanTurkic,
  ]
    .flatMap((value) => String(value || "")
    .split(/\s*[\/|]\s*/g)
    .map(normalizeToken))
    .filter(Boolean);
}

function buildWordIndex(words) {
  const index = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    wordForms(word).forEach((form) => {
      if (!index.has(form)) index.set(form, word);
    });
  });
  return index;
}

function cleanLines(rawBlock) {
  return String(rawBlock || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function parseLyricsBlocks(text) {
  const source = String(text || "")
    .replace(/\r\n?/g, "\n")
    .trim();
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
        blocks.push({ type: "chorus", lines: chorusLines, repeated: false });
      } else if (lastChorus?.length) {
        blocks.push({ type: "chorus", lines: [...lastChorus], repeated: true });
      }
      return;
    }

    if (VERSE_MARKER.test(lines[0])) {
      const verseLines = lines.slice(1);
      if (verseLines.length) blocks.push({ type: "verse", lines: verseLines, repeated: false });
      return;
    }

    blocks.push({ type: "verse", lines, repeated: false });
  });

  return blocks;
}

function renderInteractiveLine(line, wordIndex) {
  const tokens = String(line || "").match(/[\p{L}\p{M}]+(?:[-’'][\p{L}\p{M}]+)*|[^\p{L}\p{M}]+/gu) || [];
  return tokens.map((token) => {
    const word = wordIndex.get(normalizeToken(token));
    if (!word) return escapeHtml(token);
    return `<button class="songWord" type="button" data-word-id="${escapeHtml(word.id)}">${escapeHtml(token)}</button>`;
  }).join("");
}

function renderPairedLines(originalLines, translationLines, wordIndex) {
  if (!translationLines.length) {
    return originalLines.map((line) => `
      <div class="songLinePair">
        <div class="songOriginalLine">${renderInteractiveLine(line, wordIndex)}</div>
      </div>`).join("");
  }

  if (originalLines.length === translationLines.length) {
    return originalLines.map((line, index) => `
      <div class="songLinePair">
        <div class="songOriginalLine">${renderInteractiveLine(line, wordIndex)}</div>
        <div class="songTranslatedLine">${escapeHtml(translationLines[index])}</div>
      </div>`).join("");
  }

  return `
    <div class="songOriginalStanza">
      ${originalLines.map((line) => `<div class="songOriginalLine">${renderInteractiveLine(line, wordIndex)}</div>`).join("")}
    </div>
    <div class="songTranslationStanza">
      ${translationLines.map((line) => `<div class="songTranslatedLine">${escapeHtml(line)}</div>`).join("")}
    </div>`;
}

export function renderSongLyrics(lyrics, translation, words) {
  const originalBlocks = parseLyricsBlocks(lyrics);
  if (!originalBlocks.length) return "";

  const translationBlocks = parseLyricsBlocks(translation);
  const wordIndex = buildWordIndex(words);

  return originalBlocks.map((block, index) => {
    const translatedBlock = translationBlocks[index] || null;
    const translationLines = translatedBlock?.lines || [];
    const isChorus = block.type === "chorus" || translatedBlock?.type === "chorus";
    return `
      <section class="songStanza${isChorus ? " songStanzaChorus" : ""}">
        ${renderPairedLines(block.lines, translationLines, wordIndex)}
      </section>`;
  }).join("");
}
