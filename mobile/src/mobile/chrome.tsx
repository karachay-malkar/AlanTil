import { Image, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlanIcon } from '@/src/mobile/icons';
import { theme } from '@/src/mobile/theme';
import { testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { height: 42 + insets.top, paddingTop: insets.top }] }>
      <View style={styles.headerCenter}>
        <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function PathIcon({ active }: { active: boolean }) {
  return <Image source={require('../../assets/path/path-elbrus-white.png')} resizeMode="contain" style={[styles.elbrus, { tintColor: active ? theme.colors.inverse : theme.colors.textMuted }]} />;
}

export function AlanTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 4);
  return (
    <View style={[styles.tabBar, { height: 60 + bottom, paddingBottom: bottom }] }>
      {state.routes.map((route: any, index: number) => {
        const focused = state.index === index;
        const label = descriptors[route.key]?.options?.title ?? route.name;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityLabel={String(label)}
            accessibilityState={{ selected: focused }}
            testID={route.name === 'path' ? testIds.tab.path : route.name === 'practice' ? testIds.tab.practice : testIds.tab.profile}
            onPress={onPress}
            style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
          >
            <View style={[styles.iconBubble, focused && styles.iconBubbleActive]}>
              {route.name === 'path'
                ? <PathIcon active={focused} />
                : <AlanIcon
                  color={focused ? theme.colors.inverse : theme.colors.textMuted}
                  name={route.name === 'practice' ? 'practice' : 'profile'}
                  size={20}
                />}
            </View>
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'relative', zIndex: 40, backgroundColor: 'rgba(238,233,223,0.62)' },
  headerCenter: { position: 'absolute', left: 56, right: 56, bottom: 0, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { maxWidth: '100%', color: theme.colors.text, fontSize: 17, lineHeight: 19, fontWeight: '800', textAlign: 'center' },
  headerSubtitle: { maxWidth: '100%', marginTop: 2, color: theme.colors.textMuted, fontSize: 10, lineHeight: 11, fontWeight: '600', textAlign: 'center' },
  tabBar: { flexDirection: 'row', alignItems: 'flex-start', paddingTop: 2, paddingHorizontal: 12, backgroundColor: 'rgba(238,233,223,0.88)', borderTopWidth: 0 },
  tabItem: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 1, gap: 2 },
  tabItemPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  iconBubble: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(54,50,43,0.075)', backgroundColor: 'rgba(246,242,233,0.26)' },
  iconBubbleActive: { backgroundColor: 'rgba(41,39,34,0.88)', borderColor: 'rgba(41,39,34,0.32)' },
  tabLabel: { color: 'rgba(102,97,88,0.62)', fontSize: 10, lineHeight: 11, fontWeight: '600' },
  tabLabelActive: { color: theme.colors.text },
  elbrus: { width: 29, height: 17, opacity: 0.96 },
});
