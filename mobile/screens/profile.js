import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { applyUserSettingsUpdate, DEFAULT_USER_SETTINGS } from '../../packages/alantil-core/settings.js';
import { filterNickname, validateNicknameRule } from '../../packages/alantil-core/profile.js';
import { buildLearningRoute } from '../../packages/alantil-core/learning-route.js';
import { dictionaryPathProgress } from '../../packages/alantil-core/route-progress.js';
import { Button, Header, ProgressBar, Screen, SectionLabel, uiStyles } from '../ui/components.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function PrimaryTabs({ active, onChange }) {
  const items = [['profile','Профиль'],['statistics','Статистика'],['settings','Настройки']];
  return (
    <View style={styles.primaryTabs}>
      {items.map(([id,label]) => (
        <Pressable key={id} onPress={() => onChange(id)} style={styles.primaryTab}>
          <Text style={[styles.primaryTabText, active === id && styles.primaryTabActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ProfileHome({ route, onAccount }) {
  const path = useMemo(() => dictionaryPathProgress(route), [route]);
  return (
    <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.lockedState}>
        <View style={styles.avatarFrame}>
          <Text style={styles.statusLabel}>STATUS</Text>
          <View style={styles.avatarFigure}>
            <View style={styles.avatarHead} />
            <View style={styles.avatarBody} />
          </View>
          <Pressable onPress={onAccount} style={styles.accountCircle}><Text style={styles.accountCircleText}>○</Text></Pressable>
          <View style={styles.lockBadge}><Text style={styles.lockBadgeText}>⌁</Text></View>
        </View>
        <Text style={styles.lockedTitle}>Профиль недоступен</Text>
        <Text style={styles.lockedText}>Войдите, чтобы открыть аватар и связанную с аккаунтом статистику.</Text>
        <Button primary style={styles.loginButton} onPress={onAccount}>Войти</Button>
      </View>
      <View style={styles.storySection}>
        <Text style={styles.sectionTitle}>Прогресс по историям</Text>
        {(route.storyOrder || []).map((type) => {
          const story = route.stories[type];
          const value = path.stories[type] || { percent: 0 };
          return (
            <View key={type} style={styles.storyRow}>
              <View style={styles.storyHead}><Text style={styles.storyName}>{story?.label || type}</Text><Text style={styles.storyPercent}>{value.percent}%</Text></View>
              <ProgressBar value={value.percent} />
            </View>
          );
        })}
      </View>
      <View style={styles.storySection}>
        <Text style={styles.sectionTitle}>Артефакты</Text>
        <Text style={styles.futureNote}>Заработанные вещи появятся здесь позже.</Text>
      </View>
    </ScrollView>
  );
}

function Statistics({ words, route }) {
  const path = useMemo(() => dictionaryPathProgress(route), [route]);
  const completedDictionaries = Object.values(path.stories || {}).reduce((sum, value) => sum + Number(value.completedCatalogs || 0), 0);
  const stats = [
    ['0','освоенных слов'],
    [String(completedDictionaries),'завершённых словарей'],
    ['0 мин','активного времени'],
    ['0','учебных сессий'],
    ['0%','точность тестов'],
    ['0','слов к повторению'],
  ];
  return (
    <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Сводка эффективности</Text>
        <View style={styles.statsGrid}>
          {stats.map(([value,label]) => <View key={label} style={styles.statCell}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}
        </View>
      </View>
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Проблемные слова</Text>
        <Text style={styles.futureNote}>{words.length ? 'Пока недостаточно данных.' : 'Слова ещё не загружены.'}</Text>
      </View>
    </ScrollView>
  );
}

function ChoicePills({ value, items, onChange }) {
  return (
    <View style={styles.choicePills}>
      {items.map(([id,label]) => (
        <Pressable key={id} onPress={() => onChange(id)} style={[styles.choicePill, value === id && styles.choicePillActive]}>
          <Text style={[styles.choicePillText, value === id && styles.choicePillTextActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Settings({ settings, onChange }) {
  const update = (key, value) => onChange(applyUserSettingsUpdate(settings, { [key]: value }));
  return (
    <ScrollView contentContainerStyle={styles.settingsScroll} showsVerticalScrollIndicator={false}>
      <View style={styles.settingsPageHead}><Text style={styles.settingsPageTitle}>Настройки</Text><Button compact primary>Сохранено</Button></View>
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Язык и отображение</Text>
        <SettingRow label="Язык интерфейса"><ChoicePills value={settings.interface_language_code} items={[["ru","RU"],["en","EN"],["tr","TR"]]} onChange={(v) => update('interface_language_code', v)} /></SettingRow>
        <SettingRow label="Письменность"><ChoicePills value={settings.alan_script_code} items={[["cyrillic","Кир."],["turkic","Lat."]]} onChange={(v) => update('alan_script_code', v)} /></SettingRow>
        {settings.alan_script_code === 'cyrillic' ? <SettingRow label="Форма Җ"><ChoicePills value={settings.alan_dialect_code} items={[["canonical","Җ"],["karachay","Дж"],["balkar","Ж"]]} onChange={(v) => update('alan_dialect_code', v)} /></SettingRow> : null}
        <SettingRow label="Размер текста"><ChoicePills value={settings.text_size_code} items={[["small","S"],["medium","M"],["large","L"]]} onChange={(v) => update('text_size_code', v)} /></SettingRow>
      </View>
      <View style={styles.settingsPreview}>
        <Text style={styles.previewLabel}>ПРЕДПРОСМОТР</Text>
        <Text style={[styles.previewWord, settings.text_size_code === 'small' && {fontSize:24}, settings.text_size_code === 'large' && {fontSize:34}]}>тау</Text>
        <Text style={styles.previewTranslation}>гора</Text>
      </View>
      <View style={styles.settingsSection}>
        <Text style={styles.settingsSectionTitle}>Словарь</Text>
        <VersionRow label="Приложение" value="16.1" />
        <VersionRow label="Источник" value="Web 13.15.12" />
      </View>
      <View style={styles.linksSection}>
        {['Политика конфиденциальности','Аналитика','Благодарности','О приложении'].map((label) => <View key={label} style={styles.settingsLink}><Text style={styles.settingsLinkText}>{label}</Text><Text style={styles.settingsLinkEnd}>›</Text></View>)}
      </View>
    </ScrollView>
  );
}

function SettingRow({ label, children }) {
  return <View style={styles.settingsRow}><Text style={styles.settingsRowLabel}>{label}</Text><View style={styles.settingsControl}>{children}</View></View>;
}

function VersionRow({ label, value }) {
  return <View style={styles.versionRow}><Text style={styles.versionLabel}>{label}</Text><Text style={styles.versionValue}>{value}</Text></View>;
}

export function AccountScreen({ onBack }) {
  const [nickname, setNickname] = useState('');
  const check = validateNicknameRule(nickname);
  return (
    <Screen>
      <Header title="Аккаунт" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.accountScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <SectionLabel>ВХОД</SectionLabel>
        <View style={styles.authBlock}>
          <Button primary>Продолжить с Google</Button>
          <Text style={styles.authHint}>Авторизация должна возвращать пользователя непосредственно в приложение через deep link.</Text>
        </View>
        <View style={styles.settingsSection}>
          <Text style={styles.settingsSectionTitle}>Никнейм</Text>
          <TextInput
            value={nickname}
            onChangeText={(value) => setNickname(filterNickname(value))}
            placeholder="alan_01"
            placeholderTextColor={C.text3}
            autoCapitalize="none"
            style={styles.nicknameInput}
          />
          <Text style={[styles.nicknameHint, nickname && !check.valid && {color:C.danger}]}>{nickname && check.valid ? 'Никнейм соответствует требованиям.' : '3–15 символов, латинские буквы, цифры и _.'}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

export function ProfileArea({ words, settings = DEFAULT_USER_SETTINGS, onSettingsChange, onAccount }) {
  const [active, setActive] = useState('profile');
  const route = useMemo(() => buildLearningRoute(words), [words]);
  return (
    <Screen bottomNav>
      <Header title={active === 'statistics' ? 'Статистика' : active === 'settings' ? 'Настройки' : 'Профиль'} />
      <View style={styles.profileBody}>
        <PrimaryTabs active={active} onChange={setActive} />
        {active === 'profile' ? <ProfileHome route={route} onAccount={onAccount} /> : null}
        {active === 'statistics' ? <Statistics words={words} route={route} /> : null}
        {active === 'settings' ? <Settings settings={settings} onChange={onSettingsChange} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileBody:{flex:1,paddingTop:theme.control.header,backgroundColor:C.appBg},
  primaryTabs:{height:30,flexDirection:'row',alignItems:'center',paddingHorizontal:14},
  primaryTab:{flex:1,height:30,alignItems:'center',justifyContent:'center'},
  primaryTabText:{fontSize:10,fontWeight:'750',color:C.text3},
  primaryTabActive:{fontWeight:'900',color:C.text1},
  profileScroll:{paddingHorizontal:16,paddingTop:10,paddingBottom:theme.control.nav+34},
  lockedState:{alignItems:'center',paddingTop:8,paddingBottom:18},
  avatarFrame:{position:'relative',width:218,height:272,borderWidth:1,borderColor:C.lineStrong,borderRadius:2,backgroundColor:'rgba(246,242,233,.35)',alignItems:'center',justifyContent:'flex-end'},
  statusLabel:{position:'absolute',top:8,left:9,fontSize:8,fontWeight:'750',letterSpacing:1.2,color:C.text3},
  avatarFigure:{width:'82%',height:'90%',alignItems:'center',justifyContent:'flex-end',opacity:.72},
  avatarHead:{width:74,height:74,borderRadius:37,backgroundColor:C.text2,marginBottom:4},
  avatarBody:{width:148,height:132,borderTopLeftRadius:74,borderTopRightRadius:74,backgroundColor:C.text2},
  accountCircle:{position:'absolute',right:-12,bottom:14,width:42,height:42,borderRadius:21,borderWidth:1,borderColor:C.line,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center'},
  accountCircleText:{fontSize:25,color:C.text1},
  lockBadge:{position:'absolute',top:'45%',left:'50%',marginLeft:-21,width:42,height:42,borderRadius:21,backgroundColor:'rgba(238,233,223,.82)',alignItems:'center',justifyContent:'center'},
  lockBadgeText:{fontSize:24,color:C.text1},
  lockedTitle:{fontSize:19,fontWeight:'850',color:C.text1,marginTop:15},
  lockedText:{maxWidth:320,fontSize:13,lineHeight:19,color:C.text2,textAlign:'center',marginTop:7},
  loginButton:{minWidth:150,marginTop:12},
  storySection:{width:'100%',marginTop:20},
  sectionTitle:{fontSize:17,fontWeight:'850',color:C.text1,paddingBottom:8,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  storyRow:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:C.lineSoft,gap:7},
  storyHead:{flexDirection:'row',justifyContent:'space-between',gap:12},
  storyName:{fontSize:13,color:C.text1},
  storyPercent:{fontSize:12,fontWeight:'800',color:C.text2},
  futureNote:{paddingVertical:13,fontSize:12,lineHeight:18,color:C.text3,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  statsSection:{marginTop:10},
  statsGrid:{flexDirection:'row',flexWrap:'wrap',borderTopWidth:1,borderTopColor:C.lineSoft},
  statCell:{width:'50%',minHeight:72,paddingVertical:11,paddingHorizontal:2,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  statValue:{fontSize:21,fontWeight:'800',color:C.text1},
  statLabel:{fontSize:11,lineHeight:14,color:C.text2,marginTop:5},
  settingsScroll:{paddingHorizontal:16,paddingTop:8,paddingBottom:theme.control.nav+34},
  settingsPageHead:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12},
  settingsPageTitle:{fontSize:19,fontWeight:'860',color:C.text1},
  settingsSection:{marginTop:20},
  settingsSectionTitle:{fontSize:15,fontWeight:'850',color:C.text1,paddingBottom:7,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  settingsRow:{minHeight:46,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  settingsRowLabel:{flex:1,fontSize:12,lineHeight:15,color:C.text2},
  settingsControl:{minWidth:142,alignItems:'flex-end'},
  choicePills:{flexDirection:'row',padding:2,borderWidth:1,borderColor:C.line,borderRadius:999},
  choicePill:{minWidth:38,minHeight:28,paddingHorizontal:7,borderRadius:999,alignItems:'center',justifyContent:'center'},
  choicePillActive:{backgroundColor:'rgba(246,242,233,.78)'},
  choicePillText:{fontSize:10,fontWeight:'750',color:C.text3},
  choicePillTextActive:{color:C.text1},
  settingsPreview:{height:180,marginTop:14,borderWidth:1,borderColor:C.lineSoft,borderRadius:theme.radius.lg,backgroundColor:'rgba(255,255,255,.13)',alignItems:'center',justifyContent:'center'},
  previewLabel:{fontSize:9,fontWeight:'700',letterSpacing:1,color:C.text3,marginBottom:12},
  previewWord:{fontSize:29,fontWeight:'860',color:C.text1},
  previewTranslation:{fontSize:13,color:C.text2,marginTop:5},
  versionRow:{minHeight:42,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:14,borderBottomWidth:1,borderBottomColor:C.lineSoft},
  versionLabel:{fontSize:12,color:C.text2},
  versionValue:{fontSize:11,fontWeight:'800',color:C.text1},
  linksSection:{borderTopWidth:1,borderTopColor:C.lineSoft,marginTop:20},
  settingsLink:{minHeight:46,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.lineSoft},
  settingsLinkText:{fontSize:13,color:C.text1},
  settingsLinkEnd:{fontSize:19,color:C.text3},
  accountScroll:{paddingTop:theme.control.header+16,paddingHorizontal:16,paddingBottom:32},
  authBlock:{gap:12,marginTop:8},
  authHint:{fontSize:11,lineHeight:16,color:C.text3,textAlign:'center'},
  nicknameInput:{height:44,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.sm,backgroundColor:'rgba(255,255,255,.28)',color:C.text1,paddingHorizontal:14,fontSize:15,marginTop:12},
  nicknameHint:{fontSize:11,lineHeight:16,color:C.text3,marginTop:7},
});
