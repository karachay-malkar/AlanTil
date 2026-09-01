import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readAnalyticsPreference, saveAnalyticsPreference } from '@/src/mobile/analytics';
import { getDictionaryStatus } from '@/src/mobile/dictionary';
import { useI18n } from '@/src/mobile/i18n';
import { PracticeHeader } from '@/src/mobile/practice/common';
import { useSession } from '@/src/mobile/session';
import { theme } from '@/src/mobile/theme';
import { AppText as Text } from '@/src/mobile/typography';
import { APP_BUILD_NUMBER, APP_VERSION } from '@/src/mobile/version';

function DocumentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

export function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const auth = useSession();
  const { t } = useI18n();
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void readAnalyticsPreference(auth.user?.id).then((preference) => {
      if (!active) return;
      setAnalyticsEnabled(preference.enabled === true);
      setReady(true);
    });
    return () => { active = false; };
  }, [auth.user?.id]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      await saveAnalyticsPreference(analyticsEnabled, auth.user?.id);
      setMessage(t('privacy.saved'));
    } catch {
      setError(t('privacy.save_error'));
    } finally {
      setSaving(false);
    }
  };

  return <View style={styles.screen}>
    <PracticeHeader title={t('privacy.policy')} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 36 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      <Text style={styles.intro}>{t('privacy.intro')}</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('mailto:alantil0709@gmail.com')}><Text style={styles.email}>alantil0709@gmail.com</Text></Pressable>
      <DocumentSection title={t('privacy.local_title')}><Text style={styles.paragraph}>{t('privacy.local_body')}</Text></DocumentSection>
      <DocumentSection title={t('privacy.account_title')}><Text style={styles.paragraph}>{t('privacy.account_body')}</Text></DocumentSection>
      <DocumentSection title={t('privacy.cloud_title')}><Text style={styles.paragraph}>{t('privacy.cloud_body')}</Text></DocumentSection>
      <DocumentSection title={t('privacy.activity_title')}><Text style={styles.paragraph}>{t('privacy.activity_body')}</Text></DocumentSection>
      <DocumentSection title={t('privacy.analytics_title')}><Text style={styles.paragraph}>{t('privacy.analytics_body')}</Text></DocumentSection>
      <DocumentSection title={t('privacy.not_sent_title')}><Text style={styles.paragraph}>{t('privacy.not_sent_body')}</Text></DocumentSection>
      <DocumentSection title={t('privacy.purpose_title')}><Text style={styles.paragraph}>{t('privacy.purpose_body')}</Text></DocumentSection>
      <DocumentSection title={t('privacy.delete_title')}><Text style={styles.paragraph}>{t('privacy.delete_body')}</Text></DocumentSection>

      <View style={styles.preferenceSection}>
        <Text style={styles.sectionTitle}>{t('privacy.analytics_title')}</Text>
        <Text style={styles.paragraph}>{t('privacy.preference_body')}</Text>
        {ready ? <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>{t('privacy.allow')}</Text>
          <Switch
            accessibilityLabel={t('privacy.allow')}
            accessibilityRole="switch"
            accessibilityState={{ checked: analyticsEnabled }}
            onValueChange={(value) => { setAnalyticsEnabled(value); setMessage(''); }}
            trackColor={{ false: theme.colors.surface3, true: theme.colors.accent }}
            thumbColor={theme.colors.surface}
            value={analyticsEnabled}
          />
        </View> : <ActivityIndicator color={theme.colors.accentStrong} />}
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !ready || saving, busy: saving }} disabled={!ready || saving} onPress={() => void save()} style={({ pressed }) => [styles.primaryButton, (!ready || saving) && styles.disabled, pressed && styles.pressed]}>
          {saving ? <ActivityIndicator color={theme.colors.inverse} size="small" /> : <Text style={styles.primaryText}>{t('privacy.save').toUpperCase()}</Text>}
        </Pressable>
        {message ? <Text accessibilityRole="alert" style={styles.success}>{message}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </View>
      <Text style={styles.revision}>{t('privacy.revision')}</Text>
    </ScrollView>
  </View>;
}

export function ThanksScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  return <View style={styles.screen}>
    <PracticeHeader title={t('settings.thanks')} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 36 + insets.bottom }]}>
      <Text style={styles.documentTitle}>{t('about.thanks_title')}</Text>
      <Text style={styles.paragraph}>{t('about.thanks_body')}</Text>
      <Text style={styles.paragraph}>{t('about.thanks_future')}</Text>
    </ScrollView>
  </View>;
}

export function VersionScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [dictionaryVersion, setDictionaryVersion] = useState('…');
  useEffect(() => {
    let active = true;
    void getDictionaryStatus({ checkRemote: false }).then((status) => { if (active) setDictionaryVersion(status.installedVersion); });
    return () => { active = false; };
  }, []);
  const facts = [
    [t('about.app_version'), APP_VERSION],
    [t('about.build_number'), APP_BUILD_NUMBER],
    [t('about.dictionary_version'), dictionaryVersion],
    [t('about.release_channel'), t('about.production')],
  ];
  return <View style={styles.screen}>
    <PracticeHeader title={t('settings.app_version')} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 36 + insets.bottom }]}>
      <Text style={styles.documentTitle}>{t('about.version_title')}</Text>
      <Text style={styles.paragraph}>{t('about.version_body')}</Text>
      <View style={styles.facts}>{facts.map(([label, value]) => <View key={label} style={styles.factRow}><Text style={styles.factLabel}>{label}</Text><Text style={styles.factValue}>{value}</Text></View>)}</View>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/profile/settings')} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryText}>{t('about.open_settings').toUpperCase()}</Text></Pressable>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { paddingHorizontal: 18, paddingTop: 18, gap: 18 },
  intro: { color: theme.colors.text, fontSize: 14, lineHeight: 22, fontWeight: '600' },
  email: { marginTop: -10, color: theme.colors.accentStrong, fontSize: 13, fontWeight: '800', textDecorationLine: 'underline' },
  documentTitle: { color: theme.colors.text, fontSize: 23, lineHeight: 29, fontWeight: '900' },
  section: { gap: 7 },
  sectionTitle: { color: theme.colors.text, fontSize: 16, lineHeight: 21, fontWeight: '900' },
  paragraph: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 21 },
  preferenceSection: { marginTop: 4, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.colors.line, gap: 11 },
  switchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14 },
  switchLabel: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 19, fontWeight: '700' },
  primaryButton: { minHeight: 48, borderRadius: 11, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: theme.colors.inverse, fontSize: 11, fontWeight: '900' },
  secondaryButton: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface2, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: theme.colors.text, fontSize: 11, fontWeight: '900' },
  success: { color: theme.colors.success, fontSize: 11, lineHeight: 16, fontWeight: '800', textAlign: 'center' },
  error: { color: theme.colors.danger, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  revision: { color: theme.colors.textSoft, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  facts: { marginTop: 4, borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  factRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  factLabel: { flex: 1, color: theme.colors.textMuted, fontSize: 12 },
  factValue: { color: theme.colors.text, fontSize: 11, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
