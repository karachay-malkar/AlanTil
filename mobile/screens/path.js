import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path as SvgPath } from 'react-native-svg';
import { createRouteProgressSnapshot, stationWordProgress, storyProgress } from '../../packages/alantil-core/route-progress.js';
import { loadNativeWordProgressMap } from '../platform/progress.js';
import { Header, HeaderCircleButton, Screen } from '../ui/components.js';
import { MonoLabel } from '../ui/parity.js';
import { InfoIcon } from '../ui/icons.js';
import { Topography } from '../ui/topography.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;
const POSITION_PATTERN = [-1, 0, 1];

function StoryTabs({ route, activeStory, onChange }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyTabs}>{(route.storyOrder || []).map((type) => {
    const active = activeStory === type;
    return <Pressable key={type} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(type)} style={({ pressed }) => [styles.storyTab, pressed && styles.pressed]}><Text style={[styles.storyTabText, active && styles.storyTabActive]}>[ {route.stories[type]?.label || type} ]</Text></Pressable>;
  })}</ScrollView>;
}

function SegmentedStoryProgress({ value = 0 }) {
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 10);
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }} style={styles.segmentedProgress}>{Array.from({ length: 10 }, (_, index) => <View key={index} style={[styles.segmentedProgressCell, index < filled && styles.segmentedProgressCellOn]} />)}</View>;
}

function StationProgressRing({ percent = 0, done = false, children }) {
  const size = 58;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, percent));
  return <View style={styles.stationProgressRing}><Svg width={size} height={size} style={StyleSheet.absoluteFill}><Circle cx={size / 2} cy={size / 2} r={radius} stroke={C.lineSoft} strokeWidth={stroke} fill="none" />{progress > 0 ? <Circle cx={size / 2} cy={size / 2} r={radius} stroke={done ? C.success : C.accent} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress / 100)} rotation="-90" origin={`${size / 2},${size / 2}`} /> : null}</Svg>{children}</View>;
}

function connectorPath(points) {
  if (points.length < 2) return '';
  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const middleY = (previous.y + current.y) / 2;
    path += ` C ${previous.x.toFixed(2)} ${middleY.toFixed(2)}, ${current.x.toFixed(2)} ${middleY.toFixed(2)}, ${current.x.toFixed(2)} ${current.y.toFixed(2)}`;
  }
  return path;
}

export function PathScreen({ route, onOpenStation }) {
  const [activeStory, setActiveStory] = useState(() => route.storyOrder?.[0] || '');
  const [progressMap, setProgressMap] = useState(() => new Map());
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [stationRows, setStationRows] = useState(() => new Map());
  const [scrollState, setScrollState] = useState({ offset: 0, content: 1, viewport: 1 });
  const scrollRef = useRef(null);
  const positionedRef = useRef(false);
  const { width: viewportWidth } = useWindowDimensions();

  useEffect(() => {
    let alive = true;
    loadNativeWordProgressMap().then((map) => { if (alive) setProgressMap(map); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setStationRows(new Map());
    positionedRef.current = false;
  }, [activeStory]);

  const story = route.stories?.[activeStory];
  const stations = story?.stations || [];
  const snapshot = useMemo(() => createRouteProgressSnapshot(progressMap), [progressMap]);
  const storySummary = useMemo(() => storyProgress(route, activeStory, snapshot), [route, activeStory, snapshot]);
  const stationIndex = useMemo(() => new Map(stations.map((station, index) => [station.key, index])), [stations]);
  const amplitude = Math.min(92, Math.max(58, viewportWidth * 0.205));
  const shiftFor = (station) => POSITION_PATTERN[(stationIndex.get(station.key) || 0) % POSITION_PATTERN.length] * amplitude;

  const displayCatalogs = useMemo(() => [...(story?.catalogs || [])].reverse(), [story]);
  const displayStations = useMemo(() => {
    const rows = [];
    for (const catalog of displayCatalogs) for (const section of [...(catalog.sections || [])].reverse()) for (const station of [...(section.stations || [])].reverse()) rows.push(station);
    return rows;
  }, [displayCatalogs]);
  const stationOrder = useMemo(() => new Map(displayStations.map((station, index) => [station.key, index])), [displayStations]);
  const points = useMemo(() => Array.from(stationRows.entries()).map(([key, row]) => ({ key, index: stationOrder.get(key) ?? 9999, x: mapSize.width / 2 + shiftFor({ key }), y: row.y + 29 })).sort((left, right) => left.index - right.index), [stationRows, stationOrder, mapSize.width, amplitude]);
  const connector = connectorPath(points);
  const maxScroll = Math.max(0, scrollState.content - scrollState.viewport);
  const routeProgress = maxScroll ? Math.max(0, Math.min(1, (maxScroll - scrollState.offset) / maxScroll)) : 0;

  const scaleParts = useMemo(() => {
    const parts = [];
    displayCatalogs.forEach((catalog) => {
      parts.push({ type: 'diamond', key: `d-${catalog.dictionaryId || catalog.catalogId}` });
      [...(catalog.sections || [])].reverse().forEach((section, sectionIndex, groups) => {
        const count = Math.max(3, Math.min(10, 3 + Math.round((section.stations?.length || 1) * 0.75)));
        for (let index = 0; index < count; index += 1) parts.push({ type: 'dot', key: `p-${catalog.dictionaryId || catalog.catalogId}-${section.sectionId}-${index}` });
        if (sectionIndex < groups.length - 1) parts.push({ type: 'section', key: `s-${catalog.dictionaryId || catalog.catalogId}-${section.sectionId}` });
      });
    });
    return parts;
  }, [displayCatalogs]);
  const passed = Math.round(routeProgress * scaleParts.length);
  const currentIndex = Math.max(0, scaleParts.length - passed - 1);

  const recordRow = (key, event) => {
    const { y } = event.nativeEvent.layout;
    setStationRows((previous) => {
      if (previous.get(key)?.y === y) return previous;
      const next = new Map(previous);
      next.set(key, { y });
      return next;
    });
  };
  const onContentSizeChange = (width, height) => {
    setScrollState((previous) => ({ ...previous, content: height }));
    if (!positionedRef.current) {
      positionedRef.current = true;
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: false }));
    }
  };

  const routeItems = [];
  displayCatalogs.forEach((catalog) => {
    [...(catalog.sections || [])].reverse().forEach((section) => {
      [...(section.stations || [])].reverse().forEach((station) => {
        const summary = stationWordProgress(station, snapshot);
        const index = stationIndex.get(station.key) || 0;
        const shift = shiftFor(station);
        const milestones = Math.min(3, Math.floor(summary.mastered / 20));
        routeItems.push(<View key={station.key} style={styles.stationRow} onLayout={(event) => recordRow(station.key, event)}><Pressable accessibilityRole="button" accessibilityLabel={station.name || `Этап ${index + 1}`} onPress={() => onOpenStation(station)} style={({ pressed }) => [styles.stationNode, { transform: [{ translateX: shift }, { scale: pressed ? .97 : 1 }] }]}><StationProgressRing percent={summary.percent} done={summary.percent === 100}><View style={[styles.millstoneFace, summary.percent === 100 && styles.millstoneDone]}><View style={styles.millstoneHole} /><Text style={styles.stationOrdinal}>{String(index + 1).padStart(2, '0')}</Text></View></StationProgressRing>{milestones ? <Text style={styles.stationMilestones}>{'⌃'.repeat(milestones)}</Text> : null}<View style={styles.stationMeta}><Text numberOfLines={2} style={styles.stationLabel}>{station.name || `Этап ${index + 1}`}</Text><Text style={styles.stationCount}>{summary.mastered}/{summary.total}</Text></View></Pressable></View>);
      });
    });
    routeItems.push(<View key={`groups-gap-${catalog.dictionaryId || catalog.catalogId}`} style={styles.catalogGroupsGap} />);
    routeItems.push(<Text key={`heading-${catalog.dictionaryId || catalog.catalogId}`} style={styles.catalogHeading}>{catalog.name || 'Словарь'}</Text>);
    routeItems.push(<View key={`catalog-gap-${catalog.dictionaryId || catalog.catalogId}`} style={styles.catalogGap} />);
  });

  return <Screen bottomNav><Topography opacity={0.28} /><Header title="" trailing={<HeaderCircleButton icon={<InfoIcon size={20} color={C.text2} />} accessibilityLabel="Подсказка" onPress={() => {}} />} /><View style={styles.pathControls}><StoryTabs route={route} activeStory={activeStory} onChange={setActiveStory} /><View style={styles.storyProgress}><SegmentedStoryProgress value={storySummary.percent} /><MonoLabel accent>{storySummary.percent}%</MonoLabel><MonoLabel>{storySummary.masteredWords}/{storySummary.totalWords}</MonoLabel></View></View><ScrollView ref={scrollRef} style={styles.pathViewport} contentContainerStyle={styles.pathContent} scrollEventThrottle={16} showsVerticalScrollIndicator={false} onLayout={(event) => setScrollState((previous) => ({ ...previous, viewport: event.nativeEvent.layout.height }))} onContentSizeChange={onContentSizeChange} onScroll={(event) => setScrollState((previous) => ({ ...previous, offset: event.nativeEvent.contentOffset.y }))}><View style={styles.routeMap} onLayout={(event) => setMapSize(event.nativeEvent.layout)}>{connector && mapSize.width && mapSize.height ? <Svg pointerEvents="none" width={mapSize.width} height={mapSize.height} style={styles.routeConnector}><SvgPath d={connector} fill="none" stroke={C.text3} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 7" opacity={0.45} /></Svg> : null}{routeItems}{story?.intro ? <View style={styles.storyIntro}><Text style={styles.storyIntroText}>{story.intro}</Text></View> : null}</View></ScrollView><View pointerEvents="none" style={styles.routeScale}>{scaleParts.map((part, index) => {
    const isPassed = index >= scaleParts.length - passed;
    const isCurrent = index === currentIndex;
    if (part.type === 'diamond') return <View key={part.key} style={styles.scaleDiamondHit}><View style={[styles.scaleDiamond, isPassed && styles.scalePassed, isCurrent && styles.scaleDiamondCurrent]} /></View>;
    if (part.type === 'section') return <View key={part.key} style={[styles.scaleSection, isPassed && styles.scalePassed, isCurrent && styles.scaleCurrent]} />;
    return <View key={part.key} style={[styles.scaleDot, isPassed && styles.scalePassed, isCurrent && styles.scaleCurrent]} />;
  })}</View></Screen>;
}

const styles = StyleSheet.create({
  pathControls: { position: 'absolute', zIndex: 24, top: theme.control.header, left: 0, right: 0, height: 66, paddingBottom: 2 },
  storyTabs: { height: 32, alignItems: 'center', paddingHorizontal: 8, gap: 2 },
  storyTab: { height: 32, minWidth: 84, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  storyTabText: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '700', lineHeight: 12, color: C.text3, opacity: .62 },
  storyTabActive: { color: C.text1, opacity: 1 },
  storyProgress: { height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentedProgress: { width: 62, height: 5, flexDirection: 'row', gap: 2 },
  segmentedProgressCell: { flex: 1, height: 5, borderRadius: 1, backgroundColor: C.lineSoft },
  segmentedProgressCellOn: { backgroundColor: C.accentStrong },
  pathViewport: { position: 'absolute', top: theme.control.header + 66, left: 0, right: 0, bottom: theme.control.nav },
  pathContent: { paddingTop: 74, paddingHorizontal: 18, paddingRight: 48, paddingBottom: 108 },
  routeMap: { position: 'relative', width: '100%', maxWidth: 560, alignSelf: 'center' },
  routeConnector: { position: 'absolute', zIndex: 0, left: 0, top: 0 },
  catalogGroupsGap: { height: 56 },
  catalogGap: { height: 64 },
  stationRow: { position: 'relative', width: '100%', height: 112, alignItems: 'center' },
  stationNode: { position: 'relative', zIndex: 1, width: 58, height: 58, alignItems: 'center' },
  stationProgressRing: { position: 'relative', width: 58, height: 58, padding: 2, alignItems: 'center', justifyContent: 'center' },
  millstoneFace: { position: 'relative', width: 54, height: 54, borderWidth: 1, borderColor: C.line, borderTopLeftRadius: 25, borderTopRightRadius: 29, borderBottomRightRadius: 26, borderBottomLeftRadius: 28, backgroundColor: '#d8d0c2', alignItems: 'center', justifyContent: 'center', shadowColor: '#292722', shadowOpacity: .08, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  millstoneDone: { backgroundColor: '#d1d4c8' },
  millstoneHole: { position: 'absolute', width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: C.lineSoft, backgroundColor: C.appBg },
  stationOrdinal: { fontFamily: theme.font.terminal, fontSize: 8, fontWeight: '700', lineHeight: 8, color: C.text2, marginTop: 18 },
  stationMilestones: { position: 'absolute', top: 47, left: -16, right: -16, textAlign: 'center', fontFamily: theme.font.terminal, fontSize: 8, fontWeight: '900', lineHeight: 8, letterSpacing: -1, color: C.accentStrong },
  stationMeta: { position: 'absolute', top: 63, left: -46, width: 150, alignItems: 'center', gap: 2 },
  stationLabel: { width: 150, fontSize: 10, fontWeight: '700', lineHeight: 12, color: C.text1, textAlign: 'center' },
  stationCount: { fontFamily: theme.font.terminal, fontSize: 9, fontWeight: '700', lineHeight: 10, color: C.text3 },
  catalogHeading: { alignSelf: 'center', maxWidth: 260, paddingHorizontal: 8, fontSize: 14, fontWeight: '850', lineHeight: 17, color: C.text1, textAlign: 'center' },
  storyIntro: { alignSelf: 'center', width: '86%', maxWidth: 380, marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.lineSoft },
  storyIntroText: { fontSize: 11, lineHeight: 16, color: C.text2, textAlign: 'center' },
  routeScale: { position: 'absolute', zIndex: 26, right: 13, top: theme.control.header + 78, bottom: theme.control.nav + 18, width: 16, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  scaleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.line },
  scaleSection: { width: 4, height: 7, borderRadius: 2, backgroundColor: C.line },
  scaleDiamondHit: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  scaleDiamond: { width: 8, height: 8, borderWidth: 1, borderColor: C.text3, transform: [{ rotate: '45deg' }], backgroundColor: C.appBg },
  scalePassed: { backgroundColor: C.accent, borderColor: C.accentStrong },
  scaleCurrent: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.accentStrong },
  scaleDiamondCurrent: { width: 9, height: 9, borderColor: C.accentStrong },
  pressed: { opacity: .68 },
});
