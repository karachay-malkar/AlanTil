import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlanIcon } from '@/src/mobile/icons';
import { theme } from '@/src/mobile/theme';
import { useI18n } from '@/src/mobile/i18n';
import type { ScopeDictionary } from '@/src/mobile/practice/selection';
import { scopeKey } from '@/src/mobile/practice/selection';
import { scopedTestId } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

export function PracticeHeader({ title, subtitle, onBack, showBack = true, center, action }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  showBack?: boolean;
  center?: ReactNode;
  action?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return (
    <View style={[styles.header, { height: 50 + insets.top, paddingTop: insets.top }]}>
      {showBack ? <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack ?? (() => router.back())} style={styles.backButton}><AlanIcon color={theme.colors.textMuted} name="back" size={22} /></Pressable> : null}
      <View style={styles.headerCopy}>
        {center ?? <>
          <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </>}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function Segment<T extends string | number>({ values, value, onChange, testID }: { values: readonly T[]; value: T; onChange: (value: T) => void; testID?: string }) {
  return (
    <View accessibilityRole="radiogroup" testID={testID} style={styles.segment}>
      {values.map((entry) => {
        const active = entry === value;
        return (
          <Pressable key={String(entry)} accessibilityRole="radio" accessibilityState={{ checked: active }} testID={testID ? scopedTestId(testID, entry) : undefined} onPress={() => onChange(entry)} style={({ pressed }) => [styles.segmentItem, active && styles.segmentItemActive, pressed && styles.pressed]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{String(entry)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PrimaryButton({ title, disabled = false, loading = false, onPress, testID }: { title: string; disabled?: boolean; loading?: boolean; onPress: () => void; testID?: string }) {
  const blocked = disabled || loading;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: blocked, busy: loading }} testID={testID} disabled={blocked} onPress={onPress} style={({ pressed }) => [styles.primaryButton, blocked && styles.disabled, pressed && !blocked && styles.pressed]}>
      {loading ? <ActivityIndicator color={theme.colors.inverse} size="small" /> : <Text style={styles.primaryButtonText}>{title}</Text>}
    </Pressable>
  );
}

export function ScopeSelector({ scope, selected, onToggle }: {
  scope: ScopeDictionary[];
  selected: Set<string>;
  onToggle: (key: string, active: boolean) => void;
}) {
  return (
    <View style={styles.scopeList}>
      {scope.map((dictionary) => {
        const keys = dictionary.sections.map((section) => scopeKey(dictionary.id, section.id));
        const activeCount = keys.filter((key) => selected.has(key)).length;
        const allActive = keys.length > 0 && activeCount === keys.length;
        return (
          <View key={dictionary.id} style={styles.scopeBlock}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allActive ? true : activeCount > 0 ? 'mixed' : false }}
              onPress={() => keys.forEach((key) => onToggle(key, !allActive))}
              style={styles.scopeDictionary}
            >
              <Check active={allActive} partial={activeCount > 0 && !allActive} />
              <View style={styles.scopeCopy}><Text style={styles.scopeDictionaryName}>{dictionary.name}</Text><Text style={styles.scopeCount}>{dictionary.count}</Text></View>
            </Pressable>
            {dictionary.sections.map((section) => {
              const key = scopeKey(dictionary.id, section.id);
              const active = selected.has(key);
              return (
                <Pressable key={section.id} accessibilityRole="checkbox" accessibilityState={{ checked: active }} onPress={() => onToggle(key, !active)} style={styles.scopeSection}>
                  <Check active={active} />
                  <View style={styles.scopeCopy}><Text style={styles.scopeSectionName}>{section.name}</Text><Text style={styles.scopeCount}>{section.count}</Text></View>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

function Check({ active, partial = false }: { active: boolean; partial?: boolean }) {
  return (
    <View style={[styles.checkbox, (active || partial) && styles.checkboxActive]}>
      {active ? <Text style={styles.checkboxMark}>✓</Text> : partial ? <View style={styles.checkboxDash} /> : null}
    </View>
  );
}

export function PracticeScreen({ header, children, footer, testID }: { header: ReactNode; children: ReactNode; footer?: ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View testID={testID} style={styles.screen}>
      {header}
      <ScrollView style={styles.body} contentContainerStyle={[styles.bodyContent, { paddingBottom: footer ? 124 + insets.bottom : 30 + insets.bottom }]} showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
      {footer ? <View style={[styles.footer, { paddingBottom: 10 + insets.bottom }]}>{footer}</View> : null}
    </View>
  );
}

export const commonStyles = StyleSheet.create({
  lead: { paddingVertical: 12, gap: 3 },
  leadStrong: { color: theme.colors.text, fontSize: 18, fontWeight: '800' },
  leadMuted: { color: theme.colors.textMuted, fontSize: 11, lineHeight: 15 },
  sectionLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 8, marginBottom: 7 },
  resultSummary: { alignItems: 'center', paddingVertical: 22, gap: 5 },
  resultPercent: { color: theme.colors.text, fontSize: 32, fontWeight: '900' },
  resultText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { color: theme.colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptyText: { marginTop: 6, color: theme.colors.textMuted, fontSize: 12, lineHeight: 17, textAlign: 'center' },
});

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  header: { position: 'relative', zIndex: 10, backgroundColor: 'rgba(238,233,223,0.90)', flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 8 },
  backButton: { width: 44, height: 44, borderRadius: 22, marginBottom: 3, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(54,50,43,0.10)', backgroundColor: 'rgba(246,242,233,0.28)' },
  headerCopy: { position: 'absolute', left: 56, right: 56, bottom: 0, height: 50, alignItems: 'center', justifyContent: 'center' },
  headerAction: { position: 'absolute', right: 8, bottom: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { maxWidth: '100%', color: theme.colors.text, fontSize: 17, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  headerSubtitle: { maxWidth: '100%', color: theme.colors.textMuted, fontSize: 10, lineHeight: 12, fontWeight: '600', marginTop: 1, textAlign: 'center' },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 16, paddingTop: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, backgroundColor: 'rgba(238,233,223,0.95)' },
  segment: { minHeight: 50, padding: 3, borderRadius: 13, flexDirection: 'row', backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.lineSoft },
  segmentItem: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  segmentItemActive: { backgroundColor: theme.colors.text },
  segmentText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700' },
  segmentTextActive: { color: theme.colors.inverse },
  primaryButton: { minHeight: 48, borderRadius: theme.radius.sm, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: theme.colors.inverse, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  scopeList: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  scopeBlock: { borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, paddingVertical: 4 },
  scopeDictionary: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10 },
  scopeSection: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 20 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(246,242,233,0.28)' },
  checkboxActive: { borderColor: theme.colors.accentStrong, backgroundColor: theme.colors.accentStrong },
  checkboxMark: { color: theme.colors.inverse, fontSize: 13, lineHeight: 15, fontWeight: '900' },
  checkboxDash: { width: 8, height: 2, borderRadius: 1, backgroundColor: theme.colors.inverse },
  scopeCopy: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
  scopeDictionaryName: { flex: 1, color: theme.colors.text, fontSize: 13, fontWeight: '800' },
  scopeSectionName: { flex: 1, color: theme.colors.text, fontSize: 12, fontWeight: '600' },
  scopeCount: { color: theme.colors.textSoft, fontSize: 10, fontWeight: '600' },
});
