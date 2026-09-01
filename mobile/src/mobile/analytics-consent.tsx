import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readAnalyticsPreference, saveAnalyticsPreference, trackMobileEvent, type AnalyticsPreference } from '@/src/mobile/analytics';
import { useI18n } from '@/src/mobile/i18n';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

export function AnalyticsConsentGate() {
  const auth = useSession();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const { t } = useI18n();
  const [preference, setPreference] = useState<AnalyticsPreference | null>(null);
  const [saving, setSaving] = useState(false);
  const userId = auth.user?.id;

  useEffect(() => {
    let active = true;
    setPreference(null);
    void readAnalyticsPreference(userId).then((value) => { if (active) setPreference(value); });
    return () => { active = false; };
  }, [userId]);

  const choose = async (enabled: boolean) => {
    if (saving) return;
    setSaving(true);
    try {
      const next = await saveAnalyticsPreference(enabled, userId);
      setPreference(next);
      if (enabled) {
        void trackMobileEvent('app_open', { screen_name: pathname }, userId);
        void trackMobileEvent('page_view', { screen_name: pathname, page_path: pathname }, userId);
      }
    } finally {
      setSaving(false);
    }
  };

  const visible = settings.onboarding_step === 'done'
    && preference?.enabled === null
    && pathname !== '/profile/privacy';

  return (
    <Modal animationType="fade" onRequestClose={() => void choose(false)} transparent visible={visible}>
      <View style={styles.scrim}>
        <View accessibilityLabel={t('privacy.consent_title')} accessibilityRole="alert" testID={testIds.analytics.consent} style={[styles.panel, { marginBottom: 10 + insets.bottom }]}>
          <Text style={styles.title}>{t('privacy.consent_title')}</Text>
          <Text style={styles.body}>{t('privacy.consent_body')}</Text>
          <Pressable accessibilityRole="link" accessibilityState={{ disabled: saving }} testID={testIds.analytics.policy} disabled={saving} onPress={() => router.push('/profile/privacy')} style={styles.linkButton}>
            <Text style={styles.link}>{t('privacy.policy')}</Text>
          </Pressable>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} testID={testIds.analytics.decline} disabled={saving} onPress={() => void choose(false)} style={({ pressed }) => [styles.decline, pressed && styles.pressed]}>
              <Text style={styles.declineText}>{t('privacy.decline')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} testID={testIds.analytics.accept} disabled={saving} onPress={() => void choose(true)} style={({ pressed }) => [styles.accept, pressed && styles.pressed]}>
              {saving ? <ActivityIndicator color={theme.colors.inverse} size="small" /> : <Text style={styles.acceptText}>{t('privacy.accept')}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(30,28,24,0.34)', paddingHorizontal: 8 },
  panel: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface },
  title: { color: theme.colors.text, fontSize: 15, lineHeight: 20, fontWeight: '900', textAlign: 'center' },
  body: { marginTop: 5, color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  link: { color: theme.colors.accentStrong, fontSize: 11, fontWeight: '800', textDecorationLine: 'underline' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  decline: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  declineText: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  accept: { flex: 1, minHeight: 44, borderRadius: 11, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  acceptText: { color: theme.colors.inverse, fontSize: 10, lineHeight: 14, fontWeight: '900', textAlign: 'center' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
