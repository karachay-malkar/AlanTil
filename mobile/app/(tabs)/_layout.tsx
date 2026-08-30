import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { theme } from '@/src/mobile/theme';

function TabMark({ focused }: { focused: boolean }) {
  return <View style={[styles.mark, focused && styles.markActive]} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="path"
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.accentStrong,
        tabBarInactiveTintColor: theme.colors.textSoft,
        tabBarStyle: {
          height: 60,
          paddingTop: 5,
          paddingBottom: 5,
          borderTopWidth: 1,
          borderTopColor: theme.colors.lineSoft,
          backgroundColor: theme.colors.background,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="path" options={{ title: 'Путь', tabBarIcon: ({ focused }) => <TabMark focused={focused} /> }} />
      <Tabs.Screen name="practice" options={{ title: 'Практика', tabBarIcon: ({ focused }) => <TabMark focused={focused} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль', tabBarIcon: ({ focused }) => <TabMark focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  mark: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(70,66,59,0.22)' },
  markActive: { width: 8, backgroundColor: theme.colors.accentStrong },
});
