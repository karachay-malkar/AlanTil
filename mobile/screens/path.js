import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Path as SvgPath } from 'react-native-svg';
import { createRouteProgressSnapshot, stationWordProgress, storyProgress } from '../../packages/alantil-core/route-progress.js';
import { loadNativeWordProgressMap } from '../platform/progress.js';
import { Header, HeaderCircleButton, Screen } from '../ui/components.js';
import { InfoIcon } from '../ui/icons.js';
import { Topography } from '../ui/topography.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function StoryTabs({ route, activeStory, onChange }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyTabs}>{(route.storyOrder || []).map((type) => <Pressable key={type} onPress={() => onChange(type)} style={styles.storyTab}><Text style={[styles.storyTabText, activeStory === type && styles.storyTabActive]}>[ {route.stories[type]?.label || type} ]</Text></Pressable>)}</ScrollView>;
}

function SegmentedStoryProgress({ value = 0 }) {
  const filled = Math.round(Math.max(0, Math.min(100, value)) / 10);
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: value }} style={styles.segmentedProgress}>{Array.from({ length: 10 }, (_, index) => <View key={index} style={[styles.segmentedProgressCell, index < filled && styles.segmentedProgressCellOn]} />)}</View>;
}

function StationProgressRing({ percent = 0, done = false, children }) {
  const size = 60;
  const stroke = 2;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, percent));
  return <View style={styles.stationProgressRing}><Svg width={size} height={size} style={StyleSheet.absoluteFill}><Circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(41,39,34,.10)" strokeWidth={stroke} fill="none" />{progress > 0 ? <Circle cx={size / 2} cy={size / 2} r={radius} stroke={done ? C.success : C.accent} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - progress / 100)} rotation="-90" origin={`${size / 2},${size / 2}`} /> : null}</Svg>{children}</View>;
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
  const amplitude = Math.min(90, Math.max(64, viewportWidth * 0.22));
  const shiftFor = (station) => {
    const index = stationIndex.get(station.key) || 0;
    const step = (index % 4) + 1;
    if (step === 1) return -amplitude;
    if (step === 3) return amplitude;
    return 0;
  };
  const displayCatalogs = useMemo(() => [...(story?.catalogs || [])].reverse(), [story]);
  const displayStations = useMemo(() => {
    const rows = [];
    for (const catalog of displayCatalogs) {
      for (const section of [...(catalog.sections || [])].reverse()) {
        for (const station of [...(section.stations || [])].reverse()) rows.push(station);
      }
    }
    return rows;
  }, [displayCatalogs]);
  const stationOrder = useMemo(() => new Map(displayStations.map((station, index) => [station.key, index])), [displayStations]);
  const points = useMemo(() => Array.from(stationRows.entries()).map(([key, row]) => ({
    key,
    index: stationOrder.get(key) ?? 9999,
    x: mapSize.width / 2 + shiftFor({ key }),
    y: row.y + 30,
  })).sort((left, right) => left.index - right.index), [stationRows, stationOrder, mapSize.width, amplitude]);
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
        const milestones = Math.min(4, Math.floor(summary.mastered / 20));
        routeItems.push(<View key={station.key} style={styles.stationRow} onLayout={(event) => recordRow(station.key, event)}><Pressable onPress={() => onOpenStation(station)} style={[styles.stationNode, { transform: [{ translateX: shift }] }]}><StationProgressRing percent={summary.percent} done={summary.percent === 100}><View style={[styles.millstoneFace, summary.percent === 100 && styles.millstoneDone]}><View style={styles.millstoneHole} /><Text style={styles.stationOrdinal}>{String(index + 1).padStart(2, '0')}</Text></View></StationProgressRing>{milestones ? <Text style={styles.stationMilestones}>{'⌃'.repeat(milestones)}</Text> : null}<View style={styles.stationMeta}><Text numberOfLines={2} style={styles.stationLabel}>{station.name || `Этап ${index + 1}`}</Text><Text style={styles.stationCount}>{summary.mastered}/{summary.total}</Text></View></Pressable></View>);
      });
    });
    routeItems.push(<View key={`groups-gap-${catalog.dictionaryId || catalog.catalogId}`} style={styles.catalogGroupsGap} />);
    routeItems.push(<Text key={`heading-${catalog.dictionaryId || catalog.catalogId}`} style={styles.catalogHeading}>{catalog.name || 'Словарь'}</Text>);
    routeItems.push(<View key={`catalog-gap-${catalog.dictionaryId || catalog.catalogId}`} style={styles.catalogGap} />);
  });

  return <Screen bottomNav><Topography opacity={0.28} /><Header title="" trailing={<HeaderCircleButton icon={<InfoIcon size={20} color={C.text2} />} accessibilityLabel="Подсказка" onPress={() => {}} />} /><View style={styles.pathControls}><StoryTabs route={route} activeStory={activeStory} onChange={setActiveStory} /><View style={styles.storyProgress}><SegmentedStoryProgress value={storySummary.percent} /><Text style={styles.storyProgressAccent}>{storySummary.percent}%</Text><Text style={styles.storyProgressCount}>{storySummary.masteredWords}/{storySummary.totalWords}</Text></View></View><ScrollView ref={scrollRef} style={styles.pathViewport} contentContainerStyle={styles.pathContent} scrollEventThrottle={16} onLayout={(event) => setScrollState((previous) => ({ ...previous, viewport: event.nativeEvent.layout.height }))} onContentSizeChange={onContentSizeChange} onScroll={(event) => setScrollState((previous) => ({ ...previous, offset: event.nativeEvent.contentOffset.y }))}><View style={styles.routeMap} onLayout={(event) => setMapSize(event.nativeEvent.layout)}>{connector && mapSize.width && mapSize.height ? <Svg pointerEvents="none" width={mapSize.width} height={mapSize.height} style={styles.routeConnector}><SvgPath d={connector} fill="none" stroke="rgba(102,97,88,.38)" strokeWidth={1} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 7" opacity={0.72} /></Svg> : null}{routeItems}{story?.intro ? <View style={styles.storyIntro}><Text style={styles.storyIntroText}>{story.intro}</Text></View> : null}</View></ScrollView><View style={styles.routeScale}>{scaleParts.map((part, index) => {
    const isPassed = index >= scaleParts.length - passed;
    const isCurrent = index === currentIndex;
    if (part.type === 'diamond') return <View key={part.key} style={styles.scaleDiamondHit}><View style={[styles.scaleDiamond, isPassed && styles.scalePassed, isCurrent && styles.scaleDiamondCurrent]} /></View>;
    if (part.type === 'section') return <View key={part.key} style={[styles.scaleSection, isPassed && styles.scalePassed, isCurrent && styles.scaleCurrent]} />;
    return <View key={part.key} style={[styles.scaleDot, isPassed && styles.scalePassed, isCurrent && styles.scaleCurrent]} />;
  })}</View></Screen>;
}

const styles = StyleSheet.create({
  pathControls: { position: 'absolute', zIndex: 24, top: theme.control.header, left: 0, right: 0, height: 68, paddingTop: 0, paddingBottom: 2, backgroundColor: 'transparent' },
  storyTabs: { height: 32, alignItems: 'center', paddingHorizontal: 8, gap: 3 },
  storyTab: { height: 32, minWidth: 86, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  storyTabText: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', lineHeight: 12, color: C.text3, opacity: 0.64 },
  storyTabActive: { color: C.text1, opacity: 1 },
  storyProgress: { height: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  segmentedProgress: { width: 62, height: 5, flexDirection: 'row', gap: 2 },
  segmentedProgressCell: { flex: 1, height: 5, borderRadius: 1, backgroundColor: 'rgba(54,50,43,.12)' },
  segmentedProgressCellOn: { backgroundColor: C.accentStrong },
  storyProgressAccent: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', lineHeight: 11, color: C.accentStrong },
  storyProgressCount: { fontFamily: 'monospace', fontSize: 11, fontWeight: '700', lineHeight: 11, color: C.text3 },
  pathViewport: { position: 'absolute', top: theme.control.header + 68, left: 0, right: 0, bottom: theme.control.nav },
  pathContent: { paddingTop: 76, paddingHorizontal: 20, paddingRight: 50, paddingBottom: 108 },
  routeMap: { position: 'relative', width: '100%', maxWidth: 560, alignSelf: 'center' },
  routeConnector: { position: 'absolute', zIndex: 0, left: 0, top: 0 },
  catalogGroupsGap: { height: 64 },
  catalogGap: { height: 70 },
  stationRow: { position: 'relative', width: '100%', height: 118, alignItems: 'center' },
  stationNode: { position: 'relative', zIndex: 1, width: 60, height: 60, alignItems: 'center' },
  stationProgressRing: { position: 'relative', width: 60, height: 60, padding: 2, alignItems: 'center', justifyContent: 'center' },
  millstoneFace: { position: 'relative', width: 56, height: 56, borderWidth: 1, borderColor: 'rgba(75,70,61,.42)', borderTopLeftRadius: 26, borderTopRightRadius: 30, borderBottomRightRadius: 27, borderBottomLeftRadius: 29, backgroundColor: '#d8d0c2', alignItems: 'center', justifyContent: 'center', shadowColor: '#292722', shadowOpacity: 0.10, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  millstoneDone: { backgroundColor: '#d1d4c8' },
  millstoneHole: { position: 'absolute', width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: 'rgba(72,66,56,.18)', backgroundColor: C.appBg },
  stationOrdinal: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', lineHeight: 8, color: C.text2, marginTop: 19 },
  stationMilestones: { position: 'absolute', top: 49, left: -16, right: -16, textAlign: 'center', fontFamily: 'monospace', fontSize: 8, fontWeight: '900', lineHeight: 8, letterSpacing: -1, color: C.accentStrong },
  stationMeta: { position: 'absolute', top: 65, left: -45, width: 150, alignItems: 'center', gap: 3 },
  stationLabel: { width: 150, fontSize: 10, fontWeight: '700', lineHeight: 11.5, color: C.text1, textAlign: 'center' },
  stationCount: { fontFamily: 'monospace', fontSize: 8, fontWeight: '700', lineHeight: 8, color: C.text3, textAlign: 'center' },
  catalogHeading: { fontSize: 17, fontWeight: '900', letterSpacing: 0.75, color: C.text1, textAlign: 'center' },
  storyIntro: { width: '86%', maxWidth: 480, alignSelf: 'center', marginBottom: 72, paddingVertical: 18, paddingHorizontal: 20, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.lineSoft },
  storyIntroText: { fontSize: 15, fontWeight: '600', lineHeight: 23.25, color: C.text2, textAlign: 'center' },
  routeScale: { position: 'absolute', zIndex: 25, right: 4, top: '23%', bottom: '15%', width: 26, alignItems: 'center', justifyContent: 'space-evenly' },
  scaleDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(41,39,34,.18)' },
  scaleSection: { width: 7, height: 7, borderWidth: 1, borderColor: 'rgba(41,39,34,.38)', backgroundColor: 'transparent' },
  scaleDiamondHit: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  scaleDiamond: { width: 9, height: 9, borderWidth: 1, borderColor: 'rgba(41,39,34,.55)', transform: [{ rotate: '45deg' }] },
  scalePassed: { backgroundColor: 'rgba(41,39,34,.72)', borderColor: 'rgba(41,39,34,.72)' },
  scaleCurrent: { transform: [{ scale: 1.35 }] },
  scaleDiamondCurrent: { transform: [{ rotate: '45deg' }, { scale: 1.2 }] },
});
