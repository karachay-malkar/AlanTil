import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { supabase } from '@/src/lib/supabase';
import {
  displayedAlanWord,
  displayedStoryCopy,
  displayedStructureName,
  displayedTranslation,
  loadAllWords,
  loadStoryCopy,
  type MobileWord,
  type StoryCopyRow,
} from '@/src/mobile/dictionary';
import { useSession } from '@/src/mobile/session';
import { useSettings, type UserSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

const STORY_ORDER = ['oblivion', 'roots', 'ascent', 'pathways'] as const;
const LEVEL_DICTIONARIES = new Set(['beginner', 'intermediate', 'advanced']);
const GUEST_PROGRESS_KEY = 'alantil_mobile_word_progress_guest_v1';
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

function text(value: unknown) {
  return String(value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ');
}

function numeric(value: unknown, fallback = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  if (!userId) {
    const raw = await AsyncStorage.getItem(GUEST_PROGRESS_KEY).catch(() => null);
    const parsed = raw ? JSON.parse(raw) : [];
    return { wordRows: normalizeProgressRows(parsed), setRows: [] };
  }

  const [wordResult, setResult] = await Promise.all([
    supabase.from('user_word_progress').select('*').eq('user_id', userId),
    supabase.from('user_set_progress').select('*').eq('user_id', userId),
  ]);
  if (wordResult.error) throw wordResult.error;
  if (setResult.error) throw setResult.error;
  return {
    wordRows: normalizeProgressRows(wordResult.data),
    setRows: (setResult.data ?? []) as Record<string, unknown>[],
  };
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

function StationStone({ station, index, progressMap }: { station: RouteStation; index: number; progressMap: Map<string, WordProgress> }) {
  const state = summary(station.words, progressMap);
  const status = stationStatus(station, progressMap);
  const milestones = Math.min(4, Math.floor(state.mastered / 20));
  const hideLabel = LEVEL_DICTIONARIES.has(station.dictionaryId);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/path/station', params: { key: station.key } })}
      style={[styles.stationNode, { transform: [{ translateX: index % 2 === 0 ? -64 : 64 }] }]}
    >
      {milestones ? <Text style={styles.stationMilestones}>{'⌃'.repeat(milestones)}</Text> : null}
      <View style={[
        styles.stationRing,
        status === 'studying' && styles.stationRingStudying,
        status === 'mastered' && styles.stationRingMastered,
        status === 'review' && styles.stationRingReview,
      ]}>
        <View style={[styles.millstone, status === 'mastered' && styles.millstoneMastered]}>
          <View style={styles.millstoneHole} />
          <Text style={styles.stationOrdinal}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
      </View>
      {!hideLabel ? <Text numberOfLines={2} style={[styles.stationLabel, status === 'review' && styles.stationLabelReview]}>{station.name}</Text> : null}
      <Text style={styles.stationCount}>{state.mastered}/{state.total}</Text>
    </Pressable>
  );
}

function StoryStele({ story }: { story: RouteStory }) {
  const session = useSession();
  const [open, setOpen] = useState(false);
  const scope = session.user?.id ? `user:${session.user.id}` : 'guest';
  const storageKey = `${STORY_STELE_SEEN_KEY}:${scope}`;

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

  const markSeen = async () => {
    const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
    const state = raw ? JSON.parse(raw) as Record<string, boolean> : {};
    if (!state[story.id]) await AsyncStorage.setItem(storageKey, JSON.stringify({ ...state, [story.id]: true }));
  };

  const close = () => {
    setOpen(false);
    void markSeen();
  };

  if (!story.intro) return null;
  return (
    <>
      <Pressable accessibilityLabel={story.name} onPress={() => setOpen(true)} style={styles.steleTrigger}>
        <Text style={styles.steleTriggerGlyph}>✦</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={close}>
        <Pressable style={styles.steleBackdrop} onPress={close}>
          <Pressable style={styles.steleDialog} onPress={(event) => event.stopPropagation()}>
            <ImageBackground
              source={require('../../assets/path/story-stele.webp')}
              resizeMode="contain"
              style={styles.steleArtwork}
              imageStyle={styles.steleImage}
            >
              <View style={styles.steleContent}>
                <Text numberOfLines={2} adjustsFontSizeToFit style={styles.steleTitle}>{story.name}</Text>
                <ScrollView style={styles.steleBody} showsVerticalScrollIndicator={false}>
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

function RouteScale({ story }: { story: RouteStory }) {
  const marks = useMemo(() => {
    const result: { key: string; type: 'dot' | 'section' | 'diamond' }[] = [];
    story.catalogs.forEach((catalog) => {
      result.push({ key: `d:${catalog.id}`, type: 'diamond' });
      catalog.sections.forEach((section) => {
        result.push({ key: `s:${catalog.id}:${section.id}`, type: 'section' });
        section.stations.forEach((station) => result.push({ key: `w:${station.key}`, type: 'dot' }));
      });
    });
    const max = 42;
    if (result.length <= max) return result;
    const step = result.length / max;
    return Array.from({ length: max }, (_, index) => result[Math.floor(index * step)]);
  }, [story]);

  return (
    <View pointerEvents="none" style={styles.routeScale}>
      {marks.map((mark) => (
        <View
          key={mark.key}
          style={mark.type === 'diamond' ? styles.scaleDiamond : mark.type === 'section' ? styles.scaleSection : styles.scaleDot}
        />
      ))}
    </View>
  );
}

export function PathRoot() {
  const insets = useSafeAreaInsets();
  const { bundle, error } = usePathBundle();
  const [activeStoryId, setActiveStoryId] = useState('oblivion');
  const scrollRef = useRef<ScrollView>(null);
  const positionedStory = useRef('');

  useEffect(() => {
    if (!bundle) return;
    if (!bundle.route.stories[activeStoryId]) setActiveStoryId(bundle.route.storyOrder[0] || 'oblivion');
  }, [bundle, activeStoryId]);

  if (!bundle) return <LoadingState error={error} />;
  const story = bundle.route.stories[activeStoryId] ?? bundle.route.stories[bundle.route.storyOrder[0]];
  if (!story) return <LoadingState error="Маршрут пока пуст." />;
  const stationIndex = new Map(story.stations.map((station, index) => [station.key, index]));

  const positionAtBottom = () => {
    if (positionedStory.current === story.id) return;
    positionedStory.current = story.id;
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
  };

  const switchStory = (storyId: string) => {
    positionedStory.current = '';
    setActiveStoryId(storyId);
  };

  return (
    <View style={[styles.pathScreen, { paddingTop: insets.top }] }>
      <View style={styles.pathHeader}>
        <Text style={styles.pathBrand}>Алан тил</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyTabs}>
          {bundle.route.storyOrder.map((id) => (
            <Pressable key={id} onPress={() => switchStory(id)} style={styles.storyTabButton}>
              <Text style={[styles.storyTab, id === story.id && styles.storyTabActive]}>[ {bundle.route.stories[id].name} ]</Text>
            </Pressable>
          ))}
        </ScrollView>
        <StoryProgress story={story} progressMap={bundle.progressMap} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.pathViewport}
        contentContainerStyle={styles.routeMap}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={positionAtBottom}
      >
        <View pointerEvents="none" style={styles.routeConnector} />
        {[...story.catalogs].reverse().map((catalog) => (
          <View key={catalog.id} style={styles.catalogBlock}>
            <View style={styles.catalogSections}>
              {[...catalog.sections].reverse().map((section) => (
                <View key={section.id} style={styles.sectionBlock}>
                  <View style={styles.stationList}>
                    {[...section.stations].reverse().map((station) => (
                      <StationStone
                        key={station.key}
                        station={station}
                        index={stationIndex.get(station.key) ?? 0}
                        progressMap={bundle.progressMap}
                      />
                    ))}
                  </View>
                  {section.name ? <Text style={styles.sectionHeading}>{section.name}</Text> : null}
                </View>
              ))}
            </View>
            <Text style={styles.catalogHeading}>{catalog.name}</Text>
          </View>
        ))}
      </ScrollView>

      <RouteScale story={story} />
      <StoryStele story={story} />
      <Pressable
        accessibilityLabel="Список слов"
        onPress={() => router.push({ pathname: '/path/story-words', params: { storyId: story.id } })}
        style={[styles.storyWordsTrigger, { bottom: 18 + Math.max(insets.bottom, 4) }]}
      >
        <Text style={styles.storyWordsGlyph}>≡</Text>
      </Pressable>
    </View>
  );
}

function DetailHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.detailHeader, { paddingTop: insets.top + 8 }] }>
      <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backGlyph}>‹</Text></Pressable>
      <View style={styles.detailHeaderCopy}>
        <Text numberOfLines={1} style={styles.detailTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.detailSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function StoryWordsScreen() {
  const params = useLocalSearchParams<{ storyId?: string }>();
  const { bundle, error, settings } = usePathBundle();
  if (!bundle) return <LoadingState error={error} />;
  const story = bundle.route.stories[text(params.storyId)] ?? bundle.route.stories[bundle.route.storyOrder[0]];
  if (!story) return <LoadingState error="История не найдена." />;

  return (
    <View style={styles.detailScreen}>
      <DetailHeader title={story.name} subtitle="Слова истории" />
      <ScrollView style={styles.wordList} contentContainerStyle={styles.wordListContent} showsVerticalScrollIndicator={false}>
        {story.catalogs.map((catalog) => (
          <View key={catalog.id}>
            <Text style={styles.wordCatalogHeading}>{catalog.name}</Text>
            {catalog.sections.map((section) => (
              <View key={section.id}>
                {section.name ? <Text style={styles.wordSectionHeading}>{section.name}</Text> : null}
                {section.stations.flatMap((station) => station.words).map((word) => (
                  <View key={word.word_id} style={styles.storyWordRow}>
                    <Text style={styles.wordOrder}>{word.global_order ?? ''}</Text>
                    <View style={styles.wordCopy}>
                      <Text numberOfLines={1} style={styles.wordPrimary}>{displayedAlanWord(word, settings)}</Text>
                      <Text numberOfLines={2} style={styles.wordSecondary}>{displayedTranslation(word, settings)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

export function StationScreen() {
  const params = useLocalSearchParams<{ key?: string }>();
  const { bundle, error, settings } = usePathBundle();
  const [tab, setTab] = useState<'words' | 'stats'>('words');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const station = bundle?.route.byKey.get(text(params.key));
  useEffect(() => {
    if (station) setSelected(new Set(station.words.map((word) => word.word_id)));
  }, [station?.key]);

  if (!bundle) return <LoadingState error={error} />;
  if (!station) return <LoadingState error="Этап не найден." />;
  const state = summary(station.words, bundle.progressMap);
  const attempts = station.words.reduce((total, word) => {
    const progress = bundle.progressMap.get(word.word_id);
    return total + Number(progress?.test_correct_count || 0) + Number(progress?.test_wrong_count || 0);
  }, 0);

  const toggle = (id: string) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <View style={styles.detailScreen}>
      <DetailHeader title={station.name} subtitle={station.sectionName || station.dictionaryName} />
      <View style={styles.stationTabs}>
        <Pressable onPress={() => setTab('words')}><Text style={[styles.stationTab, tab === 'words' && styles.stationTabActive]}>СЛОВА</Text></Pressable>
        <Pressable onPress={() => setTab('stats')}><Text style={[styles.stationTab, tab === 'stats' && styles.stationTabActive]}>СТАТИСТИКА</Text></Pressable>
      </View>

      {tab === 'words' ? (
        <>
          <View style={styles.stationToolbar}>
            <Text style={styles.stationToolbarText}>Выбрано {selected.size}/{station.words.length}</Text>
            <Pressable onPress={() => setSelected(new Set(station.words.map((word) => word.word_id)))}>
              <Text style={styles.toolbarAction}>Все</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.stationWordList} contentContainerStyle={styles.stationWordListContent}>
            {station.words.map((word) => {
              const on = selected.has(word.word_id);
              return (
                <Pressable key={word.word_id} onPress={() => toggle(word.word_id)} style={styles.stationWordRow}>
                  <View style={[styles.checkCircle, on && styles.checkCircleOn]}>{on ? <Text style={styles.checkMark}>✓</Text> : null}</View>
                  <View style={styles.wordCopy}>
                    <Text numberOfLines={1} style={styles.wordPrimary}>{displayedAlanWord(word, settings)}</Text>
                    <Text numberOfLines={1} style={styles.wordSecondary}>{displayedTranslation(word, settings)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.stationLaunchPanel}>
            <View style={styles.directionControl}>
              <Text style={styles.directionLabel}>НАПРАВЛЕНИЕ</Text>
              <View style={styles.directionPill}><Text style={styles.directionActive}>Алан → перевод</Text></View>
            </View>
            <View style={styles.launchActions}>
              <Pressable disabled style={[styles.launchButton, styles.launchButtonDisabled]}><Text style={styles.launchButtonText}>ТЕСТ</Text></Pressable>
              <Pressable disabled style={[styles.launchButton, styles.launchPrimary, styles.launchButtonDisabled]}><Text style={styles.launchPrimaryText}>УЧИТЬ СЛОВА</Text></Pressable>
            </View>
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.statsContent}>
          <View style={styles.statsSummary}>
            <View><Text style={styles.statLabel}>ОСВОЕНО</Text><Text style={styles.statBig}>{state.percent}%</Text></View>
            <View style={styles.masteryBadge}><Text style={styles.masteryGlyph}>{state.percent === 100 ? '⌃⌃⌃' : state.mastered ? '⌃' : '—'}</Text><Text style={styles.masterySmall}>ЭТАП</Text></View>
          </View>
          <View style={styles.metricGrid}>
            <View style={styles.metric}><Text style={styles.metricValue}>{state.mastered}</Text><Text style={styles.metricLabel}>освоено</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{state.review}</Text><Text style={styles.metricLabel}>повторить</Text></View>
            <View style={styles.metric}><Text style={styles.metricValue}>{attempts}</Text><Text style={styles.metricLabel}>ответов</Text></View>
          </View>
          <Text style={styles.statsHeading}>Прогресс этапа</Text>
          <View style={styles.statsLine}><Text style={styles.statsLineLabel}>Слова</Text><Text style={styles.statsLineValue}>{state.mastered}/{state.total}</Text></View>
          <View style={styles.statsLine}><Text style={styles.statsLineLabel}>Синхронизация</Text><Text style={styles.statsLineValue}>{bundle.setProgressRows.length ? 'облако' : 'локально'}</Text></View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: theme.colors.background },
  errorText: { color: theme.colors.danger, fontSize: 13, textAlign: 'center' },
  pathScreen: { flex: 1, backgroundColor: theme.colors.background, overflow: 'hidden' },
  pathHeader: { zIndex: 10, paddingTop: 6, paddingHorizontal: 8, paddingBottom: 4, backgroundColor: theme.colors.background },
  pathBrand: { marginLeft: 8, marginBottom: 3, color: theme.colors.text, fontSize: 16, fontWeight: '700' },
  storyTabs: { minWidth: '100%', alignItems: 'center', gap: 3, paddingHorizontal: 4 },
  storyTabButton: { minHeight: 30, justifyContent: 'center', paddingHorizontal: 3 },
  storyTab: { color: theme.colors.textSoft, fontSize: 11, fontWeight: '700' },
  storyTabActive: { color: theme.colors.text },
  storyProgressRow: { height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentedProgress: { width: 118, height: 5, flexDirection: 'row', gap: 2 },
  progressSegment: { flex: 1, borderRadius: 2, backgroundColor: 'rgba(84,76,64,0.13)' },
  progressSegmentFilled: { backgroundColor: theme.colors.accentStrong },
  progressPercent: { color: theme.colors.accentStrong, fontSize: 10, fontWeight: '800' },
  progressCount: { color: theme.colors.textSoft, fontSize: 10, fontWeight: '700' },
  pathViewport: { flex: 1 },
  routeMap: { minHeight: 720, alignItems: 'center', paddingTop: 76, paddingBottom: 108, paddingHorizontal: 50, gap: 64 },
  routeConnector: { position: 'absolute', top: 42, bottom: 42, left: '50%', width: 1, borderLeftWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(77,69,56,0.24)' },
  catalogBlock: { alignItems: 'center', gap: 28 },
  catalogSections: { alignItems: 'center', gap: 54 },
  catalogHeading: { color: theme.colors.text, fontSize: 17, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  sectionBlock: { alignItems: 'center', gap: 28 },
  sectionHeading: { color: theme.colors.text, fontSize: 14, fontWeight: '800', textAlign: 'center', maxWidth: 260 },
  stationList: { alignItems: 'center', gap: 43 },
  stationNode: { width: 160, minHeight: 116, alignItems: 'center', overflow: 'visible' },
  stationRing: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(105,92,70,0.22)', padding: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,107,59,0.06)' },
  stationRingStudying: { borderColor: theme.colors.accentStrong },
  stationRingMastered: { borderColor: '#557a5c' },
  stationRingReview: { borderColor: '#9b7134' },
  millstone: { width: 56, height: 56, borderRadius: 27, borderTopLeftRadius: 25, borderBottomRightRadius: 24, borderWidth: 1, borderColor: 'rgba(83,74,61,0.34)', backgroundColor: '#d6cdbd', alignItems: 'center', justifyContent: 'center' },
  millstoneMastered: { backgroundColor: '#c9d0bd' },
  millstoneHole: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: 'rgba(83,74,61,0.24)' },
  stationOrdinal: { position: 'absolute', bottom: 7, color: theme.colors.textMuted, fontSize: 8, fontWeight: '800' },
  stationMilestones: { position: 'absolute', top: -2, zIndex: 3, color: theme.colors.accentStrong, fontSize: 9, fontWeight: '900', letterSpacing: -1 },
  stationLabel: { width: 142, marginTop: 5, color: theme.colors.text, fontSize: 10, lineHeight: 12, fontWeight: '700', textAlign: 'center' },
  stationLabelReview: { color: '#9b7134' },
  stationCount: { marginTop: 3, color: theme.colors.textSoft, fontSize: 8, fontWeight: '700' },
  routeScale: { position: 'absolute', right: 4, top: '30%', bottom: '18%', width: 26, alignItems: 'center', justifyContent: 'space-evenly', zIndex: 20 },
  scaleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(73,66,56,0.28)' },
  scaleSection: { width: 6, height: 6, borderWidth: 1, borderColor: 'rgba(73,66,56,0.42)', transform: [{ rotate: '45deg' }] },
  scaleDiamond: { width: 8, height: 8, borderWidth: 1, borderColor: theme.colors.accentStrong, transform: [{ rotate: '45deg' }] },
  steleTrigger: { position: 'absolute', left: 14, bottom: 18, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(238,233,223,0.94)', zIndex: 30 },
  steleTriggerGlyph: { color: theme.colors.accentStrong, fontSize: 18 },
  storyWordsTrigger: { position: 'absolute', right: 38, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, backgroundColor: 'rgba(238,233,223,0.94)', zIndex: 30 },
  storyWordsGlyph: { color: theme.colors.text, fontSize: 24, lineHeight: 25, transform: [{ rotate: '90deg' }] },
  steleBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: 'rgba(24,20,16,0.72)' },
  steleDialog: { width: '100%', maxWidth: 430, aspectRatio: 0.66 },
  steleArtwork: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  steleImage: { borderRadius: 8 },
  steleContent: { width: '66%', height: '64%', marginTop: '4%', alignItems: 'center' },
  steleTitle: { width: '100%', color: '#2c2419', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  steleBody: { width: '100%' },
  steleParagraph: { color: '#30291f', fontSize: 13, lineHeight: 18, textAlign: 'center', marginBottom: 9 },
  detailScreen: { flex: 1, backgroundColor: theme.colors.background },
  detailHeader: { minHeight: 76, paddingHorizontal: 12, paddingBottom: 9, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backGlyph: { color: theme.colors.text, fontSize: 38, lineHeight: 39, fontWeight: '300' },
  detailHeaderCopy: { flex: 1, minWidth: 0, paddingRight: 40 },
  detailTitle: { color: theme.colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  detailSubtitle: { marginTop: 2, color: theme.colors.textMuted, fontSize: 11, textAlign: 'center' },
  wordList: { flex: 1 },
  wordListContent: { paddingHorizontal: 14, paddingBottom: 28 },
  wordCatalogHeading: { marginTop: 20, paddingBottom: 8, color: theme.colors.text, fontSize: 17, fontWeight: '850', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  wordSectionHeading: { marginTop: 16, paddingBottom: 6, color: theme.colors.text, fontSize: 14, fontWeight: '800' },
  storyWordRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, gap: 9 },
  wordOrder: { width: 34, color: theme.colors.textSoft, fontSize: 10, textAlign: 'right' },
  wordCopy: { flex: 1, minWidth: 0, paddingVertical: 7 },
  wordPrimary: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  wordSecondary: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 },
  stationTabs: { height: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 58, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  stationTab: { color: theme.colors.textSoft, fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  stationTabActive: { color: theme.colors.text },
  stationToolbar: { height: 38, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 16 },
  stationToolbarText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '700' },
  toolbarAction: { color: theme.colors.accentStrong, fontSize: 11, fontWeight: '800' },
  stationWordList: { flex: 1 },
  stationWordListContent: { paddingHorizontal: 12, paddingBottom: 126 },
  stationWordRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center' },
  checkCircleOn: { borderColor: theme.colors.accentStrong, backgroundColor: 'rgba(139,107,59,0.10)' },
  checkMark: { color: theme.colors.accentStrong, fontSize: 13, fontWeight: '900' },
  stationLaunchPanel: { position: 'absolute', left: 12, right: 12, bottom: 10, paddingTop: 7, gap: 7, backgroundColor: 'rgba(238,233,223,0.96)' },
  directionControl: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  directionLabel: { color: theme.colors.textSoft, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  directionPill: { borderWidth: 1, borderColor: theme.colors.line, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 12 },
  directionActive: { color: theme.colors.text, fontSize: 10, fontWeight: '700' },
  launchActions: { flexDirection: 'row', gap: 7 },
  launchButton: { flex: 0.78, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 8 },
  launchPrimary: { flex: 1.22, backgroundColor: theme.colors.accentStrong, borderColor: theme.colors.accentStrong },
  launchButtonDisabled: { opacity: 0.42 },
  launchButtonText: { color: theme.colors.text, fontSize: 10, fontWeight: '800' },
  launchPrimaryText: { color: theme.colors.inverse, fontSize: 10, fontWeight: '800' },
  statsContent: { padding: 14, paddingBottom: 40 },
  statsSummary: { minHeight: 92, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  statLabel: { color: theme.colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  statBig: { marginTop: 6, color: theme.colors.text, fontSize: 28, fontWeight: '800' },
  masteryBadge: { width: 78, height: 64, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line },
  masteryGlyph: { color: theme.colors.accentStrong, fontSize: 17, fontWeight: '900' },
  masterySmall: { marginTop: 4, color: theme.colors.textMuted, fontSize: 8 },
  metricGrid: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  metric: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: theme.colors.lineSoft },
  metricValue: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  metricLabel: { marginTop: 4, color: theme.colors.textMuted, fontSize: 10 },
  statsHeading: { marginTop: 18, paddingBottom: 8, color: theme.colors.text, fontSize: 15, fontWeight: '800', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  statsLine: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  statsLineLabel: { flex: 1, color: theme.colors.text, fontSize: 13 },
  statsLineValue: { color: theme.colors.textMuted, fontSize: 12 },
});
