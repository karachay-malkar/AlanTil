import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnalyticsConsentGate } from '@/src/mobile/analytics-consent';
import { MobileAnalyticsTracker } from '@/src/mobile/analytics-tracker';
import { GuideProvider } from '@/src/mobile/guide';
import { SessionProvider } from '@/src/mobile/session';
import { SettingsProvider } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SettingsProvider>
          <GuideProvider>
            <StatusBar style="dark" />
            <MobileAnalyticsTracker />
            <AnalyticsConsentGate />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="path/learn" options={{ gestureEnabled: false }} />
              <Stack.Screen name="path/station-test" options={{ gestureEnabled: false }} />
              <Stack.Screen name="practice/test/session" options={{ gestureEnabled: false }} />
              <Stack.Screen name="practice/match/session" options={{ gestureEnabled: false }} />
            </Stack>
          </GuideProvider>
        </SettingsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
