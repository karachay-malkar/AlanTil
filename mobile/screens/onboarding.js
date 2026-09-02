import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { completeLearningSetupSettings, DEFAULT_USER_SETTINGS } from '../../packages/alantil-core/settings.js';
import { Button } from '../ui/components.js';
import { theme } from '../ui/theme.js';

const C = theme.colors;

function Segment({ value, options, onChange }) {
  return <View style={styles.segment}>{options.map(([id,label]) => <Pressable key={id} onPress={() => onChange(id)} style={[styles.segmentItem,value===id&&styles.segmentActive]}><Text style={[styles.segmentText,value===id&&styles.segmentTextActive]}>{label}</Text></Pressable>)}</View>;
}

export function OnboardingScreen({ initialSettings = DEFAULT_USER_SETTINGS, onComplete, onLogin }) {
  const [language, setLanguage] = useState(initialSettings.interface_language_code || 'ru');
  const [script, setScript] = useState(initialSettings.alan_script_code || 'cyrillic');
  const [dialect, setDialect] = useState(initialSettings.alan_dialect_code || 'canonical');
  const [stage, setStage] = useState('setup');
  const preview = useMemo(() => script === 'turkic' ? 'Alan til' : dialect === 'karachay' ? 'Джашау' : dialect === 'balkar' ? 'Жашау' : 'Җашау', [script,dialect]);

  const continueSetup = () => {
    const settings = completeLearningSetupSettings(initialSettings,{interface_language_code:language,alan_script_code:script,alan_dialect_code:script==='turkic'?'canonical':dialect});
    setStage('access');
    onComplete?.(settings,false);
  };

  if (stage === 'access') {
    return <View style={styles.root}><View style={styles.accessPane}><Text style={styles.brand}>Alan Til</Text><Text style={styles.accessTitle}>Как продолжить?</Text><Text style={styles.accessText}>Аккаунт синхронизирует прогресс между устройствами. Гостевой режим хранит данные на этом устройстве.</Text><Button primary style={styles.fullButton} onPress={onLogin}>Войти в аккаунт</Button><Button style={styles.fullButton} onPress={() => onComplete?.(null,true)}>Продолжить как гость</Button></View></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false}>
      <View style={styles.pane}>
        <View style={styles.step}><Text style={styles.stepTitle}>Язык интерфейса</Text><Segment value={language} options={[["ru","Русский"],["en","English"],["tr","Türkçe"]]} onChange={setLanguage} /></View>
        <View style={styles.step}><Text style={styles.stepTitle}>Письменность</Text><Segment value={script} options={[["cyrillic","Кириллица"],["turkic","Türk latın"]]} onChange={setScript} /></View>
        {script === 'cyrillic' ? <View style={styles.step}><Text style={styles.stepTitle}>Форма буквы Җ</Text><Segment value={dialect} options={[["canonical","Җ"],["karachay","Дж"],["balkar","Ж"]]} onChange={setDialect} /></View> : null}
        <View style={styles.previewCard}><View style={styles.previewInset}/><Text style={styles.previewKicker}>ПРЕДПРОСМОТР</Text><Text style={styles.previewWord}>{preview}</Text><Text style={styles.previewTrans}>аланский язык</Text></View>
        <Button primary style={styles.fullButton} onPress={continueSetup}>Продолжить</Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root:{flexGrow:1,minHeight:'100%',backgroundColor:C.appBg,paddingHorizontal:14,paddingVertical:24,justifyContent:'center'},
  pane:{width:'100%',maxWidth:560,alignSelf:'center',gap:14},
  step:{gap:7},stepTitle:{fontSize:13,fontWeight:'800',lineHeight:16,color:C.text2},
  segment:{width:'100%',minHeight:38,padding:2,borderWidth:1,borderColor:C.line,borderRadius:999,flexDirection:'row'},
  segmentItem:{flex:1,minHeight:32,borderRadius:999,alignItems:'center',justifyContent:'center',paddingHorizontal:5},segmentActive:{backgroundColor:'rgba(246,242,233,.84)'},
  segmentText:{fontSize:10,fontWeight:'700',color:C.text3},segmentTextActive:{color:C.text1},
  previewCard:{width:'100%',height:240,borderWidth:1,borderColor:C.line,borderRadius:theme.radius.lg,backgroundColor:C.surface0,alignItems:'center',justifyContent:'center',position:'relative',overflow:'hidden'},
  previewInset:{position:'absolute',top:10,left:10,right:10,bottom:10,borderWidth:1,borderColor:C.lineSoft,borderRadius:theme.radius.lg-7},previewKicker:{fontSize:9,fontWeight:'700',letterSpacing:1,color:C.text3,marginBottom:14},previewWord:{fontSize:38,fontWeight:'900',color:C.text1},previewTrans:{fontSize:13,color:C.text2,marginTop:7},
  fullButton:{width:'100%'},
  accessPane:{width:'100%',maxWidth:440,alignSelf:'center',gap:12,alignItems:'stretch'},brand:{fontSize:32,fontWeight:'900',color:C.text1,textAlign:'center',marginBottom:16},accessTitle:{fontSize:20,fontWeight:'800',color:C.text1,textAlign:'center'},accessText:{fontSize:13,lineHeight:19,color:C.text2,textAlign:'center',marginBottom:12},
});
