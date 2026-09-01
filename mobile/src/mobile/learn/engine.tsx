import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createActivitySession,
  completeActivitySession,
  interruptActivitySession,
  persistActivitySession,
  resumeActivitySession,
  type ActivityRuntime,
} from '@/src/mobile/activity-session';
import { displayedAlanWord, displayedExamples, displayedTranslation, loadAllWords, type MobileWord } from '@/src/mobile/dictionary';
import { AlanIcon } from '@/src/mobile/icons';
import { useI18n } from '@/src/mobile/i18n';
import {
  applyLearnDecision,
  createLearnState,
  filterLearnWordsBySelection,
  learningSessionPayload,
  learnQueue,
  normalizeLearnDirection,
  normalizeLearnSource,
  restoreLearnState,
  splitMeaningGroups,
  undoLearnDecision,
  type LearnEntry,
  type LearnState,
} from '@/src/mobile/learn/policy';
import { favoriteWords, loadFavoriteIds, setFavorite } from '@/src/mobile/practice/repository';
import { recordLocalLearn } from '@/src/mobile/progress/guest';
import { markSetCompleted, markSetStarted } from '@/src/mobile/progress/repository';
import { markStationCardsCompleted, markStationStarted, type StationDescriptor } from '@/src/mobile/progress/station';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';
import { useSessionExitGuard } from '@/src/mobile/use-session-exit';

type LearnWord = {
  id: string;
  word: string;
  trans: string;
  source: MobileWord;
  examples: { example: string; translation: string }[];
};

function stationFrom(params: Record<string, string | string[] | undefined>): StationDescriptor | null {
  const value = (key: string) => String(params[key] ?? '').trim();
  const station = { storyId: value('storyId'), dictionaryId: value('dictionaryId'), sectionId: value('sectionId'), setId: value('setId') };
  return Object.values(station).every(Boolean) ? station : null;
}

function MeaningGroups({ groups, large = false }: { groups: string[]; large?: boolean }) {
  if (groups.length <= 1) {
    return <Text style={[styles.meaningSingle, large && styles.meaningSingleLarge]}>{groups[0] ?? ''}</Text>;
  }
  return <View style={styles.meaningList}>
    {groups.map((group, index) => <View key={`${group}:${index}`} style={styles.meaningRow}>
      <Text style={styles.meaningNumber}>{index + 1}</Text>
      <Text style={[styles.meaningText, large && styles.meaningTextLarge]}>{group}</Text>
    </View>)}
  </View>;
}

function ResultMetric({ value, label }: { value: number; label: string }) {
  return <View style={styles.metric}>
    <Text style={styles.metricValue}>{value}</Text>
    <Text style={styles.metricLabel}>{label}</Text>
  </View>;
}

export default function LearnSessionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    source?: string;
    storyId?: string;
    dictionaryId?: string;
    sectionId?: string;
    setId?: string;
    direction?: string;
    selectedIds?: string;
  }>();
  const auth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const source: LearnState['source'] = normalizeLearnSource(params.source);
  const routeDirection: LearnState['direction'] = normalizeLearnDirection(params.direction);
  const station = useMemo(() => stationFrom(params), [params.storyId, params.dictionaryId, params.sectionId, params.setId]);
  const [runtime, setRuntime] = useState<ActivityRuntime | null>(null);
  const [pool, setPool] = useState<LearnWord[]>([]);
  const [state, setState] = useState<LearnState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<{ entries: LearnEntry[]; known: number } | null>(null);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [cardWidth, setCardWidth] = useState(320);
  const translateX = useRef(new Animated.Value(0)).current;
  const flipProgress = useRef(new Animated.Value(0)).current;
  const entryOpacity = useRef(new Animated.Value(1)).current;
  const animatingRef = useRef(false);

  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useEffect(() => {
    if (!reduceMotion) return;
    translateX.stopAnimation();
    flipProgress.stopAnimation();
    entryOpacity.stopAnimation();
    translateX.setValue(0);
    flipProgress.setValue(revealed ? 1 : 0);
    entryOpacity.setValue(1);
  }, [reduceMotion, entryOpacity, flipProgress, revealed, translateX]);

  useEffect(() => {
    let active = true;
    async function boot() {
      try {
        let words: LearnWord[];
        if (source === 'favorites') {
          const favoritePool = await favoriteWords(settings, auth.user?.id);
          words = favoritePool.map((word) => ({
            id: word.id,
            word: word.word,
            trans: word.trans,
            source: word.source,
            examples: displayedExamples(word.source, settings),
          }));
        } else {
          const all = await loadAllWords();
          if (!station) throw new Error(t('learn.station_missing'));
          words = all
            .filter((word) => String(word.dictionary_id) === station.dictionaryId && String(word.section_id) === station.sectionId && String(word.set_id) === station.setId)
            .map((word) => ({
              id: word.word_id,
              word: displayedAlanWord(word, settings),
              trans: displayedTranslation(word, settings),
              source: word,
              examples: displayedExamples(word, settings),
            }))
            .filter((word) => word.id && word.word && word.trans);
        }
        words = filterLearnWordsBySelection(words, params.selectedIds);
        if (!words.length) throw new Error(t('learn.no_words'));

        const resumed = await resumeActivitySession<LearnState>('learn', auth.user?.id);
        const restored = resumed?.payload?.source === source
          ? restoreLearnState(resumed.payload, words, { source })
          : null;
        const canResume = Boolean(restored && resumed);
        const nextRuntime = canResume && resumed ? resumed.runtime : await createActivitySession('learn', settings, auth.user?.id);
        const nextState = restored ?? createLearnState(words, { source, direction: routeDirection });
        if (station && source === 'station' && !canResume) {
          await Promise.all([
            markSetStarted(auth.user?.id, station.dictionaryId, station.sectionId, station.setId),
            markStationStarted(station, auth.user?.id),
          ]);
        }
        const favoriteIds = await loadFavoriteIds(auth.user?.id);
        if (!active) return;
        setFavorites(favoriteIds);
        setPool(words);
        setRuntime(nextRuntime);
        setState(nextState);
        setBusy(false);
      } catch (reason) {
        if (active) {
          setError(String((reason as { message?: string })?.message ?? reason));
          setBusy(false);
        }
      }
    }
    void boot();
    return () => { active = false; };
  }, [
    auth.user?.id,
    params.selectedIds,
    routeDirection,
    settings.alan_dialect_code,
    settings.alan_script_code,
    settings.interface_language_code,
    settings.translation_language_code,
    source,
    station,
    t,
  ]);

  const byId = useMemo(() => new Map(pool.map((word) => [word.id, word])), [pool]);
  const queue = state ? learnQueue(state) : [];
  const currentId = queue[0];
  const current = currentId ? byId.get(currentId) : null;

  const sessionPayload = useCallback((value: LearnState) => learningSessionPayload(value, {
    dictionaryId: station?.dictionaryId ?? 'favorites',
    sectionId: station?.sectionId ?? 'favorites',
    setId: station?.setId ?? 'favorites',
  }), [station?.dictionaryId, station?.sectionId, station?.setId]);

  const requestLeave = useSessionExitGuard(Boolean(runtime && state && !result), useCallback(async (reason: string) => {
    if (!runtime || !state) return;
    await interruptActivitySession(runtime, sessionPayload(state), reason);
  }, [runtime, sessionPayload, state]));

  const finish = useCallback(async (nextState: LearnState) => {
    if (!runtime) return;
    setBusy(true);
    const entries = Object.values(nextState.entries);
    const known = entries.filter((entry) => entry.final_result === 'known').length;
    let endedAt = new Date().toISOString();
    const warnings: string[] = [];
    try {
      const final = await completeActivitySession(runtime, sessionPayload(nextState));
      endedAt = String(final.ended_at || endedAt);
    } catch {
      warnings.push(t('learn.session_save_error'));
    }
    try {
      await recordLocalLearn(entries, endedAt, auth.user?.id);
    } catch {
      warnings.push(t('learn.progress_pending'));
    }
    if (station && source === 'station') {
      try {
        await Promise.all([
          markSetCompleted(auth.user?.id, station.dictionaryId, station.sectionId, station.setId),
          markStationCardsCompleted(station, auth.user?.id),
        ]);
      } catch {
        warnings.push(t('learn.stage_pending'));
      }
    }
    setNotice(warnings.join(' '));
    setResult({ entries, known });
    setBusy(false);
  }, [auth.user?.id, runtime, sessionPayload, source, station, t]);

  const commitDecision = useCallback(async (known: boolean) => {
    if (!state || !runtime || !currentId) return false;
    const next = applyLearnDecision(state, currentId, known);
    const completed = learnQueue(next).length === 0;
    setRevealed(false);
    setState(next);
    try {
      await persistActivitySession(runtime, next);
    } catch {
      setNotice(t('learn.position_save_error'));
    }
    if (completed) await finish(next);
    return completed;
  }, [currentId, finish, runtime, state, t]);

  const animateEntry = useCallback(() => {
    if (reduceMotion) {
      entryOpacity.setValue(1);
      return;
    }
    entryOpacity.setValue(0);
    Animated.timing(entryOpacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [entryOpacity, reduceMotion]);

  const animateDecision = useCallback((known: boolean) => {
    if (animatingRef.current || !state || !runtime || !currentId) return;
    animatingRef.current = true;
    setAnimating(true);
    const completeMove = async () => {
      translateX.setValue(0);
      flipProgress.setValue(0);
      setRevealed(false);
      try {
        const completed = await commitDecision(known);
        if (!completed) animateEntry();
      } finally {
        animatingRef.current = false;
        setAnimating(false);
      }
    };
    if (reduceMotion) {
      void completeMove();
      return;
    }
    const target = (known ? 1 : -1) * Math.max(420, cardWidth * 1.4);
    Animated.timing(translateX, { toValue: target, duration: 210, useNativeDriver: true }).start(({ finished }) => {
      if (finished) void completeMove();
      else {
        animatingRef.current = false;
        setAnimating(false);
      }
    });
  }, [animateEntry, cardWidth, commitDecision, currentId, flipProgress, reduceMotion, runtime, state, translateX]);

  const springCardBack = useCallback(() => {
    if (reduceMotion) {
      translateX.setValue(0);
      return;
    }
    Animated.spring(translateX, {
      toValue: 0,
      damping: 18,
      stiffness: 190,
      mass: 0.7,
      overshootClamping: true,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, translateX]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderGrant: () => { translateX.stopAnimation(); },
    onPanResponderMove: (_event, gesture) => { if (!reduceMotion) translateX.setValue(gesture.dx); },
    onPanResponderRelease: (_event, gesture) => {
      const threshold = Math.max(64, cardWidth * 0.28);
      if (Math.abs(gesture.dx) >= threshold) animateDecision(gesture.dx > 0);
      else springCardBack();
    },
    onPanResponderTerminate: springCardBack,
    onPanResponderTerminationRequest: () => true,
  }), [animateDecision, cardWidth, reduceMotion, springCardBack, translateX]);

  const toggleReveal = useCallback(() => {
    if (animatingRef.current) return;
    const next = !revealed;
    setRevealed(next);
    if (reduceMotion) {
      flipProgress.setValue(next ? 1 : 0);
      return;
    }
    Animated.spring(flipProgress, {
      toValue: next ? 1 : 0,
      damping: 17,
      stiffness: 150,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [flipProgress, reduceMotion, revealed]);

  const restoreLastDecision = useCallback(async () => {
    if (!state || !runtime || animatingRef.current) return;
    const restored = undoLearnDecision(state);
    if (!restored) return;
    animatingRef.current = true;
    setAnimating(true);
    translateX.setValue(0);
    flipProgress.setValue(0);
    setRevealed(false);
    setState(restored);
    try {
      await persistActivitySession(runtime, restored);
      animateEntry();
    } catch {
      setNotice(t('learn.undo_save_error'));
    } finally {
      animatingRef.current = false;
      setAnimating(false);
    }
  }, [animateEntry, flipProgress, runtime, state, t, translateX]);

  const toggleFavorite = useCallback((wordId: string) => {
    const active = !favorites.has(wordId);
    setFavorites((currentSet) => {
      const next = new Set(currentSet);
      if (active) next.add(wordId); else next.delete(wordId);
      return next;
    });
    void setFavorite(auth.user?.id, wordId, active).catch(() => {
      setFavorites((currentSet) => {
        const next = new Set(currentSet);
        if (active) next.delete(wordId); else next.add(wordId);
        return next;
      });
      setNotice(t('learn.favorite_error'));
    });
  }, [auth.user?.id, favorites, t]);

  if (result) {
    const repeatCount = result.entries.reduce((sum, entry) => sum + entry.left_swipe_count, 0);
    const problemEntries = result.entries
      .filter((entry) => entry.left_swipe_count > 0)
      .sort((left, right) => right.left_swipe_count - left.left_swipe_count);
    const problemById = new Map(problemEntries.map((entry) => [entry.word_id, entry]));
    const problemWords = pool.filter((word) => problemById.has(word.id)).sort((left, right) => {
      return (problemById.get(right.id)?.left_swipe_count ?? 0) - (problemById.get(left.id)?.left_swipe_count ?? 0);
    });
    return <View testID={testIds.learn.result} style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]}>
      <Text style={styles.resultTitle}>{t('learn.completed')}</Text>
      <View style={styles.metrics}>
        <ResultMetric value={result.entries.length} label={t('learn.metric.studied')} />
        <ResultMetric value={problemEntries.length} label={t('learn.metric.difficult')} />
        <ResultMetric value={repeatCount} label={t('learn.metric.repeats')} />
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {problemWords.length ? <>
        <Text style={styles.sectionTitle}>{t('learn.problem_words')}</Text>
        <ScrollView style={styles.resultList} contentContainerStyle={styles.resultListContent}>
          {problemWords.map((word) => {
            const entry = problemById.get(word.id)!;
            const favorite = favorites.has(word.id);
            return <View key={word.id} style={styles.resultRow}>
              <View style={styles.resultCopy}>
                <Text style={styles.resultWord}>{word.word}</Text>
                <Text style={styles.resultTrans}>{word.trans}</Text>
                <Text style={styles.resultRepeats}>{t('learn.did_not_know', { count: entry.left_swipe_count })}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={favorite ? t('learn.remove_favorite', { word: word.word }) : t('learn.add_favorite', { word: word.word })}
                accessibilityState={{ selected: favorite }}
                testID={scopedTestId('learn.result.favorite', word.id)}
                onPress={() => toggleFavorite(word.id)}
                style={({ pressed }) => [styles.starButton, pressed && styles.pressed]}
              >
                <Text style={[styles.star, favorite && styles.starOn]}>★</Text>
              </Pressable>
            </View>;
          })}
        </ScrollView>
      </> : <View style={styles.perfect}>
        <Text style={styles.perfectMark}>✓</Text>
        <Text style={styles.perfectTitle}>{t('learn.perfect')}</Text>
        <Text style={styles.perfectCopy}>{t('learn.perfect_body')}</Text>
      </View>}
      <Pressable
        accessibilityRole="button"
        testID={testIds.learn.done}
        onPress={() => router.replace(source === 'favorites' ? '/practice/favorites' : {
          pathname: '/path/station',
          params: { key: [station!.storyId, station!.dictionaryId, station!.sectionId, station!.setId].join('::') },
        })}
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>{source === 'favorites' ? t('learn.to_favorites').toUpperCase() : t('learn.to_stage').toUpperCase()}</Text>
      </Pressable>
    </View>;
  }

  if (busy) return <View style={styles.center}><ActivityIndicator color={theme.colors.accentStrong} /></View>;
  if (error || !state || !runtime || !current) return <View style={styles.center}><Text style={styles.error}>{error || t('learn.session_ended')}</Text></View>;

  const frontGroups = state.direction === 'ru_alan' ? splitMeaningGroups(current.trans) : splitMeaningGroups(current.word);
  const backGroups = state.direction === 'ru_alan' ? splitMeaningGroups(current.word) : splitMeaningGroups(current.trans);
  const translationLabel = settings.translation_language_code === 'en' ? 'ENGLISH' : settings.translation_language_code === 'tr' ? 'TÜRKÇE' : 'РУССКИЙ';
  const frontLabel = state.direction === 'ru_alan' ? translationLabel : t('learn.alan');
  const backLabel = state.direction === 'ru_alan' ? t('learn.alan') : translationLabel;
  const completed = Math.min(state.ids.length, state.index);
  const isFavorite = favorites.has(current.id);
  const frontRotation = flipProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const backRotation = flipProgress.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const cardRotation = translateX.interpolate({ inputRange: [-cardWidth, 0, cardWidth], outputRange: ['-12deg', '0deg', '12deg'], extrapolate: 'clamp' });

  return <View testID={testIds.learn.screen} style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 8) }]}>
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('learn.back')}
          onPress={() => requestLeave('header_back')}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <AlanIcon color={theme.colors.textMuted} name="back" size={22} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('learn.help')}
          onPress={() => setHelpOpen(true)}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
        >
          <AlanIcon color={theme.colors.textMuted} name="help" size={20} />
        </Pressable>
      </View>
      <Text style={styles.title}>{source === 'favorites' ? t('practice.favorites.title') : t('learn.title')}</Text>
      <View style={styles.counterBox}>
        <Text style={styles.counter}>{completed}/{state.ids.length}</Text>
        {state.repeatIds.length ? <Text style={styles.repeatCounter}>{t('learn.repeat_count', { count: state.repeatIds.length })}</Text> : null}
      </View>
    </View>
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}

    <View style={styles.cardStage} onLayout={(event) => setCardWidth(Math.max(1, event.nativeEvent.layout.width))}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cardDeck,
          { opacity: entryOpacity, transform: [{ translateX }, { rotateZ: cardRotation }] },
        ]}
      >
        <Animated.View
          pointerEvents={revealed ? 'none' : 'auto'}
          style={[styles.cardFace, { transform: [{ perspective: 1100 }, { rotateY: frontRotation }] }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('learn.show_back', { word: frontGroups.join(', ') })}
            accessibilityState={{ expanded: revealed }}
            testID={testIds.learn.reveal}
            onPress={toggleReveal}
            style={styles.cardPress}
          >
            <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sideLabel}>{frontLabel}</Text>
              <MeaningGroups groups={frontGroups} large />
              <Text style={styles.flipHint}>{t('learn.flip')}</Text>
            </ScrollView>
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={revealed ? 'auto' : 'none'}
          style={[styles.cardFace, { transform: [{ perspective: 1100 }, { rotateY: backRotation }] }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('learn.show_front', { word: backGroups.join(', ') })}
            accessibilityState={{ expanded: revealed }}
            testID={testIds.learn.hide}
            onPress={toggleReveal}
            style={styles.cardPress}
          >
            <ScrollView contentContainerStyle={styles.cardContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sideLabel}>{backLabel}</Text>
              <MeaningGroups groups={backGroups} />
              {current.examples.length ? <View style={styles.examples}>
                <Text style={styles.examplesTitle}>{t('learn.examples')}</Text>
                {current.examples.slice(0, 4).map((example, index) => <View key={`${example.example}:${index}`} style={styles.exampleBlock}>
                  <Text style={styles.example}>{state.direction === 'ru_alan' ? example.translation : example.example}</Text>
                  <Text style={styles.exampleTranslation}>{state.direction === 'ru_alan' ? example.example : example.translation}</Text>
                </View>)}
              </View> : null}
              <Text style={styles.flipHint}>{t('learn.flip_back')}</Text>
            </ScrollView>
          </Pressable>
        </Animated.View>

        <View pointerEvents="box-none" style={styles.cardTools}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('learn.undo')}
            accessibilityState={{ disabled: !state.undo || animating }}
            testID={testIds.learn.undo}
            disabled={!state.undo || animating}
            onPress={() => { void restoreLastDecision(); }}
            style={({ pressed }) => [styles.cardToolButton, (!state.undo || animating) && styles.disabled, pressed && styles.pressed]}
          >
            <Text style={styles.undoIcon}>↶</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isFavorite ? t('learn.remove_favorite', { word: current.word }) : t('learn.add_favorite', { word: current.word })}
            accessibilityState={{ selected: isFavorite }}
            onPress={() => toggleFavorite(current.id)}
            style={({ pressed }) => [styles.cardToolButton, pressed && styles.pressed]}
          >
            <Text style={[styles.star, isFavorite && styles.starOn]}>★</Text>
          </Pressable>
        </View>
        <View pointerEvents="none" style={styles.swipeLegend}>
          <Text style={styles.swipeUnknown}>← {t('learn.unknown')}</Text>
          <Text style={styles.swipeKnown}>{t('learn.known')} →</Text>
        </View>
      </Animated.View>
    </View>

    <View style={styles.actions}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('learn.unknown_access')}
        accessibilityState={{ disabled: animating }}
        testID={testIds.learn.unknown}
        disabled={animating}
        onPress={() => animateDecision(false)}
        style={({ pressed }) => [styles.secondary, animating && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryText}>{t('learn.unknown')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('learn.known_access')}
        accessibilityState={{ disabled: animating }}
        testID={testIds.learn.known}
        disabled={animating}
        onPress={() => animateDecision(true)}
        style={({ pressed }) => [styles.primary, animating && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>{t('learn.known')}</Text>
      </Pressable>
    </View>

    <Modal visible={helpOpen} transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={() => setHelpOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View accessibilityViewIsModal style={styles.helpPanel}>
          <Text style={styles.helpTitle}>{t('learn.help_title')}</Text>
          <View style={styles.helpRow}><Text style={styles.helpGesture}>↔</Text><Text style={styles.helpCopy}>{t('learn.help_swipe')}</Text></View>
          <View style={styles.helpRow}><Text style={styles.helpGesture}>↻</Text><Text style={styles.helpCopy}>{t('learn.help_flip')}</Text></View>
          <View style={styles.helpRow}><Text style={styles.helpGesture}>↶</Text><Text style={styles.helpCopy}>{t('learn.help_undo')}</Text></View>
          <View style={styles.helpRow}><Text style={styles.helpGesture}>★</Text><Text style={styles.helpCopy}>{t('learn.help_favorite')}</Text></View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setHelpOpen(false)}
            style={({ pressed }) => [styles.primary, styles.helpClose, pressed && styles.pressed]}
          >
            <Text style={styles.primaryText}>{t('common.understood').toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 24 },
  error: { color: theme.colors.danger, textAlign: 'center' },
  notice: { color: theme.colors.danger, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  header: { minHeight: 52, flexDirection: 'row', alignItems: 'center' },
  headerLeft: { width: 88, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  back: { marginTop: -3, fontSize: 32, color: theme.colors.textMuted },
  helpIcon: { width: 22, height: 22, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 11, color: theme.colors.textMuted, fontSize: 13, fontWeight: '800', textAlign: 'center', lineHeight: 20 },
  title: { flex: 1, fontSize: 16, fontWeight: '800', color: theme.colors.text, textAlign: 'center' },
  counterBox: { width: 88, alignItems: 'flex-end' },
  counter: { fontSize: 12, lineHeight: 16, fontWeight: '800', color: theme.colors.textMuted, fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  repeatCounter: { fontSize: 9, lineHeight: 12, fontWeight: '700', color: theme.colors.accent },
  cardStage: { flex: 1, marginVertical: 14 },
  cardDeck: { flex: 1 },
  cardFace: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    backfaceVisibility: 'hidden',
    overflow: 'hidden',
    shadowColor: '#3f382e',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 4,
  },
  cardPress: { flex: 1 },
  cardContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, paddingTop: 72, paddingBottom: 70 },
  cardTools: { position: 'absolute', zIndex: 10, top: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  cardToolButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.lineSoft, alignItems: 'center', justifyContent: 'center' },
  undoIcon: { color: theme.colors.textMuted, fontSize: 23, lineHeight: 27 },
  star: { color: theme.colors.textSoft, fontSize: 22, lineHeight: 26 },
  starOn: { color: theme.colors.accentStrong },
  sideLabel: { marginBottom: 18, color: theme.colors.textSoft, fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.4 },
  meaningSingle: { color: theme.colors.text, fontSize: 25, lineHeight: 33, fontWeight: '800', textAlign: 'center' },
  meaningSingleLarge: { fontSize: 34, lineHeight: 43, fontWeight: '900' },
  meaningList: { width: '100%', gap: 10 },
  meaningRow: { width: '100%', flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  meaningNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.surface3, color: theme.colors.accentStrong, fontSize: 11, lineHeight: 24, fontWeight: '900', textAlign: 'center' },
  meaningText: { flex: 1, color: theme.colors.text, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  meaningTextLarge: { fontSize: 22, lineHeight: 30, fontWeight: '800' },
  flipHint: { marginTop: 24, color: theme.colors.textSoft, fontSize: 10, lineHeight: 14, textAlign: 'center' },
  examples: { marginTop: 26, width: '100%', borderTopWidth: 1, borderTopColor: theme.colors.lineSoft, paddingTop: 16, gap: 12 },
  examplesTitle: { color: theme.colors.textSoft, fontSize: 10, fontWeight: '900', letterSpacing: 1, textAlign: 'center', textTransform: 'uppercase' },
  exampleBlock: { alignItems: 'center' },
  example: { color: theme.colors.text, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  exampleTranslation: { marginTop: 2, color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  swipeLegend: { position: 'absolute', left: 20, right: 20, bottom: 17, flexDirection: 'row', justifyContent: 'space-between' },
  swipeUnknown: { color: theme.colors.danger, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  swipeKnown: { color: theme.colors.success, fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  actions: { flexDirection: 'row', gap: 10, paddingBottom: 8 },
  secondary: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primary: { flex: 1, minHeight: 48, backgroundColor: theme.colors.accentStrong, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: theme.colors.text, fontWeight: '800', fontSize: 11 },
  primaryText: { color: theme.colors.inverse, fontWeight: '800', fontSize: 11 },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.68 },
  resultTitle: { marginTop: 28, color: theme.colors.text, fontSize: 22, lineHeight: 29, fontWeight: '900', textAlign: 'center' },
  metrics: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 18 },
  metric: { flex: 1, minHeight: 82, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 8 },
  metricValue: { color: theme.colors.text, fontSize: 25, lineHeight: 31, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  metricLabel: { marginTop: 2, color: theme.colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  sectionTitle: { color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900', marginBottom: 8 },
  resultList: { flex: 1, borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  resultListContent: { paddingBottom: 10 },
  resultRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  resultCopy: { flex: 1, paddingVertical: 10 },
  resultWord: { color: theme.colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  resultTrans: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
  resultRepeats: { color: theme.colors.danger, fontSize: 9, lineHeight: 13, marginTop: 3, fontWeight: '700' },
  starButton: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  perfect: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  perfectMark: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.success, color: theme.colors.inverse, fontSize: 34, lineHeight: 64, fontWeight: '900', textAlign: 'center' },
  perfectTitle: { marginTop: 18, color: theme.colors.text, fontSize: 18, lineHeight: 24, fontWeight: '900', textAlign: 'center' },
  perfectCopy: { marginTop: 6, color: theme.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(30,27,23,0.55)', justifyContent: 'center', padding: 20 },
  helpPanel: { backgroundColor: theme.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.line, padding: 20, gap: 15 },
  helpTitle: { color: theme.colors.text, fontSize: 20, lineHeight: 27, fontWeight: '900', textAlign: 'center', marginBottom: 3 },
  helpRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  helpGesture: { width: 32, color: theme.colors.accentStrong, fontSize: 23, lineHeight: 28, fontWeight: '800', textAlign: 'center' },
  helpCopy: { flex: 1, color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  helpClose: { flex: 0, marginTop: 5 },
});
