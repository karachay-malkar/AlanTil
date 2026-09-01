import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';

import { useSession } from '@/src/mobile/session';
import { theme } from '@/src/mobile/theme';
import { AppText as Text } from '@/src/mobile/typography';

export default function AuthCallbackScreen() {
  const { ready, session, authBusy, error } = useSession();

  useEffect(() => {
    if (!ready || authBusy) return;
    if (session) {
      router.replace('/(tabs)/path');
      return;
    }
    if (error) router.replace('/');
  }, [ready, authBusy, session, error]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, padding: 24 }}>
      <ActivityIndicator color={theme.colors.accentStrong} />
      <Text style={{ marginTop: 12, textAlign: 'center' }}>{error || 'Выполняется вход…'}</Text>
    </View>
  );
}
