import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useI18n } from '@/src/mobile/i18n';
import { loadProfile } from '@/src/mobile/profile/repository';
import { useSession } from '@/src/mobile/session';
import { theme } from '@/src/mobile/theme';
import { scopedTestId } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';

export type ProfileSection = 'profile' | 'statistics' | 'users' | 'settings';

function navigateTo(section: ProfileSection) {
  if (section === 'statistics') router.navigate('/profile/statistics');
  else if (section === 'users') router.navigate('/profile/users');
  else if (section === 'settings') router.navigate('/profile/settings');
  else router.navigate('/(tabs)/profile');
}

export function ProfileNavigation({ active, onSelect }: {
  active: ProfileSection;
  onSelect?: (section: ProfileSection) => void;
}) {
  const insets = useSafeAreaInsets();
  const auth = useSession();
  const { t } = useI18n();
  const [activityAccess, setActivityAccess] = useState(false);
  useEffect(() => {
    let activeRequest = true;
    if (!auth.user?.id) {
      setActivityAccess(false);
      return () => { activeRequest = false; };
    }
    void loadProfile(auth.user.id).then((profile) => { if (activeRequest) setActivityAccess(profile?.activity_access === true); }).catch(() => { if (activeRequest) setActivityAccess(false); });
    return () => { activeRequest = false; };
  }, [auth.user?.id]);
  const items: { id: ProfileSection; label: string }[] = [
    { id: 'profile', label: t('profile.title') },
    { id: 'statistics', label: t('profile.statistics') },
    ...(activityAccess ? [{ id: 'users' as const, label: t('admin.users') }] : []),
    { id: 'settings', label: t('profile.settings') },
  ];
  return <View accessibilityRole="tablist" style={[styles.navigation, { paddingTop: insets.top, height: 46 + insets.top }]}>
    {items.map((item) => {
      const selected = item.id === active;
      return <Pressable
        key={item.id}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected }}
        testID={scopedTestId('profile.nav', item.id)}
        disabled={selected}
        onPress={() => onSelect ? onSelect(item.id) : navigateTo(item.id)}
        style={({ pressed }) => [styles.tab, selected && styles.tabActive, pressed && styles.pressed]}
      >
        <Text numberOfLines={1} style={[styles.label, selected && styles.labelActive]}>{item.label}</Text>
      </Pressable>;
    })}
  </View>;
}

export function navigateProfileSection(section: ProfileSection) {
  navigateTo(section);
}

const styles = StyleSheet.create({
  navigation: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, backgroundColor: 'rgba(238,233,223,0.90)', borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  tab: { flex: 1, minWidth: 0, height: 46, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', paddingHorizontal: 3 },
  tabActive: { borderBottomColor: theme.colors.text },
  label: { color: theme.colors.textSoft, fontSize: 10, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  labelActive: { color: theme.colors.text, fontWeight: '900' },
  pressed: { opacity: 0.6 },
});
