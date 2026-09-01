type DictionaryScopeInput = {
  storyId?: unknown;
  dictionaryId?: unknown;
  sectionId?: unknown;
  setId?: unknown;
  globalOrder?: unknown;
};

export type NormalizedDictionaryScope = {
  legacy: boolean;
  storyId: string;
  dictionaryId: string;
  sectionId: string;
  setId: string;
};

type LocalizedNames = { ru: string; en: string; tr: string };

const LEGACY_DICTIONARY_BY_SECTION: Readonly<Record<string, string>> = Object.freeze({
  '1': 'beginner',
  '2': 'intermediate',
  '3': 'advanced',
  '4': 'universe',
  '5': 'animals',
  '6': 'natural_materials',
  '7': 'plants',
});

const STORY_BY_DICTIONARY: Readonly<Record<string, string>> = Object.freeze({
  beginner: 'oblivion',
  intermediate: 'roots',
  advanced: 'ascent',
  universe: 'pathways',
  animals: 'pathways',
  natural_materials: 'pathways',
  plants: 'pathways',
});

const LEVEL_START: Readonly<Record<string, number>> = Object.freeze({
  beginner: 1,
  intermediate: 882,
  advanced: 1199,
});

const THEMATIC_OFFSET: Readonly<Record<string, number>> = Object.freeze({
  universe: 0,
  animals: 5,
  natural_materials: 13,
  plants: 18,
});

const DICTIONARY_NAMES: Readonly<Record<string, LocalizedNames>> = Object.freeze({
  beginner: { ru: 'Начальный', en: 'Beginner', tr: 'Başlangıç' },
  intermediate: { ru: 'Средний', en: 'Intermediate', tr: 'Orta' },
  advanced: { ru: 'Продвинутый', en: 'Advanced', tr: 'İleri' },
  universe: { ru: 'Вселенная', en: 'Universe', tr: 'Evren' },
  animals: { ru: 'Животные', en: 'Animals', tr: 'Hayvanlar' },
  natural_materials: { ru: 'Природные материалы', en: 'Natural materials', tr: 'Doğal malzemeler' },
  plants: { ru: 'Растения', en: 'Plants', tr: 'Bitkiler' },
});

const STORY_NAMES: Readonly<Record<string, LocalizedNames>> = Object.freeze({
  oblivion: { ru: 'На пороге забвения', en: 'On the Threshold of Oblivion', tr: 'Unutuluşun Eşiğinde' },
  roots: { ru: 'Возвращение к истокам', en: 'Back to the Roots', tr: 'Köklere Dönüş' },
  ascent: { ru: 'Восхождение', en: 'Ascent', tr: 'Yükseliş' },
  pathways: { ru: 'Тропы', en: 'Paths', tr: 'Patikalar' },
});

const SECTION_NAMES: Readonly<Record<string, LocalizedNames>> = Object.freeze({
  'beginner-starter': { ru: 'Вводный', en: 'Starter', tr: 'Başlangıç' },
  'beginner-elementary': { ru: 'Базовый', en: 'Elementary', tr: 'Temel' },
  'intermediate-intermediate': { ru: 'Средний', en: 'Intermediate', tr: 'Orta' },
  'intermediate-upper-intermediate': { ru: 'Выше среднего', en: 'Upper-intermediate', tr: 'Orta üstü' },
  'advanced-advanced': { ru: 'Продвинутый', en: 'Advanced', tr: 'İleri' },
  'advanced-proficiency': { ru: 'Мастер', en: 'Proficiency', tr: 'Usta' },
  'universe-seasons': { ru: 'Времена года', en: 'Seasons', tr: 'Mevsimler' },
  'universe-months': { ru: 'Месяцы года', en: 'Months', tr: 'Aylar' },
  'universe-weekdays': { ru: 'Дни недели', en: 'Days of the week', tr: 'Haftanın günleri' },
});

const THEMATIC_SECTION_BY_SET: Readonly<Record<string, string>> = Object.freeze({
  'universe-01': 'universe-seasons',
  'universe-02': 'universe-months',
  'universe-03': 'universe-weekdays',
  'universe-04': 'universe-space',
  'universe-05': 'universe-colours',
});

function id(value: unknown) {
  return String(value ?? '').normalize('NFC').trim();
}

function ordinal(value: string) {
  const match = value.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function permanentSectionId(dictionaryId: string, setId: string) {
  const number = ordinal(setId);
  if (dictionaryId === 'beginner') return number > 0 && number <= 15 ? 'beginner-starter' : 'beginner-elementary';
  if (dictionaryId === 'intermediate') return number > 0 && number <= 6 ? 'intermediate-intermediate' : 'intermediate-upper-intermediate';
  if (dictionaryId === 'advanced') return number > 0 && number <= 10 ? 'advanced-advanced' : 'advanced-proficiency';
  return THEMATIC_SECTION_BY_SET[setId] || '';
}

export function normalizeDictionaryScope(input: DictionaryScopeInput): NormalizedDictionaryScope {
  const rawDictionaryId = id(input.dictionaryId);
  const rawSectionId = id(input.sectionId);
  const legacy = /^\d+$/.test(rawDictionaryId) && Boolean(LEGACY_DICTIONARY_BY_SECTION[rawSectionId]);
  if (!legacy) {
    const order = Number(input.globalOrder);
    return {
      legacy: false,
      storyId: id(input.storyId),
      dictionaryId: rawDictionaryId,
      sectionId: rawSectionId,
      setId: id(input.setId) || `auto-${Math.max(1, Math.ceil((Number.isFinite(order) ? order : 1) / 30))}`,
    };
  }

  const dictionaryId = LEGACY_DICTIONARY_BY_SECTION[rawSectionId];
  const rawSetId = id(input.setId);
  const order = Number(input.globalOrder);
  let setId = rawSetId;
  if (!setId && LEVEL_START[dictionaryId]) {
    const start = LEVEL_START[dictionaryId];
    const setNumber = Math.max(1, Math.floor(((Number.isFinite(order) ? order : start) - start) / 30) + 1);
    setId = `${dictionaryId}-${String(setNumber).padStart(2, '0')}`;
  } else if (/^\d+$/.test(setId)) {
    const setNumber = Number(setId) - (THEMATIC_OFFSET[dictionaryId] || 0);
    if (setNumber > 0) setId = `${dictionaryId}-${String(setNumber).padStart(2, '0')}`;
  }

  return {
    legacy: true,
    storyId: STORY_BY_DICTIONARY[dictionaryId] || id(input.storyId),
    dictionaryId,
    sectionId: permanentSectionId(dictionaryId, setId) || rawSectionId,
    setId,
  };
}

export function legacyStructureNames(scope: NormalizedDictionaryScope) {
  if (!scope.legacy) return null;
  const empty = { ru: '', en: '', tr: '' };
  return {
    story: STORY_NAMES[scope.storyId] || empty,
    dictionary: DICTIONARY_NAMES[scope.dictionaryId] || empty,
    section: SECTION_NAMES[scope.sectionId] || empty,
    set: SECTION_NAMES[scope.sectionId] || empty,
  };
}
