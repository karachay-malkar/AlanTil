const PRIORITY_POS = ['noun', 'verb', 'adjective', 'adverb'];
const PRIORITY_POS_SET = new Set(PRIORITY_POS);

export function normalizeId(value) {
  return String(value ?? '').normalize('NFC').trim();
}

export function normalizePos(value) {
  return String(value ?? '').normalize('NFC').trim().toLowerCase();
}

export function parseSynonyms(value) {
  if (Array.isArray(value)) return value.map((entry) => normalizeId(entry).toLowerCase()).filter(Boolean);
  return String(value ?? '').normalize('NFC').toLowerCase().split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function sortNatural(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'ru', { numeric: true, sensitivity: 'base' });
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

function dictionaryId(word) {
  return normalizeId(word?.dictionary_id ?? word?.dictionaryId);
}

function sectionId(word) {
  return normalizeId(word?.section_id ?? word?.sectionId);
}

function sourceSetId(word) {
  return normalizeId(word?.set_id ?? word?.setId);
}

function orderedWords(words) {
  return (Array.isArray(words) ? words : []).slice()
    .sort((left, right) => Number(left?.global_order || left?.dict_order || 0) - Number(right?.global_order || right?.dict_order || 0));
}

export function dictsFrom(words) {
  const order = new Map();
  orderedWords(words).forEach((word, index) => {
    const id = dictionaryId(word);
    if (id && !order.has(id)) order.set(id, index);
  });
  return Array.from(order.keys());
}

export function sectionsFrom(words, dict) {
  const dictionary = normalizeId(dict);
  const order = new Map();
  orderedWords(words).forEach((word, index) => {
    if (dictionaryId(word) !== dictionary) return;
    const id = sectionId(word);
    if (id && !order.has(id)) order.set(id, index);
  });
  return Array.from(order.keys());
}

export function setsFrom(words, dict, section = '') {
  const dictionary = normalizeId(dict);
  const sectionScope = normalizeId(section);
  const named = new Map();
  orderedWords(words).forEach((word, index) => {
    if (dictionaryId(word) !== dictionary) return;
    if (sectionScope && sectionId(word) !== sectionScope) return;
    const id = sourceSetId(word);
    if (id && !named.has(id)) named.set(id, index);
  });
  return Array.from(named.keys());
}

export function wordsForSection(words, dict, section) {
  const dictionary = normalizeId(dict);
  const sectionScope = normalizeId(section);
  if (!dictionary || !sectionScope) return [];
  return orderedWords(words).filter((word) => dictionaryId(word) === dictionary && sectionId(word) === sectionScope);
}

export function wordsForSet(words, dict, section, setNumber) {
  const dictionary = normalizeId(dict);
  const sectionScope = normalizeId(section);
  const setId = normalizeId(setNumber);
  if (!dictionary || !sectionScope || !setId) return [];
  return orderedWords(words).filter((word) => dictionaryId(word) === dictionary
    && sectionId(word) === sectionScope
    && sourceSetId(word) === setId);
}

export function isWordEnabledInTestModes(word) {
  return Boolean(word && word.usedInTest === true);
}

export function scopeKey(dictionaryIdValue, sectionIdValue) {
  return `${normalizeId(dictionaryIdValue)}||${normalizeId(sectionIdValue)}`;
}

export function buildScope(words) {
  const dictionaries = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    const dictionary = dictionaryId(word);
    const section = sectionId(word);
    if (!dictionary || !section) return;
    if (!dictionaries.has(dictionary)) {
      dictionaries.set(dictionary, {
        id: dictionary,
        name: String(word?.dictionary_name || dictionary),
        count: 0,
        sections: new Map(),
      });
    }
    const dictionaryNode = dictionaries.get(dictionary);
    dictionaryNode.count += 1;
    if (!dictionaryNode.sections.has(section)) {
      dictionaryNode.sections.set(section, {
        id: section,
        name: String(word?.section_name || section),
        count: 0,
      });
    }
    dictionaryNode.sections.get(section).count += 1;
  });
  return Array.from(dictionaries.values()).map((entry) => ({
    ...entry,
    sections: Array.from(entry.sections.values()),
  }));
}

export function buildSelectedSources(words) {
  const grouped = new Map();
  (Array.isArray(words) ? words : []).forEach((word) => {
    const dictionary = dictionaryId(word);
    const section = sectionId(word);
    if (!dictionary || !section) return;
    if (!grouped.has(dictionary)) grouped.set(dictionary, new Set());
    grouped.get(dictionary).add(section);
  });
  return Array.from(grouped.entries()).map(([dictionary_id, sections]) => ({
    dictionary_id,
    section_ids: Array.from(sections),
  }));
}

function randomFrom(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function translationSet(item) {
  return new Set(splitGroups(item?.trans).map((entry) => entry.toLowerCase()).filter(Boolean));
}

function synonymSet(item) {
  return new Set(parseSynonyms(item?.synonyms));
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

export function buildTestOptions(item, optionPool, mode = "kb", count = 4) {
  if (!item) return [];
  const desired = Math.max(1, Math.floor(Number(count) || 4));
  const answerText = (word) => normalizeId(mode === "kb" ? word?.trans : word?.word);
  const itemId = normalizeId(item?.id ?? item?.word_id);
  const correctText = answerText(item);
  const targetPOS = normalizePos(item?.pos);
  const source = (Array.isArray(optionPool) ? optionPool : []).filter(Boolean);
  const selectedWords = [];
  const options = [{ id: itemId, text: correctText }];
  const usedIds = new Set([itemId]);
  const usedTexts = new Set([correctText]);

  const appendFrom = (candidates, requireConflictFree) => {
    for (const candidate of shuffle(candidates.slice())) {
      if (options.length >= desired) break;
      const id = normalizeId(candidate?.id ?? candidate?.word_id);
      const text = answerText(candidate);
      if (!id || usedIds.has(id) || !text || usedTexts.has(text)) continue;
      if (requireConflictFree && hasWordConflict(candidate, [item, ...selectedWords])) continue;
      usedIds.add(id);
      usedTexts.add(text);
      selectedWords.push(candidate);
      options.push({ id, text });
    }
  };

  const samePOS = source.filter((candidate) => normalizePos(candidate?.pos) === targetPOS);
  appendFrom(samePOS, true);
  if (options.length < desired) appendFrom(source, true);
  // If a very narrow scope has too few conflict-free distractors, preserve four visible
  // alternatives rather than degrading the UI to two or three buttons. Exact duplicate
  // answer texts are still forbidden.
  if (options.length < desired) appendFrom(samePOS, false);
  if (options.length < desired) appendFrom(source, false);

  return shuffle(options.slice(0, desired));
}

export function buildTestWords(pool, totalLimit) {
  return buildWordsByPOSRounds(pool, totalLimit, { requireConflictFree: false });
}

export function buildMatchRounds(pool, totalLimit) {
  return buildWordsByPOSRounds(pool, totalLimit, { requireConflictFree: true, allowConflictFallback: false });
}
