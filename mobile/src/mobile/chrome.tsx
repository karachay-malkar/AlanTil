import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/src/mobile/theme';

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top }] }>
      <View style={styles.headerCenter}>
        <Text numberOfLines={1} style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function PracticeIcon({ active }: { active: boolean }) {
  return (
    <View style={styles.practiceIcon}>
      {[0, 1, 2, 3].map((item) => <View key={item} style={[styles.practiceSquare, active && styles.iconFillActive]} />)}
    </View>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <View style={styles.profileIcon}>
      <View style={[styles.profileHead, active && styles.iconFillActive]} />
      <View style={[styles.profileBody, active && styles.iconFillActive]} />
    </View>
  );
}

function PathIcon() {
  return <Image source={require('../../assets/path/path-elbrus-white.png')} resizeMode="contain" style={styles.elbrus} />;
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
            accessibilityState={focused ? { selected: true } : {}}
            onPress={onPress}
            style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
          >
            <View style={[styles.iconBubble, focused && styles.iconBubbleActive]}>
              {route.name === 'path' ? <PathIcon /> : route.name === 'practice' ? <PracticeIcon active={focused} /> : <ProfileIcon active={focused} />}
            </View>
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 42, position: 'relative', zIndex: 40, backgroundColor: 'transparent' },
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
  practiceIcon: { width: 20, height: 20, flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  practiceSquare: { width: 9, height: 9, backgroundColor: theme.colors.textMuted },
  profileIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  profileHead: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.textMuted, marginBottom: 1 },
  profileBody: { width: 16, height: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: theme.colors.textMuted },
  iconFillActive: { backgroundColor: theme.colors.inverse },
});
