import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { completeLearningSetupSettings, emptyLearningSetupDraft, isLearningSetupDraftComplete } from '../../packages/alantil-core/settings.js';
import { LEARNING_SETUP_LANGUAGES, previewContent, setupText } from '../../packages/alantil-core/learning-setup.js';
import { Button, InlineMessage, Screen } from '../ui/components.js';
import { CompactSegmentedControl } from '../ui/parity.js';
import { Topography } from '../ui/topography.js';
import { useSemanticTypography } from '../ui/runtime-settings.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;
function capitalizeWord(value){const text=String(value||'');return text?`${text[0].toUpperCase()}${text.slice(1)}`:'';}

export function OnboardingScreen({initialSettings,onComplete}){
  const type=useSemanticTypography();
  const [draft,setDraft]=useState(()=>emptyLearningSetupDraft()),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const language=draft.interface_language_code||initialSettings?.interface_language_code||'ru';
  const copy=setupText(language),preview=useMemo(()=>previewContent(draft),[draft]),complete=isLearningSetupDraftComplete(draft);
  const updateDraft=(updates)=>{setDraft((current)=>({...current,...updates}));setError('');};
  const languageOptions=LEARNING_SETUP_LANGUAGES.map((item)=>[item.code,item.label]);
  const scriptOptions=[['cyrillic',copy.cyrillic],['turkic','Latin']];
  const dialectOptions=[['canonical','Җ'],['karachay','Дж'],['balkar','Ж']];
  const persist=async()=>{if(!complete||busy)return;setBusy(true);setError('');const next=completeLearningSetupSettings(initialSettings,{...draft,translation_language_code:draft.interface_language_code,alan_dialect_code:draft.alan_script_code==='turkic'?(draft.alan_dialect_code||'canonical'):draft.alan_dialect_code});try{await onComplete?.(next);}catch{setError(copy.storageError);}finally{setBusy(false);}};
  return <Screen><Topography opacity={0.22}/><ScrollView contentContainerStyle={styles.root} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"><View style={styles.pane}>{error?<InlineMessage type="error">{error}</InlineMessage>:null}<View style={styles.section}><Text style={[styles.title,type.title]}>Язык · Language · Dil</Text><CompactSegmentedControl value={draft.interface_language_code} items={languageOptions} onChange={(value)=>updateDraft({interface_language_code:value,translation_language_code:value})}/></View>{draft.interface_language_code?<View style={styles.section}><Text style={[styles.sectionTitle,type.caption]}>{copy.script}</Text><CompactSegmentedControl value={draft.alan_script_code} items={scriptOptions} onChange={(value)=>updateDraft({alan_script_code:value,alan_dialect_code:value==='turkic'?'canonical':''})}/></View>:null}{draft.alan_script_code==='cyrillic'?<View style={styles.section}><Text style={[styles.sectionTitle,type.caption]}>{copy.dialect}</Text><CompactSegmentedControl value={draft.alan_dialect_code} items={dialectOptions} onChange={(value)=>updateDraft({alan_dialect_code:value})}/></View>:null}<View style={styles.previewCard}><Text style={[styles.previewWord,type.wordCard]}>{capitalizeWord(preview.word)}</Text><View style={styles.previewCopy}><Text style={[styles.previewTranslation,type.emphasis]}>{preview.translation}</Text><Text style={[styles.previewExample,type.caption]}>{preview.example} <Text style={styles.previewStar}>✦</Text> {preview.exampleTranslation}</Text></View></View><Button primary action style={styles.fullButton} disabled={!complete||busy} loading={busy} onPress={persist}>{copy.continue}</Button></View></ScrollView></Screen>;
}

const styles=StyleSheet.create({root:{flexGrow:1,minHeight:'100%',paddingHorizontal:14,paddingVertical:24,justifyContent:'center'},pane:{width:'100%',maxWidth:560,alignSelf:'center',gap:18},section:{gap:10},title:{color:C.text1,textAlign:'center'},sectionTitle:{fontWeight:'800',color:C.text2,textAlign:'center'},previewCard:{minHeight:220,alignItems:'center',justifyContent:'center',paddingHorizontal:24,paddingVertical:24,gap:12,borderWidth:1,borderColor:C.lineSoft,backgroundColor:C.paperSoft},previewWord:{color:C.text1,textAlign:'center'},previewCopy:{width:'92%',alignItems:'center',gap:6,paddingTop:10,borderTopWidth:1,borderTopColor:C.lineSoft},previewTranslation:{color:C.text2,textAlign:'center'},previewExample:{marginTop:2,color:C.text2,textAlign:'center'},previewStar:{color:C.accentStrong},fullButton:{width:'100%'}});
