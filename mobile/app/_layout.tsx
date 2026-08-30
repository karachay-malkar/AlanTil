import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/src/mobile/session';
import { SettingsProvider } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <SettingsProvider>
          <StatusBar style="dark" backgroundColor={theme.colors.background} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </SettingsProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
