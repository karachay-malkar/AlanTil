import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme.js';

const C = theme.colors;
const T = theme.type;

export function ScreenSection({ title, trailing, children, style }) {
  return <View style={[styles.section, style]}>
    {(title || trailing) ? <View style={styles.sectionHead}>{title ? <Text style={styles.sectionTitle}>{title}</Text> : <View />}{trailing || null}</View> : null}
    {children}
  </View>;
}

export function SurfaceCard({ children, style, inset = false }) {
  return <View style={[styles.surface, style]}>{inset ? <View pointerEvents="none" style={styles.surfaceInset} /> : null}{children}</View>;
}

export function CompactSegmentedControl({ value, items, onChange, accessibilityLabel }) {
  return <View accessibilityLabel={accessibilityLabel} style={styles.segmented}>{items.map(([id, label]) => {
    const active = value === id;
    return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(id)} style={({ pressed }) => [styles.segmentItem, active && styles.segmentItemActive, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text></Pressable>;
  })}</View>;
}

export function ListRow({ leading, title, subtitle, trailing, onPress, selected = false, compact = false }) {
  const Body = onPress ? Pressable : View;
  return <Body accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { selected } : undefined} onPress={onPress} style={({ pressed }) => [styles.listRow, compact && styles.listRowCompact, selected && styles.listRowSelected, pressed && styles.pressed]}>
    {leading ? <View style={styles.listLeading}>{leading}</View> : null}
    <View style={styles.listCopy}><Text numberOfLines={1} style={styles.listTitle}>{title}</Text>{subtitle ? <Text numberOfLines={2} style={styles.listSubtitle}>{subtitle}</Text> : null}</View>
    {trailing ? <View style={styles.listTrailing}>{trailing}</View> : null}
  </Body>;
}

export function MetricStrip({ items }) {
  return <View style={styles.metrics}>{items.map(([value, label]) => <View key={label} style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>)}</View>;
}

export function MonoLabel({ children, accent = false, style }) {
  return <Text style={[styles.monoLabel, accent && styles.monoAccent, style]}>{children}</Text>;
}

export function EmptyState({ children }) {
  return <View style={styles.empty}><Text style={styles.emptyText}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  section: { width: '100%', gap: 8 },
  sectionHead: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', lineHeight: 18, color: C.text1 },
  surface: { position: 'relative', width: '100%', borderWidth: 1, borderColor: C.line, borderRadius: theme.radius.lg, backgroundColor: C.surface0, overflow: 'hidden' },
  surfaceInset: { position: 'absolute', top: 9, left: 9, right: 9, bottom: 9, borderWidth: 1, borderColor: C.lineSoft, borderRadius: Math.max(1, theme.radius.lg - 6), opacity: .6 },
  segmented: { width: '100%', minHeight: 36, padding: 2, borderWidth: 1, borderColor: C.line, borderRadius: 999, flexDirection: 'row', backgroundColor: 'transparent' },
  segmentItem: { flex: 1, minHeight: 30, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7 },
  segmentItemActive: { backgroundColor: C.controlGlassActive || C.surface0 },
  segmentLabel: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '700', lineHeight: 12, color: C.text3, textAlign: 'center' },
  segmentLabelActive: { color: C.text1 },
  listRow: { minHeight: 58, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.lineSoft, flexDirection: 'row', alignItems: 'center', gap: 9 },
  listRowCompact: { minHeight: 48, paddingVertical: 5 },
  listRowSelected: { backgroundColor: C.controlGlass || 'rgba(246,242,233,.36)' },
  listLeading: { width: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { fontSize: 15, fontWeight: '800', lineHeight: 18, color: C.text1 },
  listSubtitle: { marginTop: 2, fontSize: T.caption, lineHeight: 16, color: C.text2 },
  listTrailing: { minWidth: 30, alignItems: 'flex-end', justifyContent: 'center' },
  metrics: { width: '100%', flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.lineSoft },
  metric: { flex: 1, minHeight: 66, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: C.lineSoft },
  metricValue: { fontFamily: theme.font.terminal, fontSize: 19, fontWeight: '850', lineHeight: 21, color: C.text1 },
  metricLabel: { marginTop: 4, fontSize: T.micro, lineHeight: 12, color: C.text2, textAlign: 'center' },
  monoLabel: { fontFamily: theme.font.terminal, fontSize: T.micro, fontWeight: '800', lineHeight: 11, letterSpacing: .55, color: C.text3 },
  monoAccent: { color: C.accentStrong },
  empty: { minHeight: 96, alignItems: 'center', justifyContent: 'center', padding: 16 },
  emptyText: { fontSize: T.caption, lineHeight: 18, color: C.text3, textAlign: 'center' },
  pressed: { opacity: .7, transform: [{ translateY: 1 }] },
});
