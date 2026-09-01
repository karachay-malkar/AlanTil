import { createContext, type PropsWithChildren, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GENERAL_GUIDE_STEPS, guideMessage } from '../../../packages/alantil-core/guide.js';
import { useI18n } from '@/src/mobile/i18n';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

export function GuideCarousel({ onDone, onSkip }: { onDone: () => void | Promise<void>; onSkip?: () => void | Promise<void> }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const step = GENERAL_GUIDE_STEPS[index];
  const last = index === GENERAL_GUIDE_STEPS.length - 1;
  const title = guideMessage(settings.interface_language_code, step.titleKey, step.params ?? {}, { plain: true });
  const body = guideMessage(settings.interface_language_code, step.bodyKey, step.params ?? {}, { plain: true });

  const finish = async (skipped = false) => {
    if (busy) return;
    setBusy(true);
    try {
      await (skipped ? (onSkip ?? onDone)() : onDone());
    } finally {
      setBusy(false);
    }
  };

  return <View testID={testIds.onboarding.guide} style={styles.carousel}>
    <View style={styles.guideTopRow}>
      <Text accessibilityRole="header" style={styles.guideLabel}>{t('guide.help_app')}</Text>
      {!last ? <Pressable
        accessibilityRole="button"
        testID={testIds.onboarding.guideSkip}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={() => { void finish(true); }}
        style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}
      >
        <Text style={styles.skipText}>{t('common.skip')}</Text>
      </Pressable> : null}
    </View>

    <View style={styles.visual} accessibilityElementsHidden>
      <View style={styles.visualHalo}>
        <Text adjustsFontSizeToFit numberOfLines={1} style={styles.visualSymbol}>{step.symbol}</Text>
      </View>
    </View>

    <View style={styles.guideCopy} accessibilityLiveRegion="polite">
      <Text style={styles.guideProgress}>{t('guide.progress', { current: index + 1, total: GENERAL_GUIDE_STEPS.length })}</Text>
      <Text style={styles.guideTitle}>{title}</Text>
      <Text style={styles.guideBody}>{body}</Text>
    </View>

    <View accessibilityLabel={t('guide.progress', { current: index + 1, total: GENERAL_GUIDE_STEPS.length })} style={styles.dots}>
      {GENERAL_GUIDE_STEPS.map((item, dotIndex) => <View key={item.id} style={[styles.dot, dotIndex === index && styles.dotActive]} />)}
    </View>

    <View style={styles.guideActions}>
      <Pressable
        accessibilityRole="button"
        testID={testIds.onboarding.guideBack}
        accessibilityLabel={t('common.back')}
        accessibilityState={{ disabled: index === 0 || busy }}
        disabled={index === 0 || busy}
        onPress={() => setIndex((value) => Math.max(0, value - 1))}
        style={({ pressed }) => [styles.secondaryButton, (index === 0 || busy) && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.secondaryText}>{t('common.back')}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        testID={testIds.onboarding.guideNext}
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy}
        onPress={() => { if (last) void finish(); else setIndex((value) => Math.min(GENERAL_GUIDE_STEPS.length - 1, value + 1)); }}
        style={({ pressed }) => [styles.primaryButton, busy && styles.disabled, pressed && styles.pressed]}
      >
        <Text style={styles.primaryText}>{last ? t('common.done') : t('common.next')}</Text>
      </Pressable>
    </View>
  </View>;
}

type GuideContextValue = { openGuide: () => void };

const GuideContext = createContext<GuideContextValue>({ openGuide: () => {} });

export function GuideProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ openGuide: () => setOpen(true) }), []);
  return <GuideContext.Provider value={value}>
    {children}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.modalBackdrop}>
        <View accessibilityViewIsModal style={styles.modalPanel}>
          <GuideCarousel onDone={() => setOpen(false)} onSkip={() => setOpen(false)} />
        </View>
      </SafeAreaView>
    </Modal>
  </GuideContext.Provider>;
}

export function useGuide() {
  return useContext(GuideContext);
}

const styles = StyleSheet.create({
  carousel: { flex: 1, minHeight: 0 },
  guideTopRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  guideLabel: { flex: 1, color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  skipButton: { minWidth: 76, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', borderRadius: 10 },
  skipText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800' },
  visual: { flex: 1, minHeight: 118, alignItems: 'center', justifyContent: 'center' },
  visualHalo: { width: 142, height: 142, borderRadius: 71, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface2, shadowColor: '#3f382e', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.13, shadowRadius: 22, elevation: 4 },
  visualSymbol: { maxWidth: 102, color: theme.colors.accentStrong, fontSize: 55, lineHeight: 68, fontWeight: '900', textAlign: 'center' },
  guideCopy: { minHeight: 146, justifyContent: 'flex-start' },
  guideProgress: { color: theme.colors.textSoft, fontSize: 10, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  guideTitle: { marginTop: 8, color: theme.colors.text, fontSize: 22, lineHeight: 29, fontWeight: '900', textAlign: 'center' },
  guideBody: { marginTop: 10, color: theme.colors.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  dots: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.line },
  dotActive: { width: 17, backgroundColor: theme.colors.accentStrong },
  guideActions: { flexDirection: 'row', gap: 10, paddingTop: 5 },
  secondaryButton: { flex: 1, minHeight: 48, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { flex: 1, minHeight: 48, backgroundColor: theme.colors.accentStrong, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: theme.colors.text, fontSize: 11, fontWeight: '900' },
  primaryText: { color: theme.colors.inverse, fontSize: 11, fontWeight: '900' },
  modalBackdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(30,27,23,0.6)', padding: 16 },
  modalPanel: { flex: 1, width: '100%', maxWidth: 480, maxHeight: 690, alignSelf: 'center', borderRadius: 20, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.background, padding: 18 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
});