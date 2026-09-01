const PRIORITY_POS = ['noun', 'verb', 'adjective', 'adverb'];
const PRIORITY_POS_SET = new Set(PRIORITY_POS);

export function normalizeId(value) {
  return String(value ?? '').normalize('NFC').trim();
}

export function normalizePos(value) {
  return String(value ?? '').normalize('NFC').trim().toLowerCase();
}

export function uniq(values) {
  return Array.from(new Set(values));
}

export function shuffle(values) {
  const array = values;
  for (let index = array.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [array[index], array[randomIndex]] = [array[randomIndex], array[index]];
  }
  return array;
}

export function splitGroups(value) {
  return String(value ?? '')
    .split(/\s*[;；]\s*|\n+/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.replace(/^\s*\d+\s*(?:[.)]|[-–—])\s*/, '').trim());
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function translationSet(item) {
  return new Set(splitGroups(item?.trans).map((entry) => entry.toLowerCase()).filter(Boolean));
}

function synonymSet(item) {
  return new Set((Array.isArray(item?.synonyms) ? item.synonyms : [])
    .map((entry) => String(entry ?? '').trim().toLowerCase())
    .filter(Boolean));
}

export function hasWordConflict(candidate, selected) {
  const translations = translationSet(candidate);
  const synonyms = synonymSet(candidate);
  return selected.some((item) => {
    if (!item) return false;
    const itemTranslations = translationSet(item);
    for (const translation of translations) {
      if (itemTranslations.has(translation)) return true;
    }
    const itemSynonyms = synonymSet(item);
    for (const synonym of synonyms) {
      if (itemSynonyms.has(synonym)) return true;
    }
    return false;
  });
}

export function buildRoundPOSList(pool, roundsCount) {
  const allPOS = uniq((Array.isArray(pool) ? pool : []).map((word) => normalizePos(word?.pos)).filter(Boolean));
  const priorityPOS = allPOS.filter((pos) => PRIORITY_POS_SET.has(pos));
  const otherPOS = allPOS.filter((pos) => !PRIORITY_POS_SET.has(pos));
  const otherRoundsCount = Math.min(roundsCount, Math.round(roundsCount * 0.1));
  const priorityRoundsCount = roundsCount - otherRoundsCount;
  const result = [];

  for (let index = 0; index < priorityRoundsCount; index += 1) {
    const fallback = otherPOS.length ? otherPOS : PRIORITY_POS;
    result.push(randomFrom(priorityPOS.length ? priorityPOS : fallback));
  }
  for (let index = 0; index < otherRoundsCount; index += 1) {
    result.push(randomFrom(otherPOS.length ? otherPOS : (priorityPOS.length ? priorityPOS : PRIORITY_POS)));
  }
  return shuffle(result);
}

function uniquePool(pool) {
  const seen = new Set();
  return (Array.isArray(pool) ? pool : []).filter((word) => {
    const id = normalizeId(word?.id ?? word?.word_id);
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function takeCandidate(candidates, usedWords, roundWords, requireConflictFree) {
  for (const candidate of candidates) {
    const id = normalizeId(candidate?.id ?? candidate?.word_id);
    if (!id || usedWords.has(id)) continue;
    if (requireConflictFree && hasWordConflict(candidate, roundWords)) continue;
    return candidate;
  }
  return null;
}

export function buildWordsByPOSRounds(pool, totalLimit, options = {}) {
  const source = uniquePool(pool);
  const requestedLimit = Math.max(0, Math.floor(Number(totalLimit) || 0));
  const effectiveLimit = Math.min(requestedLimit, source.length);
  if (!effectiveLimit) {
    return { roundPOSList: [], rounds: [], items: [], requestedLimit, effectiveLimit: 0, complete: requestedLimit === 0 };
  }

  const roundsCount = Math.max(1, Math.ceil(effectiveLimit / 5));
  const roundPOSList = buildRoundPOSList(source, roundsCount);
  const usedWords = new Set();
  const rounds = [];
  const requireConflictFree = options.requireConflictFree !== false;
  const allowConflictFallback = options.allowConflictFallback === true;

  for (let roundIndex = 0; roundIndex < roundsCount; roundIndex += 1) {
    const targetPOS = roundPOSList[roundIndex];
    const remainingSlots = effectiveLimit - usedWords.size;
    const roundSize = Math.min(5, remainingSlots);
    const roundWords = [];

    const targetCandidates = shuffle(source.filter((word) => normalizePos(word?.pos) === targetPOS).slice());
    const fallbackCandidates = shuffle(source.filter((word) => normalizePos(word?.pos) !== targetPOS).slice());

    while (roundWords.length < roundSize) {
      const candidate = takeCandidate(targetCandidates, usedWords, roundWords, requireConflictFree)
        || takeCandidate(fallbackCandidates, usedWords, roundWords, requireConflictFree);
      if (!candidate) break;
      const id = normalizeId(candidate?.id ?? candidate?.word_id);
      roundWords.push(candidate);
      usedWords.add(id);
    }

    if (allowConflictFallback && roundWords.length < roundSize) {
      const fallback = shuffle(source.slice());
      while (roundWords.length < roundSize) {
        const candidate = takeCandidate(fallback, usedWords, roundWords, false);
        if (!candidate) break;
        const id = normalizeId(candidate?.id ?? candidate?.word_id);
        roundWords.push(candidate);
        usedWords.add(id);
      }
    }

    if (roundWords.length) rounds.push(roundWords);
  }

  const items = rounds.flat().slice(0, effectiveLimit);
  return {
    roundPOSList: roundPOSList.slice(0, rounds.length),
    rounds,
    items,
    requestedLimit,
    effectiveLimit,
    complete: items.length === effectiveLimit,
  };
}
