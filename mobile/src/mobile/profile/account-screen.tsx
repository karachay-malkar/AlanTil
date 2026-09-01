import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useI18n } from '@/src/mobile/i18n';
import { PracticeHeader } from '@/src/mobile/practice/common';
import { filterNickname, providerLabel, validateNickname } from '@/src/mobile/profile/policy';
import { checkNickname, chooseAvatarGender, createProfile, loadProfile, type ProfileRow } from '@/src/mobile/profile/repository';
import { useSession } from '@/src/mobile/session';
import { theme } from '@/src/mobile/theme';
import { AppText as Text } from '@/src/mobile/typography';

const AVATARS = {
  male: require('../../../assets/profile/avatar_male.png'),
  female: require('../../../assets/profile/avatar_female.png'),
} as const;

type NicknameStatus = { state: 'idle' | 'invalid' | 'checking' | 'available' | 'taken' | 'error'; message: string; available: boolean };
const EMPTY_STATUS: NicknameStatus = { state: 'idle', message: '', available: false };

function AvatarChoice({ gender, label, disabled, onPress }: {
  gender: 'male' | 'female';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.avatarChoice, disabled && styles.disabled, pressed && styles.pressed]}
  >
    <Image source={AVATARS[gender]} resizeMode="contain" style={styles.avatarChoiceImage} />
    <Text style={styles.avatarChoiceLabel}>{label}</Text>
  </Pressable>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View style={styles.fact}>
    <Text style={styles.factLabel}>{label}</Text>
    <Text selectable style={styles.factValue}>{value || '—'}</Text>
  </View>;
}

export function AccountScreen() {
  const auth = useSession();
  const { t } = useI18n();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState<NicknameStatus>(EMPTY_STATUS);
  const [retryToken, setRetryToken] = useState(0);
  const checkRequest = useRef(0);
  const userId = auth.user?.id;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return () => { active = false; };
    }
    void loadProfile(userId).then((value) => {
      if (active) setProfile(value);
    }).catch(() => {
      if (active) setError(t('account.profile_error'));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [t, userId]);

  useEffect(() => {
    if (profile || !userId) return;
    const request = ++checkRequest.current;
    const validation = validateNickname(nickname);
    if (!nickname) {
      setNicknameStatus(EMPTY_STATUS);
      return;
    }
    if (!validation.valid) {
      setNicknameStatus({ state: 'invalid', message: validation.reason === 'required' ? t('account.nickname_required') : t('account.nickname_requirements'), available: false });
      return;
    }
    setNicknameStatus({ state: 'checking', message: t('account.nickname_checking'), available: false });
    const timer = setTimeout(() => {
      void checkNickname(validation.nickname).then((result) => {
        if (request !== checkRequest.current) return;
        setNicknameStatus(result.available
          ? { state: 'available', message: t('account.nickname_available'), available: true }
          : { state: 'taken', message: t('account.nickname_taken'), available: false });
      }).catch(() => {
        if (request !== checkRequest.current) return;
        setNicknameStatus({ state: 'error', message: t('account.profile_error'), available: false });
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [nickname, profile, retryToken, t, userId]);

  const submitNickname = async () => {
    if (!userId || busy || !nicknameStatus.available) return;
    setBusy(true);
    setError('');
    try {
      const availability = await checkNickname(nickname);
      if (!availability.available) {
        setNicknameStatus({ state: 'taken', message: t('account.nickname_taken'), available: false });
        return;
      }
      setProfile(await createProfile(userId, availability.nickname));
    } catch (reason) {
      const code = String((reason as { code?: string })?.code ?? '');
      setError(code === '23505' ? t('account.nickname_taken') : t('account.profile_error'));
    } finally {
      setBusy(false);
    }
  };

  const selectAvatar = (gender: 'male' | 'female') => {
    if (!userId || busy) return;
    const label = gender === 'female' ? t('account.avatar_female') : t('account.avatar_male');
    Alert.alert(t('account.avatar_confirm_title'), t('account.avatar_confirm_body', { label: label.toLowerCase() }), [
      { text: t('common.back'), style: 'cancel' },
      {
        text: t('account.choose'),
        onPress: () => {
          setBusy(true);
          setError('');
          void chooseAvatarGender(userId, gender).then(setProfile).catch(() => {
            setError(t('account.profile_error'));
          }).finally(() => setBusy(false));
        },
      },
    ]);
  };

  return <View style={styles.screen}>
    <PracticeHeader title={t('account.title')} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {loading ? <ActivityIndicator color={theme.colors.accentStrong} /> : !auth.user ? <>
        <View style={styles.guestMark}><Text style={styles.guestMarkText}>A</Text></View>
        <Text style={styles.title}>{t('account.guest')}</Text>
        <Text style={styles.body}>{t('account.login_body')}</Text>
        {auth.error ? <Text accessibilityRole="alert" style={styles.error}>{auth.error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: auth.authBusy, busy: auth.authBusy }}
          disabled={auth.authBusy}
          onPress={() => { void auth.signInWithGoogle(); }}
          style={({ pressed }) => [styles.googleButton, auth.authBusy && styles.disabled, pressed && styles.pressed]}
        >
          {auth.authBusy ? <ActivityIndicator color={theme.colors.text} size="small" /> : <Text style={styles.googleGlyph}>G</Text>}
          <Text style={styles.googleText}>{t('account.google')}</Text>
        </Pressable>
      </> : !profile ? <>
        <Text style={styles.title}>{t('account.nickname_title')}</Text>
        <Text style={styles.body}>{t('account.nickname_requirements')}</Text>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Email</Text>
          <Text selectable style={styles.readonlyValue}>{auth.user.email ?? '—'}</Text>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>{t('account.nickname')}</Text>
          <TextInput
            accessibilityLabel={t('account.nickname')}
            accessibilityState={{ disabled: busy }}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!busy}
            maxLength={15}
            onChangeText={(value) => setNickname(filterNickname(value))}
            returnKeyType="done"
            style={[styles.input, nicknameStatus.state === 'available' && styles.inputSuccess, ['invalid', 'taken', 'error'].includes(nicknameStatus.state) && styles.inputError]}
            value={nickname}
          />
          {nicknameStatus.message ? <Text accessibilityLiveRegion="polite" style={[styles.status, nicknameStatus.state === 'available' && styles.statusSuccess, ['invalid', 'taken', 'error'].includes(nicknameStatus.state) && styles.statusError]}>{nicknameStatus.message}</Text> : null}
          {nicknameStatus.state === 'error' ? <Pressable accessibilityRole="button" onPress={() => setRetryToken((value) => value + 1)} style={styles.retryButton}><Text style={styles.retryText}>{t('common.retry')}</Text></Pressable> : null}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !nicknameStatus.available || busy }}
          disabled={!nicknameStatus.available || busy}
          onPress={() => { void submitNickname(); }}
          style={({ pressed }) => [styles.primaryButton, (!nicknameStatus.available || busy) && styles.disabled, pressed && styles.pressed]}
        >
          {busy ? <ActivityIndicator color={theme.colors.inverse} size="small" /> : <Text style={styles.primaryText}>{t('account.save').toUpperCase()}</Text>}
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => { void auth.signOut(); }} style={styles.textButton}><Text style={styles.textButtonLabel}>{t('account.sign_out')}</Text></Pressable>
      </> : !profile.avatar_gender ? <>
        <Text style={styles.title}>{t('account.avatar_title')}</Text>
        <Text style={styles.bodyStrong}>{t('account.avatar_choose')}</Text>
        <Text style={styles.body}>{t('account.avatar_final')}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.avatarChoices}>
          <AvatarChoice gender="male" label={t('account.avatar_male')} disabled={busy} onPress={() => selectAvatar('male')} />
          <AvatarChoice gender="female" label={t('account.avatar_female')} disabled={busy} onPress={() => selectAvatar('female')} />
        </View>
      </> : <>
        <Image source={AVATARS[profile.avatar_gender]} resizeMode="contain" style={styles.profileAvatar} />
        <Text style={styles.profileNickname}>{profile.nickname}</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <View style={styles.facts}>
          <Fact label={t('account.nickname')} value={profile.nickname} />
          <Fact label="Email" value={auth.user.email ?? ''} />
          <Fact label={t('account.sign_in_method')} value={providerLabel(auth.user.app_metadata)} />
          <Fact label={t('account.avatar')} value={profile.avatar_gender === 'female' ? t('account.avatar_female') : t('account.avatar_male')} />
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: auth.authBusy, busy: auth.authBusy }} disabled={auth.authBusy} onPress={() => { void auth.signOut(); }} style={styles.textButton}><Text style={styles.textButtonLabel}>{t('account.sign_out')}</Text></Pressable>
      </>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: 18, paddingTop: 24, paddingBottom: 40, justifyContent: 'center', gap: 14 },
  guestMark: { width: 84, height: 84, borderRadius: 42, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface2 },
  guestMarkText: { color: theme.colors.accentStrong, fontSize: 38, lineHeight: 46, fontWeight: '900' },
  title: { color: theme.colors.text, fontSize: 23, lineHeight: 30, fontWeight: '900', textAlign: 'center' },
  bodyStrong: { color: theme.colors.text, fontSize: 15, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  body: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  googleButton: { minHeight: 50, marginTop: 8, flexDirection: 'row', gap: 11, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  googleGlyph: { color: '#4285f4', fontSize: 19, fontWeight: '900' },
  googleText: { color: theme.colors.text, fontSize: 13, fontWeight: '900' },
  field: { gap: 6 },
  fieldLabel: { color: theme.colors.textMuted, fontSize: 10, lineHeight: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  readonlyValue: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.lineSoft, backgroundColor: theme.colors.surface2, color: theme.colors.textMuted, paddingHorizontal: 13, paddingVertical: 13, fontSize: 13 },
  input: { minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, color: theme.colors.text, paddingHorizontal: 13, fontSize: 15, fontWeight: '700' },
  inputSuccess: { borderColor: theme.colors.success },
  inputError: { borderColor: theme.colors.danger },
  status: { minHeight: 16, color: theme.colors.textMuted, fontSize: 10, lineHeight: 15 },
  statusSuccess: { color: theme.colors.success },
  statusError: { color: theme.colors.danger },
  retryButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  retryText: { color: theme.colors.accentStrong, fontSize: 10, fontWeight: '900' },
  primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: theme.colors.accentStrong, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: theme.colors.inverse, fontSize: 11, fontWeight: '900' },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '800' },
  avatarChoices: { minHeight: 280, flexDirection: 'row', gap: 10, marginTop: 8 },
  avatarChoice: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end', paddingTop: 10, paddingBottom: 14 },
  avatarChoiceImage: { flex: 1, width: '100%', minHeight: 210 },
  avatarChoiceLabel: { color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: '900' },
  profileAvatar: { width: 180, height: 230, alignSelf: 'center' },
  profileNickname: { color: theme.colors.text, fontSize: 24, lineHeight: 31, fontWeight: '900', textAlign: 'center' },
  facts: { borderTopWidth: 1, borderTopColor: theme.colors.lineSoft },
  fact: { minHeight: 58, borderBottomWidth: 1, borderBottomColor: theme.colors.lineSoft, justifyContent: 'center' },
  factLabel: { color: theme.colors.textSoft, fontSize: 9, lineHeight: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  factValue: { marginTop: 3, color: theme.colors.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  error: { color: theme.colors.danger, fontSize: 11, lineHeight: 16, textAlign: 'center' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.99 }] },
});
