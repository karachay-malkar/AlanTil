import { Stack } from 'expo-router';

import { theme } from '@/src/mobile/theme';

export default function ProfileLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: theme.colors.background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="statistics" />
    <Stack.Screen name="settings" options={{ gestureEnabled: false }} />
  </Stack>;
}
