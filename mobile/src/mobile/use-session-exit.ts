import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert, BackHandler } from 'react-native';

import { useI18n } from '@/src/mobile/i18n';

export function useSessionExitGuard(active: boolean, interrupt: (reason: string) => Promise<unknown>) {
  const leaving = useRef(false);
  const { t } = useI18n();

  const requestLeave = useCallback((reason = 'back') => {
    if (!active || leaving.current) {
      router.back();
      return;
    }
    Alert.alert(
      t('session_exit.title'),
      t('session_exit.body'),
      [
        { text: t('session_exit.stay'), style: 'cancel' },
        {
          text: t('session_exit.end'),
          style: 'destructive',
          onPress: () => {
            leaving.current = true;
            void interrupt(reason).finally(() => router.back());
          },
        },
      ],
    );
  }, [active, interrupt, t]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      requestLeave('hardware_back');
      return true;
    });
    return () => subscription.remove();
  }, [requestLeave]));

  return requestLeave;
}
