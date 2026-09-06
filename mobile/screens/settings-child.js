import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Header, Screen } from '../ui/components.js';
import { Checkbox } from '../ui/checkbox.js';
import { msg } from '../i18n.js';
import { useSemanticTypography } from '../ui/runtime-settings.js';
import { theme } from '../ui/theme.js';
import { loadNativeAnalyticsPreference, saveNativeAnalyticsPreference } from '../platform/privacy.js';

const C=theme.colors;
function Document({children}){return <ScrollView contentContainerStyle={styles.document} showsVerticalScrollIndicator={false}>{children}</ScrollView>;}
function H2({children}){return <Text style={styles.h2}>{children}</Text>;}
function P({children}){return <Text style={styles.p}>{children}</Text>;}
function Thanks({settings,type}){return <Document><Text style={[styles.h1,type.title]}>{msg(settings,'about.blagodarstvennoe_slovo')}</Text><P type={type}>{msg(settings,'about.zdes_budet_razmeschena_blagodarnost_lyudyam_kotorye_pomoga')}</P></Document>;}
function Version({settings,type}){return <Document><View style={styles.fact}><Text style={[styles.factLabel,type.body]}>{msg(settings,'about.versiya')}</Text><Text style={[styles.factValue,type.caption]}>16.6.6</Text></View><View style={styles.fact}><Text style={[styles.factLabel,type.body]}>{msg(settings,'about.poslednee_obnovlenie')}</Text><Text style={[styles.factValue,type.caption]}>06.09.2026</Text></View></Document>;}
function Privacy({settings,type}){
  const [enabled,setEnabled]=useState(false),[loaded,setLoaded]=useState(false),[saved,setSaved]=useState(false);
  useEffect(()=>{let alive=true;loadNativeAnalyticsPreference().then((value)=>{if(alive){setEnabled(value===true);setLoaded(true);}});return()=>{alive=false;};},[]);
  const save=async()=>{await saveNativeAnalyticsPreference(enabled);setSaved(true);};
  const h=(children)=><H2>{children}</H2>,p=(children)=><P>{children}</P>;
  return <Document>
    {p(<><Text style={styles.strong}>{msg(settings,'privacy.alantil_alan_til')} </Text>{msg(settings,'privacy.prilozhenie_dlya_izucheniya_karachaevo_balkarskogo_yazyka_')} alantil0709@gmail.com.</>)}
    {h(msg(settings,'privacy.kakie_dannye_sohranyayutsya_na_ustroystve'))}
    {p(msg(settings,'privacy.prilozhenie_mozhet_lokalno_sohranyat_v_brauzere_izbrannye'))}
    {p(msg(settings,'privacy.dlya_vybora_primenimogo_rezhima_statistiki_prilozhenie_moz'))}
    {h(msg(settings,'privacy.akkaunt_i_avtorizatsiya'))}
    {p(msg(settings,'privacy.registratsiya_neobyazatelna_pri_vhode_cherez_google_parol'))}
    {p(msg(settings,'privacy.supabase_auth_hranit_tehnicheskiy_identifikator_akkaunta_e'))}
    {p(msg(settings,'privacy.elektronnaya_pochta_otobrazhaetsya_tolko_samomu_vladeltsu_'))}
    {h(msg(settings,'privacy.oblachnyy_progress'))}
    {p(msg(settings,'privacy.dlya_avtorizovannogo_polzovatelya_supabase_mozhet_hranit_i'))}
    {p(msg(settings,'privacy.v_oblachnyy_progress_peredayutsya_tehnicheskie_id_slov'))}
    {h(msg(settings,'privacy.visit_activity_title'))}
    {p(msg(settings,'privacy.visit_activity_text'))}
    {h(msg(settings,'privacy.kakie_dannye_peredayutsya_v_google_analytics'))}
    {p(msg(settings,'privacy.pri_vklyuchennoy_statistike_mogut_peredavatsya_prosmotry_r'))}
    {h(msg(settings,'privacy.kakie_dannye_ne_peredayutsya_v_google_analytics'))}
    {p(msg(settings,'privacy.prilozhenie_ne_peredaet_v_google_analytics_nikneym'))}
    {h(msg(settings,'privacy.zachem_ispolzuetsya_analitika'))}
    {p(msg(settings,'privacy.analitika_pomogaet_ponimat_kak_primenyayutsya_razdely_pril'))}
    {h(msg(settings,'privacy.udalenie_dannyh'))}
    {p(msg(settings,'privacy.lokalnye_dannye_mozhno_udalit_cherez_ochistku_dannyh'))}
    <View style={styles.analytics}>
      {h(msg(settings,'privacy.statistika_ispolzovaniya'))}
      {p(msg(settings,'privacy.statistika_ispolzovaniya_pomogaet_nam_uluchshat_prilozheni'))}
      {p(msg(settings,'privacy.google_analytics_choice_note'))}
      <View style={styles.switchRow}><Text style={[styles.switchLabel,type.body]}>{msg(settings,'privacy.razreshit_statistiku_ispolzovaniya')}</Text><Checkbox size={20} disabled={!loaded} checked={enabled} accessibilityLabel={msg(settings,'privacy.razreshit_statistiku_ispolzovaniya')} onPress={()=>{setSaved(false);setEnabled((value)=>!value);}}/></View>
      <Button role="privacy.save" onPress={save}>{saved?msg(settings,'privacy.nastroyki_statistiki_sohraneny'):msg(settings,'privacy.sohranit_nastroyki')}</Button>
    </View>
    <Text style={styles.documentDate}>{msg(settings,'privacy.revision_august_2026')}</Text>
  </Document>;
}
export function SettingsChildScreen({screen,settings,onBack}){const type=useSemanticTypography(),title=screen==='thanks'?msg(settings,'about.blagodarnosti'):screen==='version'?msg(settings,'about.versiya_prilozheniya'):msg(settings,'privacy.konfidentsialnost');return <Screen><Header title={title} onBack={onBack}/>{screen==='thanks'?<Thanks settings={settings} type={type}/>:screen==='version'?<Version settings={settings} type={type}/>:<Privacy settings={settings} type={type}/>}</Screen>;}
const styles=StyleSheet.create({document:{width:'100%',maxWidth:620,alignSelf:'center',paddingTop:theme.control.header+theme.chrome.contentRestGap,paddingHorizontal:12,paddingBottom:30},h1:{color:C.text1,marginBottom:4},h2:{marginTop:22,marginBottom:9,color:C.text1,fontSize:16,lineHeight:19,fontWeight:'800'},p:{marginTop:10,color:C.text2,fontSize:14,lineHeight:23},strong:{fontWeight:'800',color:C.text1},documentDate:{marginTop:10,marginBottom:18,color:C.text3,fontFamily:theme.font.terminal,fontSize:11,lineHeight:14,fontWeight:'700'},fact:{minHeight:46,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.lineSoft},factLabel:{color:C.text2},factValue:{fontFamily:theme.font.terminal,fontWeight:'700',color:C.text1},analytics:{marginTop:20,paddingTop:12,paddingHorizontal:2,borderTopWidth:1,borderTopColor:C.lineSoft},switchRow:{minHeight:46,marginTop:12,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderBottomColor:C.lineSoft},switchLabel:{flex:1,color:C.text1,fontSize:14,lineHeight:23}});
