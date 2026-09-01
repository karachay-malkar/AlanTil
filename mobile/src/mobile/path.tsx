import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  displayedAlanWord,
  displayedStoryCopy,
  displayedStructureName,
  displayedTranslation,
  loadAllWords,
  loadStoryCopy,
  subscribeDictionary,
  type MobileWord,
  type StoryCopyRow,
} from '@/src/mobile/dictionary';
import { useGuide } from '@/src/mobile/guide';
import { AlanIcon } from '@/src/mobile/icons';
import { useI18n } from '@/src/mobile/i18n';
import {
  routeConnectorSegment,
  routeScaleState,
  routeSectionDotCount,
  routeWaveShift,
} from '@/src/mobile/path-visual-policy';
import { loadSetProgress, loadWordProgress } from '@/src/mobile/progress/repository';
import { OverflowMarquee } from '@/src/mobile/overflow-marquee';
import { PracticeHeader } from '@/src/mobile/practice/common';
import { loadFavoriteIds, setFavorite } from '@/src/mobile/practice/repository';
import { useSession } from '@/src/mobile/session';
import { useSettings, type UserSettings } from '@/src/mobile/settings';
import { readScopedJson, STORAGE_KEYS, subscribeScopedValue, writeScopedJson } from '@/src/mobile/storage';
import { theme } from '@/src/mobile/theme';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

const STORY_ORDER = ['oblivion', 'roots', 'ascent', 'pathways'] as const;
const LEVEL_DICTIONARIES = new Set(['beginner', 'intermediate', 'advanced']);
const STELE_SEEN_KEY = 'alantil_story_intro_seen_v1';

type WordProgress = {
  word_id: string;
  mastery_status?: string | null;
  study_shown_count?: number | null;
  test_correct_count?: number | null;
  test_wrong_count?: number | null;
};

type RouteStation = {
  key: string;
  storyId: string;
  dictionaryId: string;
  dictionaryName: string;
  sectionId: string;
  sectionName: string;
  setId: string;
  setName: string;
  setNumber: number;
  name: string;
  order: number;
  words: MobileWord[];
};

type RouteSection = {
  id: string;
  name: string;
  order: number;
  stations: RouteStation[];
};

type RouteCatalog = {
  id: string;
  name: string;
  order: number;
  sections: RouteSection[];
  stations: RouteStation[];
};

type RouteStory = {
  id: string;
  name: string;
  intro: string;
  catalogs: RouteCatalog[];
  sections: RouteSection[];
  stations: RouteStation[];
};

type MobileRoute = {
  storyOrder: string[];
  stories: Record<string, RouteStory>;
  byKey: Map<string, RouteStation>;
};

type PathBundle = {
  route: MobileRoute;
  progressMap: Map<string, WordProgress>;
  setProgressRows: Record<string, unknown>[];
};

type ProgressSummary = {
  total: number;
  mastered: number;
  review: number;
  percent: number;
};

type PathViewState = {
  active_story_id?: string;
  scroll_offsets?: Record<string, number>;
  updated_at?: string;
};

type StoryWordEntry = { word: MobileWord; ordinal: number };
type StoryWordSectionGroup = { section: RouteSection; entries: StoryWordEntry[] };
type StoryWordCatalogGroup = { catalog: RouteCatalog; sections: StoryWordSectionGroup[] };
type RouteAnchorLayout = { x: number; y: number; width: number; height: number };
type RouteVisualItem =
  | { type: 'station'; key: string; station: RouteStation; index: number }
  | { type: 'section'; key: string; section: RouteSection; catalog: RouteCatalog }
  | { type: 'catalog'; key: string; catalog: RouteCatalog };

const STATION_RING_MARKS = Array.from({ length: 28 }, (_, index) => {
  const angle = 180 + (index / 28) * 360;
  const radians = (angle * Math.PI) / 180;
  return {
    left: 30 + Math.cos(radians) * 27.5 - 1.5,
    top: 30 + Math.sin(radians) * 27.5 - 3,
    rotate: `${angle + 90}deg`,
  };
});

const TOPOGRAPHIC_GROUPS = [
  { left: '-23%', top: '3%', width: 250, height: 170, rotate: '-12deg' },
  { left: '52%', top: '34%', width: 230, height: 180, rotate: '18deg' },
  { left: '7%', top: '72%', width: 310, height: 210, rotate: '-7deg' },
] as const;

const WORD_LIST_COPY = {
  ru: { title: 'Список слов', search: 'Поиск слова', open: 'Открыть поиск', close: 'Закрыть поиск', empty: 'Слов нет', noResults: 'Ничего не найдено', notFound: 'История не найдена.', add: 'Добавить в избранное', remove: 'Удалить из избранного' },
  en: { title: 'Word list', search: 'Search words', open: 'Open search', close: 'Close search', empty: 'No words', noResults: 'No results', notFound: 'Story not found.', add: 'Add to favorites', remove: 'Remove from favorites' },
  tr: { title: 'Kelime listesi', search: 'Kelime ara', open: 'Aramayı aç', close: 'Aramayı kapat', empty: 'Kelime yok', noResults: 'Sonuç bulunamadı', notFound: 'Hikâye bulunamadı.', add: 'Favorilere ekle', remove: 'Favorilerden kaldır' },
} as const;

function text(value: unknown) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

function numeric(value: unknown, fallback = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedSearch(value: unknown, language: UserSettings['interface_language_code']) {
  return text(value).toLocaleLowerCase(language === 'tr' ? 'tr' : language === 'en' ? 'en' : 'ru');
}

function thematicCatalog(catalog: RouteCatalog) {
  const id = text(catalog.id).toLocaleLowerCase();
  return id.includes('thematic') || id.includes('temat') || catalog.sections.length > 2;
}

function groupedStoryWords(story?: RouteStory): StoryWordCatalogGroup[] {
  if (!story) return [];
  const seen = new Set<string>();
  let ordinal = 0;
  return story.catalogs.map((catalog) => ({
    catalog,
    sections: catalog.sections.map((section) => ({
      section,
      entries: section.stations.flatMap((station) => station.words.flatMap((word) => {
        const id = text(word.word_id);
        if (!id || seen.has(id)) return [];
        seen.add(id);
        return [{ word, ordinal: ++ordinal }];
      })),
    })).filter((group) => group.entries.length),
  })).filter((group) => group.sections.length);
}

function routeVisualItems(story?: RouteStory): RouteVisualItem[] {
  if (!story) return [];
  const stationIndex = new Map(story.stations.map((station, index) => [station.key, index]));
  const items: RouteVisualItem[] = [];
  [...story.catalogs].reverse().forEach((catalog) => {
    const reversedSections = [...catalog.sections].reverse();
    reversedSections.forEach((section, sectionIndex) => {
      [...section.stations].reverse().forEach((station) => {
        items.push({
          type: 'station',
          key: `station:${station.key}`,
          station,
          index: stationIndex.get(station.key) ?? 0,
        });
      });
      // Web 13.15.12 does not render section titles on the route map.
      // Keep only an invisible boundary spacer between sections for connector/scale anchors.
      if (sectionIndex < reversedSections.length - 1) {
        items.push({ type: 'section', key: `section:${catalog.id}:${section.id}`, section, catalog });
      }
    });
    items.push({ type: 'catalog', key: `catalog:${catalog.id}`, catalog });
  });
  return items;
}

function setOrdinal(id: string) {
  const match = id.match(/(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function firstOrder(words: MobileWord[]) {
  return Math.min(...words.map((word, index) => numeric(word.global_order, index + 1)));
}

function localizedFallbackStoryName(storyId: string, words: MobileWord[], settings: UserSettings) {
  const sample = words.find((word) => word.story_id === storyId);
  return sample ? displayedStructureName(sample, 'story_name', settings) : storyId;
}

function buildRoute(words: MobileWord[], copy: StoryCopyRow[], settings: UserSettings): MobileRoute {
  const storyCopy = new Map(copy.map((row) => [text(row.entity_id), row]));
  const storyBuckets = new Map<string, MobileWord[]>();
  words.forEach((word) => {
    const storyId = text(word.story_id);
    if (!storyId) return;
    const bucket = storyBuckets.get(storyId) ?? [];
    bucket.push(word);
    storyBuckets.set(storyId, bucket);
  });

  const preferred = new Map(STORY_ORDER.map((id, index) => [id, index]));
  const storyOrder = [...storyBuckets.keys()].sort((left, right) => {
    const leftRank = preferred.get(left as (typeof STORY_ORDER)[number]) ?? 999;
    const rightRank = preferred.get(right as (typeof STORY_ORDER)[number]) ?? 999;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return firstOrder(storyBuckets.get(left) ?? []) - firstOrder(storyBuckets.get(right) ?? []);
  });

  const stories: Record<string, RouteStory> = {};
  const byKey = new Map<string, RouteStation>();

  storyOrder.forEach((storyId) => {
    const storyWords = (storyBuckets.get(storyId) ?? []).slice().sort((a, b) => numeric(a.global_order) - numeric(b.global_order));
    const catalogBuckets = new Map<string, MobileWord[]>();
    storyWords.forEach((word) => {
      const id = text(word.dictionary_id);
      if (!id) return;
      const bucket = catalogBuckets.get(id) ?? [];
      bucket.push(word);
      catalogBuckets.set(id, bucket);
    });

    const catalogs = [...catalogBuckets.entries()]
      .map(([dictionaryId, dictionaryWords]) => {
        const sectionBuckets = new Map<string, MobileWord[]>();
        dictionaryWords.forEach((word) => {
          const id = text(word.section_id);
          if (!id) return;
          const bucket = sectionBuckets.get(id) ?? [];
          bucket.push(word);
          sectionBuckets.set(id, bucket);
        });

        const sections = [...sectionBuckets.entries()]
          .map(([sectionId, sectionWords]) => {
            const setBuckets = new Map<string, MobileWord[]>();
            sectionWords.forEach((word) => {
              const id = text(word.set_id);
              if (!id) return;
              const bucket = setBuckets.get(id) ?? [];
              bucket.push(word);
              setBuckets.set(id, bucket);
            });

            const stations = [...setBuckets.entries()]
              .map(([setId, setWords]) => {
                const sorted = setWords.slice().sort((a, b) => numeric(a.global_order) - numeric(b.global_order));
                const sample = sorted[0];
                const number = setOrdinal(setId);
                const setName = displayedStructureName(sample, 'set_name', settings);
                const station: RouteStation = {
                  key: [storyId, dictionaryId, sectionId, setId].join('::'),
                  storyId,
                  dictionaryId,
                  dictionaryName: displayedStructureName(sample, 'dictionary_name', settings),
                  sectionId,
                  sectionName: displayedStructureName(sample, 'section_name', settings),
                  setId,
                  setName,
                  setNumber: number,
                  name: setName || (number ? String(number).padStart(2, '0') : setId),
                  order: firstOrder(sorted),
                  words: sorted,
                };
                byKey.set(station.key, station);
                return station;
              })
              .sort((a, b) => a.order - b.order || a.setId.localeCompare(b.setId));

            const sample = sectionWords[0];
            return {
              id: sectionId,
              name: displayedStructureName(sample, 'section_name', settings),
              order: firstOrder(sectionWords),
              stations,
            } satisfies RouteSection;
          })
          .filter((section) => section.stations.length)
          .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

        const sample = dictionaryWords[0];
        return {
          id: dictionaryId,
          name: displayedStructureName(sample, 'dictionary_name', settings),
          order: firstOrder(dictionaryWords),
          sections,
          stations: sections.flatMap((section) => section.stations),
        } satisfies RouteCatalog;
      })
      .filter((catalog) => catalog.stations.length)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

    const localizedCopy = displayedStoryCopy(storyCopy.get(storyId), settings);
    stories[storyId] = {
      id: storyId,
      name: localizedCopy.name || localizedFallbackStoryName(storyId, storyWords, settings),
      intro: localizedCopy.intro,
      catalogs,
      sections: catalogs.flatMap((catalog) => catalog.sections),
      stations: catalogs.flatMap((catalog) => catalog.stations),
    };
  });

  return { storyOrder, stories, byKey };
}

function normalizeProgressRows(rows: unknown): WordProgress[] {
  return Array.isArray(rows)
    ? rows.map((row) => row as WordProgress).filter((row) => text(row?.word_id))
    : [];
}

async function loadProgress(userId?: string): Promise<{ wordRows: WordProgress[]; setRows: Record<string, unknown>[] }> {
  const [wordRows, setRows] = await Promise.all([loadWordProgress(userId), loadSetProgress(userId)]);
  return { wordRows: normalizeProgressRows(wordRows), setRows };
}

async function loadPathBundle(settings: UserSettings, userId?: string): Promise<PathBundle> {
  const [words, copy, progress] = await Promise.all([
    loadAllWords(),
    loadStoryCopy().catch(() => []),
    loadProgress(userId),
  ]);
  return {
    route: buildRoute(words, copy, settings),
    progressMap: new Map(progress.wordRows.map((row) => [text(row.word_id), row])),
    setProgressRows: progress.setRows,
  };
}

function summary(words: MobileWord[], progressMap: Map<string, WordProgress>): ProgressSummary {
  let mastered = 0;
  let review = 0;
  words.forEach((word) => {
    const status = progressMap.get(word.word_id)?.mastery_status;
    if (status === 'mastered' || status === 'review') mastered += 1;
    if (status === 'review') review += 1;
  });
  return {
    total: words.length,
    mastered,
    review,
    percent: words.length ? Math.round((mastered / words.length) * 100) : 0,
  };
}

function stationStatus(station: RouteStation, progressMap: Map<string, WordProgress>) {
  const state = summary(station.words, progressMap);
  if (state.percent === 100) return state.review ? 'review' : 'mastered';
  if (state.mastered > 0 || state.review > 0) return 'studying';
  const hasActivity = station.words.some((word) => {
    const progress = progressMap.get(word.word_id);
    return Number(progress?.study_shown_count || 0) > 0
      || Number(progress?.test_correct_count || 0) > 0
      || Number(progress?.test_wrong_count || 0) > 0;
  });
  return hasActivity ? 'studying' : 'available';
}

function uniqueStoryWords(story: RouteStory) {
  const map = new Map<string, MobileWord>();
  story.stations.forEach((station) => station.words.forEach((word) => map.set(word.word_id, word)));
  return [...map.values()].sort((a, b) => numeric(a.global_order) - numeric(b.global_order));
}

function usePathBundle() {
  const session = useSession();
  const { settings } = useSettings();
  const [bundle, setBundle] = useState<PathBundle | null>(null);
  const [error, setError] = useState('');
  const [dictionaryRevision, setDictionaryRevision] = useState(0);

  useEffect(() => subscribeDictionary(() => setDictionaryRevision((value) => value + 1)), []);

  useEffect(() => {
    let active = true;
    setError('');
    void loadPathBundle(settings, session.user?.id)
      .then((next) => {
        if (active) setBundle(next);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [
    session.user?.id,
    settings.interface_language_code,
    settings.translation_language_code,
    settings.alan_script_code,
    settings.alan_dialect_code,
    dictionaryRevision,
  ]);

  return { bundle, error, settings };
}

function LoadingState({ error }: { error?: string }) {
  return (
    <View style={styles.loadingState}>
      {error ? <Text style={styles.errorText}>{error}</Text> : <ActivityIndicator color={theme.colors.accentStrong} />}
    </View>
  );
}

function StoryProgress({ story, progressMap }: { story: RouteStory; progressMap: Map<string, WordProgress> }) {
  const state = summary(uniqueStoryWords(story), progressMap);
  const filled = Math.round(state.percent / 10);
  return (
    <View style={styles.storyProgressRow}>
      <View style={styles.segmentedProgress}>
        {Array.from({ length: 10 }, (_, index) => (
          <View key={index} style={[styles.progressSegment, index < filled && styles.progressSegmentFilled]} />
        ))}
      </View>
      <Text style={styles.progressPercent}>{state.percent}%</Text>
      <Text style={styles.progressCount}>{state.mastered}/{state.total}</Text>
    </View>
  );
}

function TopographicBackdrop() {
  return (
    <View pointerEvents="none" style={styles.topographicBackdrop}>
      <View style={styles.sceneLight} />
      <View style={styles.sceneShade} />
      {TOPOGRAPHIC_GROUPS.map((group, groupIndex) => (
        <View
          key={groupIndex}
          style={[
            styles.contourGroup,
            {
              left: group.left,
              top: group.top,
              width: group.width,
              height: group.height,
              transform: [{ rotate: group.rotate }],
            },
          ]}
        >
          {[1, 0.78, 0.56, 0.36].map((scale) => (
            <View
              key={scale}
              style={[
                styles.contourRing,
                {
                  width: group.width * scale,
                  height: group.height * scale,
                  left: group.width * (1 - scale) / 2,
                  top: group.height * (1 - scale) / 2,
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function StationProgressRing({ state, status, ordinal }: { state: ProgressSummary; status: string; ordinal: number }) {
  const fillCount = Math.round((Math.max(0, Math.min(100, state.percent)) / 100) * STATION_RING_MARKS.length);
  const fillColor = status === 'review'
    ? '#9b7134'
    : status === 'mastered'
      ? '#557a5c'
      : theme.colors.accentStrong;
  return (
    <View style={styles.stationRing}>
      {STATION_RING_MARKS.map((mark, index) => (
        <View
          key={index}
          style={[
            styles.stationRingMark,
            { left: mark.left, top: mark.top, transform: [{ rotate: mark.rotate }] },
            index < fillCount && { backgroundColor: fillColor },
          ]}
        />
      ))}
      <View style={[styles.millstone, status === 'mastered' && styles.millstoneMastered]}>
        <View style={styles.millstoneGrainOne} />
        <View style={styles.millstoneGrainTwo} />
        <View style={styles.millstoneHole} />
        <Text style={styles.stationOrdinal}>{String(ordinal + 1).padStart(2, '0')}</Text>
      </View>
    </View>
  );
}

function RouteConnector({
  story,
  layouts,
  routeWidth,
}: {
  story: RouteStory;
  layouts: Record<string, RouteAnchorLayout>;
  routeWidth: number;
}) {
  const segments = useMemo(() => {
    const points = story.stations.flatMap((station, index) => {
      const layout = layouts[`station:${station.key}`];
      if (!layout) return [];
      return [{
        key: station.key,
        x: layout.x + layout.width / 2 + routeWaveShift(index, routeWidth),
        y: layout.y + 30,
      }];
    });
    return points.slice(1).map((point, index) => ({
      key: `${points[index].key}:${point.key}`,
      ...routeConnectorSegment(points[index], point),
    }));
  }, [layouts, routeWidth, story]);

  return (
    <View pointerEvents="none" style={styles.routeConnector}>
      {segments.map((segment) => (
        <View
          key={segment.key}
          style={[
            styles.routeConnectorSegment,
            {
              left: segment.left,
              top: segment.top,
              width: segment.width,
              transform: [{ rotate: `${segment.angle}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function StationStone({
  station,
  index,
  progressMap,
  routeWidth,
  onLayout,
}: {
  station: RouteStation;
  index: number;
  progressMap: Map<string, WordProgress>;
  routeWidth: number;
  onLayout: (layout: RouteAnchorLayout) => void;
}) {
  const state = summary(station.words, progressMap);
  const status = stationStatus(station, progressMap);
  const milestones = Math.min(4, Math.floor(state.mastered / 20));
  const hideLabel = LEVEL_DICTIONARIES.has(station.dictionaryId);
  const shift = routeWaveShift(index, routeWidth);
  return (
    <Pressable
      accessibilityLabel={`${station.name}, ${state.mastered}/${state.total}`}
      accessibilityRole="button"
      accessibilityState={{ selected: state.percent === 100 }}
      testID={scopedTestId('path.station', station.key)}
      onLayout={(event) => onLayout(event.nativeEvent.layout)}
      onPress={() => router.push({ pathname: '/path/station', params: { key: station.key } })}
      style={({ pressed }) => [
        styles.stationNode,
        { transform: [{ translateX: shift }, ...(pressed ? [{ translateY: -2 }] : [])] },
        pressed && styles.stationPressed,
      ]}
    >
      {milestones ? <Text style={styles.stationMilestones}>{'⌃'.repeat(milestones)}</Text> : null}
      <StationProgressRing state={state} status={status} ordinal={index} />
      {!hideLabel ? <Text numberOfLines={2} style={[styles.stationLabel, status === 'review' && styles.stationLabelReview]}>{station.name}</Text> : null}
      <Text style={styles.stationCount}>{state.mastered}/{state.total}</Text>
    </Pressable>
  );
}

function StoryStele({ story }: { story: RouteStory }) {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const steleScrollRef = useRef<ScrollView>(null);
  const autoDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoScrollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const steleContentHeightRef = useRef(0);
  const steleViewportHeightRef = useRef(0);
  const steleOffsetRef = useRef(0);
  const manualScrollRef = useRef(false);
  const scope = session.user?.id ? `user:${session.user.id}` : 'guest';
  const storageKey = `${STELE_SEEN_KEY}:${scope}`;

  const stopAutoScroll = useCallback(() => {
    if (autoDelayRef.current) clearTimeout(autoDelayRef.current);
    if (autoScrollRef.current) clearInterval(autoScrollRef.current);
    autoDelayRef.current = null;
    autoScrollRef.current = null;
  }, []);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReducedMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!story.intro) return () => { active = false; };
    void AsyncStorage.getItem(storageKey).then((raw) => {
      if (!active) return;
      const state = raw ? JSON.parse(raw) as Record<string, boolean> : {};
      if (!state[story.id]) setOpen(true);
    }).catch(() => {});
    return () => { active = false; };
  }, [story.id, story.intro, storageKey]);

  useEffect(() => {
    stopAutoScroll();
    steleOffsetRef.current = 0;
    manualScrollRef.current = false;
    if (!open || reducedMotion) return stopAutoScroll;
    autoDelayRef.current = setTimeout(() => {
      autoScrollRef.current = setInterval(() => {
        if (manualScrollRef.current) {
          stopAutoScroll();
          return;
        }
        const maxOffset = Math.max(0, steleContentHeightRef.current - steleViewportHeightRef.current);
        if (maxOffset <= 0 || steleOffsetRef.current >= maxOffset) {
          stopAutoScroll();
          return;
        }
        steleOffsetRef.current = Math.min(maxOffset, steleOffsetRef.current + 0.8);
        steleScrollRef.current?.scrollTo({ y: steleOffsetRef.current, animated: false });
      }, 32);
    }, 1300);
    return stopAutoScroll;
  }, [open, reducedMotion, stopAutoScroll, story.id]);

  const markSeen = async () => {
    const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
    const state = raw ? JSON.parse(raw) as Record<string, boolean> : {};
    if (!state[story.id]) await AsyncStorage.setItem(storageKey, JSON.stringify({ ...state, [story.id]: true }));
  };

  const close = () => {
    stopAutoScroll();
    setOpen(false);
    void markSeen();
  };

  if (!story.intro) return null;
  return (
    <>
      <Pressable
        accessibilityLabel={story.name}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.steleTrigger, { bottom: 18 + Math.max(insets.bottom, 4) }]}
      >
        <AlanIcon color={theme.colors.accentStrong} name="artifact" size={20} />
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <Pressable accessible={false} style={styles.steleBackdrop} onPress={close}>
          <Pressable accessible={false} style={styles.steleDialog} onPress={(event) => event.stopPropagation()}>
            <Pressable
              accessibilityLabel={t('common.close')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={close}
              style={({ pressed }) => [styles.steleClose, pressed && styles.stationPressed]}
            >
              <AlanIcon color={theme.colors.textMuted} name="close" size={18} />
            </Pressable>
            <ImageBackground
              source={require('../../assets/path/story-stele.webp')}
              resizeMode="contain"
              style={styles.steleArtwork}
              imageStyle={styles.steleImage}
            >
              <View style={styles.steleContent}>
                <Text numberOfLines={2} adjustsFontSizeToFit style={styles.steleTitle}>{story.name}</Text>
                <ScrollView
                  ref={steleScrollRef}
                  style={styles.steleBody}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={(_width, height) => { steleContentHeightRef.current = height; }}
                  onLayout={(event) => { steleViewportHeightRef.current = event.nativeEvent.layout.height; }}
                  onScroll={(event) => { steleOffsetRef.current = event.nativeEvent.contentOffset.y; }}
                  onScrollBeginDrag={() => {
                    manualScrollRef.current = true;
                    stopAutoScroll();
                  }}
                  scrollEventThrottle={32}
                >
                  {story.intro.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
                    <Text key={index} style={styles.steleParagraph}>{paragraph.replace(/\s*\n\s*/g, ' ')}</Text>
                  ))}
                </ScrollView>
              </View>
            </ImageBackground>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function RouteScale({
  story,
  scrollY,
  contentHeight,
  viewportHeight,
  onSelect,
}: {
  story: RouteStory;
  scrollY: number;
  contentHeight: number;
  viewportHeight: number;
  onSelect: (anchorKey: string) => void;
}) {
  const marks = useMemo(() => {
    const result: { key: string; type: 'dot' | 'section' | 'diamond'; targetKey: string; label: string }[] = [];
    const totalStations = Math.max(1, story.stations.length);
    story.catalogs.forEach((catalog) => {
      result.push({
        key: `d:${catalog.id}`,
        type: 'diamond',
        targetKey: `catalog:${catalog.id}`,
        label: catalog.name,
      });
      catalog.sections.forEach((section, sectionIndex) => {
        const count = routeSectionDotCount(section.stations.length, totalStations);
        Array.from({ length: count }, (_, index) => {
          const stationIndex = count === 1
            ? 0
            : Math.round((index / (count - 1)) * Math.max(0, section.stations.length - 1));
          const station = section.stations[stationIndex];
          if (!station) return;
          result.push({
            key: `w:${section.id}:${index}:${station.key}`,
            type: 'dot',
            targetKey: `station:${station.key}`,
            label: station.name,
          });
        });
        if (sectionIndex < catalog.sections.length - 1) {
          result.push({
            key: `s:${catalog.id}:${section.id}`,
            type: 'section',
            targetKey: `section:${catalog.id}:${section.id}`,
            label: section.name || catalog.name,
          });
        }
      });
    });
    return result;
  }, [story]);
  const scaleState = routeScaleState(scrollY, contentHeight, viewportHeight, marks.length);

  return (
    <View style={styles.routeScale}>
      {marks.map((mark, index) => {
        const passed = index >= marks.length - scaleState.passed;
        const current = index === scaleState.currentIndex;
        return (
        <Pressable
          accessibilityLabel={mark.label}
          accessibilityRole="button"
          accessibilityState={{ selected: current }}
          hitSlop={3}
          key={mark.key}
          onPress={() => onSelect(mark.targetKey)}
          style={({ pressed }) => [styles.scaleMarkButton, pressed && styles.scaleMarkPressed]}
        >
          <View style={[
            mark.type === 'diamond' ? styles.scaleDiamond : mark.type === 'section' ? styles.scaleSection : styles.scaleDot,
            passed && styles.scaleMarkPassed,
            current && styles.scaleMarkCurrent,
          ]} />
        </Pressable>
        );
      })}
    </View>
  );
}

export function PathRoot() {
  const insets = useSafeAreaInsets();
  const pathParams = useLocalSearchParams<{ storyId?: string; storyRequest?: string }>();
  const session = useSession();
  const { openGuide } = useGuide();
  const { t } = useI18n();
  const { bundle, error } = usePathBundle();
  const userId = session.user?.id;
  const [activeStoryId, setActiveStoryId] = useState('');
  const [pathStateReady, setPathStateReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const positionedStory = useRef('');
  const activeStoryRef = useRef('');
  const appliedStoryRequestRef = useRef('');
  const scrollOffsetsRef = useRef<Record<string, number>>({});
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [routeLayouts, setRouteLayouts] = useState<Record<string, RouteAnchorLayout>>({});
  const [routeWidth, setRouteWidth] = useState(0);
  const [routeContentHeight, setRouteContentHeight] = useState(0);
  const [routeViewportHeight, setRouteViewportHeight] = useState(0);
  const [routeScrollY, setRouteScrollY] = useState(0);
  const story = bundle
    ? bundle.route.stories[activeStoryId] ?? bundle.route.stories[bundle.route.storyOrder[0]]
    : undefined;
  const visualItems = useMemo(() => routeVisualItems(story), [story]);

  useEffect(() => {
    setRouteLayouts({});
    setRouteContentHeight(0);
    setRouteScrollY(0);
  }, [story?.id]);

  const rememberRouteLayout = useCallback((key: string, layout: RouteAnchorLayout) => {
    setRouteLayouts((current) => {
      const previous = current[key];
      if (previous
        && previous.x === layout.x
        && previous.y === layout.y
        && previous.width === layout.width
        && previous.height === layout.height) return current;
      return { ...current, [key]: layout };
    });
  }, []);

  const scrollToRouteAnchor = useCallback((anchorKey: string) => {
    const layout = routeLayouts[anchorKey];
    if (!layout) return;
    const y = Math.max(0, layout.y - routeViewportHeight * 0.16);
    scrollRef.current?.scrollTo({ y, animated: true });
  }, [routeLayouts, routeViewportHeight]);

  useEffect(() => {
    let active = true;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = null;
    positionedStory.current = '';
    activeStoryRef.current = '';
    scrollOffsetsRef.current = {};
    setActiveStoryId('');
    setPathStateReady(false);

    void readScopedJson<PathViewState>(STORAGE_KEYS.pathState, {}, userId).then((stored) => {
      if (!active) return;
      const offsets = Object.fromEntries(
        Object.entries(stored.scroll_offsets ?? {})
          .map(([storyId, offset]) => [text(storyId), Math.max(0, Number(offset))] as const)
          .filter(([storyId, offset]) => Boolean(storyId) && Number.isFinite(offset)),
      );
      const storedStoryId = text(stored.active_story_id);
      activeStoryRef.current = storedStoryId;
      scrollOffsetsRef.current = offsets;
      setActiveStoryId(storedStoryId);
      setPathStateReady(true);
    });

    return () => {
      active = false;
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
      if (!activeStoryRef.current) return;
      void writeScopedJson(STORAGE_KEYS.pathState, {
        active_story_id: activeStoryRef.current,
        scroll_offsets: scrollOffsetsRef.current,
        updated_at: new Date().toISOString(),
      } satisfies PathViewState, userId).catch(() => {});
    };
  }, [userId]);

  const persistPathState = (storyId = activeStoryRef.current) => {
    if (!pathStateReady || !storyId) return;
    activeStoryRef.current = storyId;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void writeScopedJson(STORAGE_KEYS.pathState, {
        active_story_id: activeStoryRef.current,
        scroll_offsets: scrollOffsetsRef.current,
        updated_at: new Date().toISOString(),
      } satisfies PathViewState, userId).catch(() => {});
    }, 250);
  };

  useEffect(() => {
    if (!bundle || !pathStateReady) return;
    const requestedStoryId = text(pathParams.storyId);
    const requestId = text(pathParams.storyRequest) || requestedStoryId;
    if (!requestId || appliedStoryRequestRef.current === requestId || !bundle.route.stories[requestedStoryId]) return;
    appliedStoryRequestRef.current = requestId;
    positionedStory.current = '';
    activeStoryRef.current = requestedStoryId;
    setActiveStoryId(requestedStoryId);
    persistPathState(requestedStoryId);
  }, [bundle, pathParams.storyId, pathParams.storyRequest, pathStateReady]);

  useEffect(() => {
    if (!bundle || !pathStateReady) return;
    if (bundle.route.stories[activeStoryId]) {
      activeStoryRef.current = activeStoryId;
      return;
    }
    const fallbackStoryId = bundle.route.storyOrder[0] || 'oblivion';
    activeStoryRef.current = fallbackStoryId;
    setActiveStoryId(fallbackStoryId);
    persistPathState(fallbackStoryId);
  }, [bundle, activeStoryId, pathStateReady]);

  if (!bundle || !pathStateReady) return <LoadingState error={error} />;
  if (!story) return <LoadingState error={t('path.empty')} />;

  const restoreStoryPosition = () => {
    if (positionedStory.current === story.id) return;
    positionedStory.current = story.id;
    const storedOffset = scrollOffsetsRef.current[story.id];
    requestAnimationFrame(() => {
      if (Number.isFinite(storedOffset)) scrollRef.current?.scrollTo({ y: storedOffset, animated: false });
      else scrollRef.current?.scrollToEnd({ animated: false });
    });
  };

  const switchStory = (storyId: string) => {
    if (storyId === story.id) return;
    positionedStory.current = '';
    activeStoryRef.current = storyId;
    setActiveStoryId(storyId);
    persistPathState(storyId);
  };

  const rememberScrollPosition = (offset: number) => {
    if (!Number.isFinite(offset)) return;
    const bounded = Math.max(0, offset);
    scrollOffsetsRef.current[story.id] = bounded;
    setRouteScrollY((current) => Math.abs(current - bounded) >= 2 ? bounded : current);
    persistPathState(story.id);
  };

  return (
    <View testID={testIds.path.screen} style={styles.pathScreen}>
      <TopographicBackdrop />
      <View style={[styles.pathHeader, { paddingTop: insets.top + 10, height: 68 + insets.top }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyTabs}>
          {bundle.route.storyOrder.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityState={{ selected: id === story.id }}
              testID={scopedTestId('path.story', id)}
              onPress={() => switchStory(id)}
              style={styles.storyTabButton}
            >
              <Text style={[styles.storyTab, id === story.id && styles.storyTabActive]}>[ {bundle.route.stories[id].name} ]</Text>
            </Pressable>
          ))}
        </ScrollView>
        <StoryProgress story={story} progressMap={bundle.progressMap} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.pathViewport}
        contentContainerStyle={styles.pathScrollContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={(_width, height) => {
          setRouteContentHeight(height);
          restoreStoryPosition();
        }}
        onLayout={(event) => setRouteViewportHeight(event.nativeEvent.layout.height)}
        onScroll={(event) => rememberScrollPosition(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={100}
      >
        <View
          onLayout={(event) => setRouteWidth(event.nativeEvent.layout.width)}
          style={styles.routeMap}
        >
          <RouteConnector story={story} layouts={routeLayouts} routeWidth={routeWidth} />
          {visualItems.map((item) => {
            if (item.type === 'station') {
              return (
                <StationStone
                  key={item.key}
                  station={item.station}
                  index={item.index}
                  progressMap={bundle.progressMap}
                  routeWidth={routeWidth}
                  onLayout={(layout) => rememberRouteLayout(item.key, layout)}
                />
              );
            }
            if (item.type === 'section') {
              return (
                <View
                  key={item.key}
                  onLayout={(event) => rememberRouteLayout(item.key, event.nativeEvent.layout)}
                  style={styles.sectionHeadingBlock}
                >
                </View>
              );
            }
            return (
              <View
                key={item.key}
                onLayout={(event) => rememberRouteLayout(item.key, event.nativeEvent.layout)}
                style={styles.catalogHeadingBlock}
              >
                <Text style={styles.catalogHeading}>{item.catalog.name}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View pointerEvents="none" style={[styles.pathTopMask, { height: insets.top + 78 }]} />
      <View pointerEvents="none" style={[styles.pathBottomMask, { height: 34 + Math.max(insets.bottom, 4) }]} />
      <RouteScale
        story={story}
        scrollY={routeScrollY}
        contentHeight={routeContentHeight}
        viewportHeight={routeViewportHeight}
        onSelect={scrollToRouteAnchor}
      />
      <StoryStele story={story} />
      <Pressable
        accessibilityLabel={t('guide.help_app')}
        accessibilityRole="button"
        testID={testIds.path.help}
        onPress={openGuide}
        style={[styles.guideTrigger, { bottom: 70 + Math.max(insets.bottom, 4) }]}
      >
        <AlanIcon color={theme.colors.text} name="help" size={20} />
      </Pressable>
      <Pressable
        accessibilityLabel={t('path.words')}
        accessibilityRole="button"
        testID={testIds.path.words}
        onPress={() => router.push({ pathname: '/path/story-words', params: { storyId: story.id } })}
        style={[styles.storyWordsTrigger, { bottom: 18 + Math.max(insets.bottom, 4) }]}
      >
        <AlanIcon color={theme.colors.text} name="list" size={21} />
      </Pressable>
    </View>
  );
}

export function StoryWordsScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession();
  const params = useLocalSearchParams<{ storyId?: string }>();
  const { bundle, error, settings } = usePathBundle();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const searchRef = useRef<TextInput>(null);
  const userId = session.user?.id;
  const story = bundle?.route.stories[text(params.storyId)] ?? bundle?.route.stories[bundle.route.storyOrder[0]];
  const copy = WORD_LIST_COPY[settings.interface_language_code];
  const groups = useMemo(() => groupedStoryWords(story), [story]);
  const normalizedQuery = normalizedSearch(query, settings.interface_language_code);
  const visibleGroups = useMemo(() => groups.map(({ catalog, sections }) => ({
    catalog,
    sections: sections.map(({ section, entries }) => ({
      section,
      entries: entries.filter(({ word }) => !normalizedQuery || normalizedSearch(
        `${displayedAlanWord(word, settings)} ${displayedTranslation(word, settings)}`,
        settings.interface_language_code,
      ).includes(normalizedQuery)),
    })).filter((group) => group.entries.length),
  })).filter((group) => group.sections.length), [groups, normalizedQuery, settings]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void loadFavoriteIds(userId).then((ids) => {
        if (active) setFavorites(ids);
      });
    };
    refresh();
    const unsubscribe = subscribeScopedValue(STORAGE_KEYS.wordFavorites, userId, refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    setSearchOpen(false);
    setQuery('');
  }, [story?.id]);

  if (!bundle) return <LoadingState error={error} />;
  if (!story) return <LoadingState error={copy.notFound} />;

  const toggleSearch = () => {
    if (searchOpen) {
      setSearchOpen(false);
      setQuery('');
      searchRef.current?.blur();
      return;
    }
    setSearchOpen(true);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const toggleFavorite = (wordId: string) => {
    const active = !favorites.has(wordId);
    setFavorites((current) => {
      const next = new Set(current);
      if (active) next.add(wordId); else next.delete(wordId);
      return next;
    });
    void setFavorite(userId, wordId, active).catch(() => {
      void loadFavoriteIds(userId).then(setFavorites);
    });
  };

  return (
    <View style={styles.detailScreen}>
      <PracticeHeader
        title={copy.title}
        center={searchOpen ? <TextInput
          ref={searchRef}
          accessibilityLabel={copy.search}
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder={copy.search}
          placeholderTextColor={theme.colors.textSoft}
          returnKeyType="search"
          style={styles.storySearchInput}
          value={query}
        /> : undefined}
        action={<Pressable
          accessibilityLabel={searchOpen ? copy.close : copy.open}
          accessibilityRole="button"
          accessibilityState={{ expanded: searchOpen }}
          onPress={toggleSearch}
          style={({ pressed }) => [styles.storySearchButton, pressed && styles.controlPressed]}
        >
          <AlanIcon color={theme.colors.text} name={searchOpen ? 'close' : 'search'} size={searchOpen ? 22 : 21} />
        </Pressable>}
      />
      <ScrollView
        style={styles.wordList}
        contentContainerStyle={[styles.wordListContent, { paddingBottom: 28 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {!visibleGroups.length ? <Text style={styles.storyWordsEmpty}>{normalizedQuery ? copy.noResults : copy.empty}</Text> : null}
        {visibleGroups.map(({ catalog, sections }) => (
          <View key={catalog.id}>
            {catalog.name ? <Text style={styles.wordCatalogHeading}>{catalog.name}</Text> : null}
            {sections.map(({ section, entries }) => (
              <View key={section.id}>
                {thematicCatalog(catalog) && section.name ? <Text style={styles.wordSectionHeading}>{section.name}</Text> : null}
                {entries.map(({ word, ordinal }) => {
                  const favorite = favorites.has(word.word_id);
                  return (
                    <View key={word.word_id} style={styles.storyWordRow}>
                      <Text style={styles.wordOrder}>{ordinal}.</Text>
                      <View style={styles.wordCopy}>
                        <Text numberOfLines={1} style={styles.wordPrimary}>{displayedAlanWord(word, settings)}</Text>
                        <OverflowMarquee style={styles.wordSecondary}>{displayedTranslation(word, settings)}</OverflowMarquee>
                      </View>
                      <Pressable
                        accessibilityLabel={favorite ? copy.remove : copy.add}
                        accessibilityRole="button"
                        accessibilityState={{ selected: favorite }}
                        onPress={() => toggleFavorite(word.word_id)}
                        style={({ pressed }) => [styles.wordStarButton, pressed && styles.controlPressed]}
                      >
                        <Text style={[styles.wordStar, favorite && styles.wordStarActive]}>{favorite ? '★' : '☆'}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: theme.colors.background },
  errorText: { color: theme.colors.danger, fontSize: 13, textAlign: 'center' },
  pathScreen: { flex: 1, backgroundColor: theme.colors.background, overflow: 'hidden' },
  topographicBackdrop: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden' },
  sceneLight: { position: 'absolute', top: -90, left: -80, width: 360, height: 300, borderRadius: 180, backgroundColor: 'rgba(255,252,242,0.34)' },
  sceneShade: { position: 'absolute', right: -120, bottom: -110, width: 420, height: 360, borderRadius: 210, backgroundColor: 'rgba(188,176,151,0.16)' },
  contourGroup: { position: 'absolute' },
  contourRing: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(73,78,57,0.075)', borderRadius: 999 },
  pathTopMask: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 20, backgroundColor: 'rgba(238,233,223,0.62)' },
  pathBottomMask: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20, backgroundColor: 'rgba(238,233,223,0.82)' },
  pathHeader: { zIndex: 30, height: 68, paddingHorizontal: 8, paddingBottom: 4, backgroundColor: 'transparent' },
  storyTabs: { minWidth: '100%', alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  storyTabButton: { height: 32, justifyContent: 'center', paddingHorizontal: 4 },
  storyTab: { color: theme.colors.textSoft, fontSize: 11, fontWeight: '700' },
  storyTabActive: { color: theme.colors.text },
  storyProgressRow: { height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentedProgress: { width: 118, height: 5, flexDirection: 'row', gap: 2 },
  progressSegment: { flex: 1, borderRadius: 2, backgroundColor: 'rgba(84,76,64,0.13)' },
  progressSegmentFilled: { backgroundColor: theme.colors.accentStrong },
  progressPercent: { color: theme.colors.accentStrong, fontSize: 10, fontWeight: '800', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  progressCount: { color: theme.colors.textSoft, fontSize: 10, fontWeight: '700', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  pathViewport: { flex: 1 },
  pathScrollContent: { alignItems: 'center' },
  routeMap: { position: 'relative', zIndex: 1, width: '100%', maxWidth: 560, minHeight: 720, alignItems: 'center', paddingTop: 76, paddingRight: 50, paddingBottom: 108, paddingLeft: 20 },
  routeConnector: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 0 },
  routeConnectorSegment: { position: 'absolute', height: 0, borderTopWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(77,69,56,0.34)' },
  catalogHeadingBlock: { zIndex: 1, minHeight: 28, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 22, marginBottom: 118 },
  catalogHeading: { color: theme.colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  sectionHeadingBlock: { zIndex: 1, height: 92, width: '100%' },
  sectionHeading: { color: theme.colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center', maxWidth: 260 },
  stationNode: { zIndex: 1, width: 60, height: 60, marginBottom: 43, alignItems: 'center', overflow: 'visible' },
  stationPressed: { opacity: 0.8 },
  stationRing: { position: 'relative', width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  stationRingMark: { position: 'absolute', width: 3, height: 6, borderRadius: 2, backgroundColor: 'rgba(105,92,70,0.18)' },
  millstone: { position: 'absolute', left: 4, top: 4, width: 52, height: 52, borderRadius: 26, borderTopLeftRadius: 24, borderBottomRightRadius: 23, borderWidth: 1, borderColor: 'rgba(83,74,61,0.38)', backgroundColor: '#d6cdbd', alignItems: 'center', justifyContent: 'center', shadowColor: '#36322b', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  millstoneMastered: { backgroundColor: '#c9d0bd' },
  millstoneGrainOne: { position: 'absolute', left: 10, top: 9, width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  millstoneGrainTwo: { position: 'absolute', right: 9, bottom: 11, width: 4, height: 3, borderRadius: 2, backgroundColor: 'rgba(81,75,65,0.12)' },
  millstoneHole: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: 'rgba(83,74,61,0.24)' },
  stationOrdinal: { position: 'absolute', bottom: 7, color: theme.colors.textMuted, fontSize: 8, fontWeight: '800', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  stationMilestones: { position: 'absolute', top: 49, zIndex: 3, color: theme.colors.accentStrong, fontSize: 8, fontWeight: '900', letterSpacing: -1 },
  stationLabel: { position: 'absolute', top: 65, left: -41, width: 142, color: theme.colors.text, fontSize: 10, lineHeight: 12, fontWeight: '700', textAlign: 'center' },
  stationLabelReview: { color: '#9b7134' },
  stationCount: { position: 'absolute', top: 91, left: -41, width: 142, color: theme.colors.textSoft, fontSize: 8, fontWeight: '700', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'], textAlign: 'center' },
  routeScale: { position: 'absolute', right: 4, top: '22%', bottom: '17%', width: 26, alignItems: 'center', justifyContent: 'space-evenly', zIndex: 31 },
  scaleMarkButton: { flex: 1, width: 26, minHeight: 5, maxHeight: 17, alignItems: 'center', justifyContent: 'center' },
  scaleMarkPressed: { opacity: 0.55 },
  scaleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(73,66,56,0.28)' },
  scaleSection: { width: 6, height: 6, borderWidth: 1, borderColor: 'rgba(73,66,56,0.42)', transform: [{ rotate: '45deg' }] },
  scaleDiamond: { width: 8, height: 8, borderWidth: 1, borderColor: theme.colors.accentStrong, transform: [{ rotate: '45deg' }] },
  scaleMarkPassed: { borderColor: theme.colors.accentStrong, backgroundColor: 'rgba(101,73,31,0.72)' },
  scaleMarkCurrent: { borderWidth: 2, borderColor: theme.colors.accentStrong, backgroundColor: theme.colors.accentStrong },
  steleTrigger: { position: 'absolute', right: 10, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(238,233,223,0.94)', zIndex: 30 },
  steleClose: { position: 'absolute', right: 10, top: 10, zIndex: 3, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(246,242,233,0.88)' },
  guideTrigger: { position: 'absolute', left: 10, bottom: 70, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(238,233,223,0.94)', zIndex: 30 },
  storyWordsTrigger: { position: 'absolute', left: 10, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(238,233,223,0.94)', zIndex: 30 },
  steleBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: 'rgba(24,20,16,0.72)' },
  steleDialog: { width: '100%', maxWidth: 430, aspectRatio: 0.66 },
  steleArtwork: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  steleImage: { borderRadius: 8 },
  steleContent: { width: '66%', height: '64%', marginTop: '4%', alignItems: 'center' },
  steleTitle: { width: '100%', color: '#2c2419', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  steleBody: { width: '100%' },
  steleParagraph: { color: '#30291f', fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 9 },
  detailScreen: { flex: 1, backgroundColor: theme.colors.background },
  storySearchInput: { width: '100%', height: 44, borderBottomWidth: 1, borderBottomColor: theme.colors.line, color: theme.colors.text, paddingHorizontal: 8, fontSize: 13, fontWeight: '600' },
  storySearchButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  controlPressed: { opacity: 0.55, transform: [{ scale: 0.96 }] },
  wordList: { flex: 1 },
  wordListContent: { paddingHorizontal: 12, paddingBottom: 28 },
  wordCatalogHeading: { marginTop: 8, paddingHorizontal: 7, paddingTop: 10, paddingBottom: 8, color: theme.colors.text, fontSize: 15, fontWeight: '800', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  wordSectionHeading: { paddingHorizontal: 7, paddingVertical: 7, color: theme.colors.accentStrong, fontSize: 11, fontWeight: '800' },
  storyWordRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center' },
  wordOrder: { width: 36, color: theme.colors.textSoft, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  wordCopy: { flex: 1, minWidth: 0, height: 52, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  wordPrimary: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  wordSecondary: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 1 },
  wordStarButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  wordStar: { color: theme.colors.textSoft, fontSize: 22 },
  wordStarActive: { color: theme.colors.accentStrong },
  storyWordsEmpty: { paddingVertical: 42, color: theme.colors.textMuted, fontSize: 13, textAlign: 'center' },
});
