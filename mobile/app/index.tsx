import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/src/mobile/onboarding';
import { resumeActivitySession } from '@/src/mobile/activity-session';
import { useSession } from '@/src/mobile/session';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { testIds } from '@/src/mobile/test-ids';

export default function HomeScreen() {
  const auth = useSession();
  const { ready, settings } = useSettings();
  const [resumeHref, setResumeHref] = useState<'/practice/test/session' | '/practice/match/session' | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);

  useEffect(() => {
    if (!ready || !auth.ready || !settings.learning_setup_completed_at) return;
    let active = true;
    void Promise.all([
      resumeActivitySession('test', auth.user?.id),
      resumeActivitySession('match', auth.user?.id),
    ]).then(([test, match]) => {
      if (!active) return;
      const selected = [
        test ? { href: '/practice/test/session' as const, time: Date.parse(test.runtime.startedAt) || 0 } : null,
        match ? { href: '/practice/match/session' as const, time: Date.parse(match.runtime.startedAt) || 0 } : null,
      ].filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).sort((left, right) => right.time - left.time)[0];
      setResumeHref(selected?.href ?? null);
      setResumeChecked(true);
    });
    return () => { active = false; };
  }, [ready, auth.ready, auth.user?.id, settings.learning_setup_completed_at]);

  if (!ready) {
    return (
      <View testID={testIds.app.loading} style={styles.loading}>
        <ActivityIndicator color={theme.colors.accentStrong} size="large" />
      </View>
    );
  }

  if (!settings.learning_setup_completed_at) {
    return <OnboardingScreen />;
  }

  if (!resumeChecked) {
    return <View testID={testIds.app.loading} style={styles.loading}><ActivityIndicator color={theme.colors.accentStrong} size="large" /></View>;
  }

  if (resumeHref) return <Redirect href={resumeHref} />;

  return <Redirect href="/(tabs)/path" />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
});
