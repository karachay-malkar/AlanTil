import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayedStructureName, loadAllWords, type MobileWord } from '@/src/mobile/dictionary';
import { AlanIcon, type AlanIconName } from '@/src/mobile/icons';
import { useI18n } from '@/src/mobile/i18n';
import { ProfileNavigation } from '@/src/mobile/profile/navigation';
import { loadProfile, type ProfileRow } from '@/src/mobile/profile/repository';
import { loadWordProgress } from '@/src/mobile/progress/repository';
import { useSession } from '@/src/mobile/session';
import { type UserSettings, useSettings } from '@/src/mobile/settings';
import { theme } from '@/src/mobile/theme';
import { scopedTestId, testIds } from '@/src/mobile/test-ids';
import { AppText as Text } from '@/src/mobile/typography';
import { APP_VERSION } from '@/src/mobile/version';

const AVATARS = {
  male: require('../../../assets/profile/avatar_male.png'),
  female: require('../../../assets/profile/avatar_female.png'),
} as const;
const STORY_ORDER = ['oblivion', 'roots', 'ascent', 'pathways'];

type StoryProgressRow = { id: string; name: string; mastered: number; total: number; percent: number };

async function loadStoryProgress(settings: UserSettings, userId: string) {
  const [words, progress] = await Promise.all([loadAllWords(), loadWordProgress(userId)]);
  const progressById = new Map(progress.map((row) => [String(row.word_id), row]));
  const groups = new Map<string, { sample: MobileWord; ids: Set<string>; mastered: Set<string> }>();
  words.forEach((word) => {
    const storyId = String(word.story_id ?? '').trim();
    if (!storyId || !word.word_id) return;
    const group = groups.get(storyId) ?? { sample: word, ids: new Set<string>(), mastered: new Set<string>() };
    group.ids.add(word.word_id);
    const status = progressById.get(word.word_id)?.mastery_status;
    if (status === 'mastered' || status === 'review') group.mastered.add(word.word_id);
    groups.set(storyId, group);
  });
  return Array.from(groups.entries()).map(([id, group]) => {
    const total = group.ids.size;
    const mastered = group.mastered.size;
    return {
      id,
      name: displayedStructureName(group.sample, 'story_name', settings) || id,
      mastered,
      total,
      percent: total ? Math.round((mastered / total) * 100) : 0,
    };
  }).sort((left, right) => {
    const leftOrder = STORY_ORDER.indexOf(left.id);
    const rightOrder = STORY_ORDER.indexOf(right.id);
    return (leftOrder < 0 ? 999 : leftOrder) - (rightOrder < 0 ? 999 : rightOrder);
  });
}

function ProfileMenu({ icon, title, subtitle, onPress, testID }: { icon: AlanIconName; title: string; subtitle: string; onPress: () => void; testID?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} testID={testID} onPress={onPress} style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}>
    <View style={styles.menuIcon}><AlanIcon color={theme.colors.accentStrong} name={icon} size={20} /></View>
    <View style={styles.menuCopy}>
      <Text style={styles.menuTitle}>{title}</Text>
      <Text style={styles.menuSubtitle}>{subtitle}</Text>
    </View>
    <AlanIcon color={theme.colors.textSoft} name="chevron" size={17} />
  </Pressable>;
}

export function ProfileHomeScreen() {
  const insets = useSafeAreaInsets();
  const auth = useSession();
  const { settings } = useSettings();
  const { t } = useI18n();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stories, setStories] = useState<StoryProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userId = auth.user?.id;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (!userId) {
      setProfile(null);
      setStories([]);
      setLoading(false);
      return () => { active = false; };
    }
    void Promise.all([loadProfile(userId), loadStoryProgress(settings, userId)]).then(([nextProfile, nextStories]) => {
      if (!active) return;
      setProfile(nextProfile);
      setStories(nextStories);
    }).catch(() => {
      if (active) setError(t('account.profile_error'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [settings.alan_dialect_code, settings.alan_script_code, settings.interface_language_code, t, userId]);

  const openStory = (storyId: string) => {
    router.navigate({
      pathname: '/(tabs)/path',
      params: { storyId, storyRequest: String(Date.now()) },
    });
  };

  const dialect = settings.alan_script_code === 'turkic'
    ? 'Latin'
    : `${t('onboarding.cyrillic')} · ${settings.alan_dialect_code === 'karachay' ? 'Дж' : settings.alan_dialect_code === 'balkar' ? 'Ж' : 'Җ'}`;

  return <View testID={testIds.profile.screen} style={styles.screen}>
    <ProfileNavigation active="profile" />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]} showsVerticalScrollIndicator={false}>
      {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accentStrong} /></View> : !auth.user ? <View style={styles.locked}>
        <View style={styles.lockedAvatar}><AlanIcon color={theme.colors.textSoft} name="profile" size={78} /><View style={styles.lockBadge}><AlanIcon color={theme.colors.inverse} name="locked" size={17} /></View></View>
        <Text style={styles.lockedTitle}>{t('profile.locked')}</Text>
        <Text style={styles.lockedBody}>{t('profile.locked_body')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/account')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>{t('profile.sign_in').toUpperCase()}</Text></Pressable>
      </View> : error ? <View style={styles.locked}>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/account')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>{t('profile.continue').toUpperCase()}</Text></Pressable>
      </View> : !profile ? <View style={styles.locked}>
        <Text style={styles.lockedTitle}>{t('profile.finish_account')}</Text>
        <Text style={styles.lockedBody}>{t('profile.create_nickname')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/account')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>{t('profile.continue').toUpperCase()}</Text></Pressable>
      </View> : !profile.avatar_gender ? <View style={styles.locked}>
        <Text style={styles.lockedTitle}>{t('account.avatar_choose')}</Text>
        <Text style={styles.lockedBody}>{t('account.avatar_final')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push('/profile/account')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryText}>{t('profile.continue').toUpperCase()}</Text></Pressable>
      </View> : <>
        <View style={styles.identity}>
          <Image source={AVATARS[profile.avatar_gender]} resizeMode="contain" style={styles.avatar} />
          <Text style={styles.nickname}>{profile.nickname}</Text>
        </View>

        <View style={styles.menu}>
          <ProfileMenu testID={testIds.profile.statistics} icon="milestone" title={t('profile.statistics')} subtitle={t('profile.progress_stories')} onPress={() => router.push('/profile/statistics')} />
          <ProfileMenu testID={testIds.profile.settings} icon="settings" title={t('profile.settings')} subtitle={`${settings.interface_language_code.toUpperCase()} · ${dialect}`} onPress={() => router.push('/profile/settings')} />
          <ProfileMenu icon="account" title={t('profile.account')} subtitle={t('account.connected')} onPress={() => router.push('/profile/account')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.progress_stories')}</Text>
          <View style={styles.storyRows}>
            {stories.map((story) => <Pressable
              key={story.id}
              accessibilityRole="button"
              accessibilityLabel={`${story.name}. ${t('profile.story_progress', story)}`}
              testID={scopedTestId('profile.story', story.id)}
              onPress={() => openStory(story.id)}
              style={({ pressed }) => [styles.storyRow, pressed && styles.pressed]}
            >
              <View style={styles.storyHead}><Text numberOfLines={1} style={styles.storyName}>{story.name}</Text><Text style={styles.storyPercent}>{story.percent}%</Text></View>
              <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${story.percent}%` }]} /></View>
              <Text style={styles.storyCount}>{story.mastered}/{story.total}</Text>
            </Pressable>)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.artifacts')}</Text>
          <Text style={styles.future}>{t('profile.artifacts_future')}</Text>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('profile.achievements')}</Text>
          <Text style={styles.future}>{t('profile.achievements_future')}</Text>
        </View>
        <View style={styles.versionRow}><Text style={styles.version}>AlanTil mobile</Text><Text style={styles.version}>{APP_VERSION}</Text></View>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 10, gap: 20 },
  loading: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center' },
  locked: { flex: 1, minHeight: 440, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  lockedAvatar: { width: 150, height: 190, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface2, alignItems: 'center', justifyContent: 'center' },
  lockBadge: { position: 'absolute', right: 12, top: 12, width: 34, height: 34, borderRadius: 17, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' },
  lockedTitle: { marginTop: 22, color: theme.colors.text, fontSize: 20, lineHeight: 27, fontWeight: '900', textAlign: 'center' },
  lockedBody: { marginTop: 8, color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  primaryButton: { width: '100%', minHeight: 48, marginTop: 22, borderRadius: 10, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: theme.colors.inverse, fontSize: 11, fontWeight: '900' },
  error: { color: theme.colors.danger, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  identity: { alignItems: 'center' },
  avatar: { width: 190, height: 245 },
  nickname: { marginTop: -8, color: theme.colors.text, fontSize: 24, lineHeight: 31, fontWeight: '900', textAlign: 'center' },
  menu: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  menuRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft },
  menuIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,107,59,0.08)' },
  menuCopy: { flex: 1, minWidth: 0 },
  menuTitle: { color: theme.colors.text, fontSize: 14, lineHeight: 19, fontWeight: '800' },
  menuSubtitle: { marginTop: 3, color: theme.colors.textMuted, fontSize: 10, lineHeight: 14 },
  section: { gap: 9 },
  sectionTitle: { color: theme.colors.text, fontSize: 12, lineHeight: 17, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  storyRows: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  storyRow: { minHeight: 72, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, justifyContent: 'center', paddingVertical: 10 },
  storyHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  storyName: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  storyPercent: { color: theme.colors.accentStrong, fontSize: 11, lineHeight: 15, fontWeight: '900', fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
  progressTrack: { height: 6, marginTop: 8, borderRadius: 3, backgroundColor: theme.colors.surface3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.accentStrong },
  storyCount: { marginTop: 4, color: theme.colors.textSoft, fontSize: 9, lineHeight: 12, fontWeight: '700', fontFamily: theme.fonts.mono, textAlign: 'right', fontVariant: ['tabular-nums'] },
  future: { minHeight: 66, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface2, color: theme.colors.textMuted, fontSize: 11, lineHeight: 16, padding: 14 },
  versionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
  version: { color: theme.colors.textSoft, fontSize: 10, lineHeight: 14 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
