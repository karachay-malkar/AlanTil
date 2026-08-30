import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from '@/src/mobile/session';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#0b1830' },
            headerTintColor: '#ffffff',
            contentStyle: { backgroundColor: '#081223' },
          }}
        >
          <Stack.Screen name="index" options={{ title: 'Алан тил' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
