import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from './theme.js';
import { useRuntimeSettings, useSemanticTypography } from './runtime-settings.js';
import { textMetrics } from '../../packages/alantil-ui/typography.js';
import { listRowHeight, listTypography } from '../../packages/alantil-ui/list-table.js';
import { CutCornerFrame } from './cut-corner.js';

const C = theme.colors;
const T = theme.type;

export function ScreenSection({ title, trailing, children, style }) {
  const type = useSemanticTypography();
  return <View style={[styles.section, style]}>
    {(title || trailing) ? <View style={styles.sectionHead}>{title ? <Text style={[styles.sectionTitle,textMetrics(type.body.fontSize,1.2)]}>{title}</Text> : <View />}{trailing || null}</View> : null}
    {children}
  </View>;
}

export function SurfaceCard({ children, style, inset = false, flat = false }) {
  return <View style={[styles.surface, flat && styles.surfaceFlat, style]}>{inset && !flat ? <View pointerEvents="none" style={styles.surfaceInset} /> : null}{children}</View>;
}

export function CompactSegmentedControl({ value, items, onChange, accessibilityLabel, variant='settings' }) {
  const type = useSemanticTypography();
  const activeStyle=variant==='set'?styles.segmentItemSetActive:variant==='test'?styles.segmentItemTestActive:variant==='songs'?styles.segmentItemSongsActive:styles.segmentItemActive;
  return <View accessibilityLabel={accessibilityLabel} style={styles.segmented}>{items.map(([id, label]) => {
    const active = value === id;
    return <Pressable key={id} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(id)} style={({ pressed }) => [styles.segmentItem, active && activeStyle, pressed && styles.pressed]}><Text numberOfLines={1} style={[styles.segmentLabel,textMetrics(type[variant==='set'||variant==='test'?'micro':'caption'].fontSize,1), active && styles.segmentLabelActive]}>{label}</Text></Pressable>;
  })}</View>;
}

export function OverflowMarquee({ children, textStyle, style, enabled = true }) {
  const displayText=typeof children==='string'||typeof children==='number'?String(children??'').replace(/\s*\r?\n+\s*/gu,'; ').replace(/\s{2,}/gu,' ').trim():children;
  const [boxWidth,setBoxWidth]=useState(0),[textWidth,setTextWidth]=useState(0);const offset=useRef(new Animated.Value(0)).current,overflow=Math.max(0,textWidth-boxWidth);
  useEffect(()=>{offset.stopAnimation();offset.setValue(0);if(!enabled||overflow<8)return;const duration=Math.max(1800,Math.min(6000,overflow*28));const animation=Animated.loop(Animated.sequence([Animated.delay(650),Animated.timing(offset,{toValue:-overflow,duration,easing:Easing.linear,useNativeDriver:true}),Animated.delay(850),Animated.timing(offset,{toValue:0,duration:220,easing:Easing.out(Easing.quad),useNativeDriver:true}),Animated.delay(450)]));animation.start();return()=>animation.stop();},[enabled,overflow,offset]);
  return <View style={[styles.marquee,style]} onLayout={(event)=>setBoxWidth(event.nativeEvent.layout.width)}><Animated.View style={{transform:[{translateX:offset}]}}><Text onLayout={(event)=>setTextWidth(event.nativeEvent.layout.width)} numberOfLines={1} style={textStyle}>{displayText}</Text></Animated.View></View>;
}

export function ListRow({ leading, title, subtitle, trailing, onPress, selected = false, compact = false, variant = 'standard', marquee = false, style, titleStyle, subtitleStyle, leadingStyle, trailingStyle }) {
  const {settings}=useRuntimeSettings(),sizeCode=settings?.text_size_code||'medium',rowHeight=listRowHeight(sizeCode,variant),listType=listTypography(sizeCode);
  const Body = onPress ? Pressable : View;
  const rowStyle = (pressed = false) => [styles.listRow,{height:rowHeight,minHeight:rowHeight}, compact && styles.listRowCompact, selected && styles.listRowSelected, pressed && styles.pressed, style];
  const primaryMetrics=textMetrics(listType.primary,1.2),secondaryMetrics=textMetrics(listType.secondary,4/3);
  return <Body accessibilityRole={onPress ? 'button' : undefined} accessibilityState={onPress ? { selected } : undefined} onPress={onPress} style={onPress ? ({ pressed }) => rowStyle(pressed) : rowStyle()}>
    {leading ? <View style={[styles.listLeading,leadingStyle]}>{leading}</View> : null}
    <View style={styles.listCopy}>{marquee?<OverflowMarquee textStyle={[styles.listTitle,primaryMetrics,titleStyle]}>{title}</OverflowMarquee>:<Text numberOfLines={1} style={[styles.listTitle,primaryMetrics,titleStyle]}>{title}</Text>}{subtitle ? <Text numberOfLines={2} style={[styles.listSubtitle,secondaryMetrics,subtitleStyle]}>{subtitle}</Text> : null}</View>
    {trailing ? <View style={[styles.listTrailing,trailingStyle]}>{trailing}</View> : null}
  </Body>;
}

export function MetricStrip({ items }) {
  const type = useSemanticTypography();
  return <View style={styles.metrics}>{items.map(([value, label]) => <View key={label} style={styles.metric}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.78} style={[styles.metricValue,textMetrics(type.title.fontSize,1.08)]}>{value}</Text><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.72} style={[styles.metricLabel,textMetrics(type.micro.fontSize,1.28)]}>{label}</Text></View>)}</View>;
}

export function MonoLabel({ children, accent = false, style }) {
  const type = useSemanticTypography();
  return <Text style={[styles.monoLabel,textMetrics(type.micro.fontSize,1.1), accent && styles.monoAccent, style]}>{children}</Text>;
}


export function SmallActionButton({ children, onPress, active = false, disabled = false }) {
  const type = useSemanticTypography();
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.smallAction, disabled && styles.smallActionDisabled, pressed && !disabled && styles.smallActionPressed]}><CutCornerFrame fill={active?C.accent:'transparent'} stroke={active?C.accentStrong:C.line} cut={theme.button.cut} radius={theme.button.settingsSmallRadius}/><Text style={[styles.smallActionLabel,textMetrics(type.micro.fontSize,1), active && styles.smallActionLabelActive]}>{children}</Text></Pressable>;
}

export function EmptyState({ children }) {
  const type = useSemanticTypography();
  return <View style={styles.empty}><Text style={[styles.emptyText,textMetrics(type.caption.fontSize,1.5)]}>{children}</Text></View>;
}

const styles = StyleSheet.create({
  section: { width: '100%', gap: 8 },
  sectionHead: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '800', lineHeight: 18, color: C.text1 },
  surface: { position: 'relative', width: '100%', borderWidth: 1, borderColor: C.line, borderRadius: theme.radius.lg, backgroundColor: C.surface0, overflow: 'hidden' },
  surfaceFlat: { borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' },
  surfaceInset: { position: 'absolute', top: 9, left: 9, right: 9, bottom: 9, borderWidth: 1, borderColor: C.lineSoft, borderRadius: Math.max(1, theme.radius.lg - 6), opacity: .6 },
  segmented: { width: '100%', minHeight: theme.segmented.itemMinHeight + theme.segmented.padding * 2, padding: theme.segmented.padding, borderWidth: 1, borderColor: C.line, borderRadius: theme.segmented.radius, flexDirection: 'row', backgroundColor: 'transparent' },
  segmentItem: { flex: 1, minHeight: theme.segmented.itemMinHeight, borderRadius: theme.segmented.radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 7, paddingVertical: 4 },
  segmentItemActive: { backgroundColor: 'rgba(246,242,233,.72)', shadowColor: '#292721', shadowOpacity: .05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentItemSetActive: { backgroundColor: 'rgba(246,242,233,.82)', shadowColor: '#292721', shadowOpacity: .05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentItemTestActive: { backgroundColor: 'rgba(246,242,233,.86)', shadowColor: '#292721', shadowOpacity: .05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentItemSongsActive: { backgroundColor: 'rgba(246,242,233,.84)', shadowColor: '#292721', shadowOpacity: .05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentLabel: { fontFamily: theme.font.terminal, fontSize: 10, fontWeight: '700', lineHeight: 10, color: C.text3, textAlign: 'center' },
  segmentLabelActive: { color: C.text1 },
  listRow: { paddingHorizontal: theme.listTable.horizontalPadding, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: C.lineSoft, backgroundColor:'transparent', borderRadius:0, flexDirection: 'row', alignItems: 'center', gap: theme.listTable.gap },
  listRowCompact: { paddingVertical: 4 },
  listRowSelected: { backgroundColor: C.controlGlass || 'rgba(246,242,233,.36)' },
  listLeading: { width: theme.listTable.leadingSlot, minWidth:theme.listTable.leadingSlot, minHeight: theme.listTable.leadingSlot, alignItems: 'center', justifyContent: 'center' },
  listCopy: { flex: 1, minWidth: 0 },
  listTitle: { fontSize: theme.listTable.typography.primary.fontSize, fontWeight: theme.listTable.typography.primary.fontWeight, lineHeight: 18, color: C.text1 },
  listSubtitle: { marginTop: 2, fontSize: theme.listTable.typography.secondary.fontSize, lineHeight: 16, color: C.text2 },
  listTrailing: { minWidth: theme.listTable.actionSlot, width:theme.listTable.actionSlot, alignItems: 'flex-end', justifyContent: 'center' },
  marquee:{width:'100%',overflow:'hidden'},
  metrics: { width: '100%', flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.lineSoft },
  metric: { flex: 1, minWidth: 0, minHeight: 66, paddingVertical: 9, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: C.lineSoft, overflow: 'visible' },
  metricValue: { maxWidth: '100%', fontFamily: theme.font.terminal, fontSize: 19, fontWeight: '850', lineHeight: 22, color: C.text1, includeFontPadding: true },
  metricLabel: { maxWidth: '100%', marginTop: 4, paddingHorizontal: 1, fontSize: T.micro, lineHeight: 13, color: C.text2, textAlign: 'center', includeFontPadding: true },
  monoLabel: { fontFamily: theme.font.terminal, fontSize: T.micro, fontWeight: '800', lineHeight: 11, letterSpacing: .55, color: C.text3 },
  monoAccent: { color: C.accentStrong },
  smallAction: { minHeight: theme.button.settingsSmallHeight, paddingVertical: theme.button.settingsSmallVertical, paddingHorizontal: theme.button.settingsSmallHorizontal, borderWidth: 0, borderRadius: theme.button.settingsSmallRadius, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  smallActionActive: { borderColor: C.accentStrong, backgroundColor: C.accent },
  smallActionDisabled: { opacity: theme.button.settingsSmallDisabledOpacity },
  smallActionLabel: { fontFamily: theme.font.terminal, fontSize: theme.button.settingsSmallFontSize, fontWeight: theme.button.settingsSmallFontWeight, lineHeight: theme.button.settingsSmallLineHeight, color: C.text3 },
  smallActionLabelActive: { color: C.inverse },
  smallActionPressed: { opacity: theme.button.pressedOpacity, transform: [{ scale: theme.button.pressedScale }] },
  empty: { minHeight: 96, alignItems: 'center', justifyContent: 'center', padding: 16 },
  emptyText: { fontSize: T.caption, lineHeight: 18, color: C.text3, textAlign: 'center' },
  pressed: { opacity: .7, transform: [{ translateY: 1 }] },
});