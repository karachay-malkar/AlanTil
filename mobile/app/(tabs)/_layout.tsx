import { Tabs } from 'expo-router';

import { AlanTabBar } from '@/src/mobile/chrome';
import { useI18n } from '@/src/mobile/i18n';
import { theme } from '@/src/mobile/theme';

export default function TabsLayout() {
  const { t } = useI18n();
  return (
    <Tabs
      initialRouteName="path"
      tabBar={(props) => <AlanTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="path" options={{ title: t('tabs.path') }} />
      <Tabs.Screen name="practice" options={{ title: t('tabs.practice') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
