import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { OnboardingScreen } from '@/src/mobile/onboarding';
import { AppShell } from '@/src/mobile/shell';
import { useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

export default function HomeScreen() {
  const { ready, settings } = useSettings();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={theme.colors.accentStrong} size="large" />
      </View>
    );
  }

  if (!settings.learning_setup_completed_at) {
    return <OnboardingScreen />;
  }

  return <AppShell />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
});
