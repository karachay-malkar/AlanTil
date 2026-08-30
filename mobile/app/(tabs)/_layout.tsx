import { Tabs } from 'expo-router';

import { AlanTabBar } from '@/src/mobile/chrome';
import { theme } from '@/src/mobile/theme';

export default function TabsLayout() {
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
      <Tabs.Screen name="path" options={{ title: 'Путь' }} />
      <Tabs.Screen name="practice" options={{ title: 'Практика' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
    </Tabs>
  );
}
