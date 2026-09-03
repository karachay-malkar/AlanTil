import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Button, Header, Screen } from '../ui/components.js';
import { msg } from '../i18n.js';
import { theme } from '../ui/theme.js';
import { loadNativeAnalyticsPreference, saveNativeAnalyticsPreference } from '../platform/privacy.js';

const C=theme.colors;

function Document({children}){return <ScrollView contentContainerStyle={styles.document} showsVerticalScrollIndicator={false}>{children}</ScrollView>;}
function H2({children}){return <Text style={styles.h2}>{children}</Text>;}
function P({children}){return <Text style={styles.p}>{children}</Text>;}

function Thanks({settings}){return <Document><Text style={styles.h1}>{msg(settings,'about.blagodarstvennoe_slovo')}</Text><P>{msg(settings,'about.zdes_budet_razmeschena_blagodarnost_lyudyam_kotorye_pomoga')}</P></Document>;}
function Version({settings}){return <Document><View style={styles.fact}><Text style={styles.factLabel}>{msg(settings,'about.versiya')}</Text><Text style={styles.factValue}>16.6.1</Text></View><View style={styles.fact}><Text style={styles.factLabel}>{msg(settings,'about.poslednee_obnovlenie')}</Text><Text style={styles.factValue}>03.09.2026</Text></View></Document>;}
function Privacy({settings}){
  const [enabled,setEnabled]=useState(false),[loaded,setLoaded]=useState(false),[saved,setSaved]=useState(false);
  useEffect(()=>{let alive=true;loadNativeAnalyticsPreference().then((value)=>{if(alive){setEnabled(value===true);setLoaded(true);}});return()=>{alive=false;};},[]);
  const save=async()=>{await saveNativeAnalyticsPreference(enabled);setSaved(true);};
  return <Document><P><Text style={styles.strong}>{msg(settings,'privacy.alantil_alan_til')} </Text>{msg(settings,'privacy.prilozhenie_dlya_izucheniya_karachaevo_balkarskogo_yazyka_')} alantil0709@gmail.com.</P><H2>{msg(settings,'privacy.kakie_dannye_sohranyayutsya_na_ustroystve')}</H2><P>{msg(settings,'privacy.prilozhenie_mozhet_lokalno_sohranyat_v_brauzere_izbrannye')}</P><H2>{msg(settings,'privacy.akkaunt_i_avtorizatsiya')}</H2><P>{msg(settings,'privacy.registratsiya_neobyazatelna_pri_vhode_cherez_google_parol')}</P><H2>{msg(settings,'privacy.oblachnyy_progress')}</H2><P>{msg(settings,'privacy.dlya_avtorizovannogo_polzovatelya_supabase_mozhet_hranit_i')}</P><H2>{msg(settings,'privacy.visit_activity_title')}</H2><P>{msg(settings,'privacy.visit_activity_text')}</P><H2>{msg(settings,'privacy.kakie_dannye_peredayutsya_v_google_analytics')}</H2><P>{msg(settings,'privacy.pri_vklyuchennoy_statistike_mogut_peredavatsya_prosmotry_r')}</P><H2>{msg(settings,'privacy.kakie_dannye_ne_peredayutsya_v_google_analytics')}</H2><P>{msg(settings,'privacy.prilozhenie_ne_peredaet_v_google_analytics_nikneym')}</P><H2>{msg(settings,'privacy.zachem_ispolzuetsya_analitika')}</H2><P>{msg(settings,'privacy.analitika_pomogaet_ponimat_kak_primenyayutsya_razdely_pril')}</P><H2>{msg(settings,'privacy.udalenie_dannyh')}</H2><P>{msg(settings,'privacy.lokalnye_dannye_mozhno_udalit_cherez_ochistku_dannyh')}</P><View style={styles.analytics}><H2>{msg(settings,'privacy.statistika_ispolzovaniya')}</H2><P>{msg(settings,'privacy.statistika_ispolzovaniya_pomogaet_nam_uluchshat_prilozheni')}</P><View style={styles.switchRow}><Text style={styles.switchLabel}>{msg(settings,'privacy.razreshit_statistiku_ispolzovaniya')}</Text><Switch disabled={!loaded} value={enabled} onValueChange={(value)=>{setSaved(false);setEnabled(value);}} /></View><Button primary onPress={save}>{saved?msg(settings,'privacy.nastroyki_statistiki_sohraneny'):msg(settings,'privacy.sohranit_nastroyki')}</Button></View><P>{msg(settings,'privacy.revision_august_2026')}</P></Document>;
}

export function SettingsChildScreen({screen,settings,onBack}){
  const title=screen==='thanks'?msg(settings,'about.blagodarnosti'):screen==='version'?msg(settings,'about.versiya_prilozheniya'):msg(settings,'privacy.konfidentsialnost');
  return <Screen><Header title={title} onBack={onBack}/>{screen==='thanks'?<Thanks settings={settings}/>:screen==='version'?<Version settings={settings}/>:<Privacy settings={settings}/>}</Screen>;
}

const styles=StyleSheet.create({document:{paddingTop:theme.control.header+18,paddingHorizontal:16,paddingBottom:30,gap:12},h1:{fontSize:22,fontWeight:'850',lineHeight:27,color:C.text1,marginBottom:4},h2:{fontSize:15,fontWeight:'850',lineHeight:20,color:C.text1,marginTop:8},p:{fontSize:13,lineHeight:19,color:C.text2},strong:{fontWeight:'800',color:C.text1},fact:{minHeight:48,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:C.lineSoft},factLabel:{fontSize:13,color:C.text2},factValue:{fontFamily:theme.font.terminal,fontSize:12,fontWeight:'700',color:C.text1},analytics:{gap:10,marginTop:8,paddingTop:8,borderTopWidth:1,borderTopColor:C.lineSoft},switchRow:{minHeight:48,flexDirection:'row',alignItems:'center',gap:12},switchLabel:{flex:1,fontSize:13,lineHeight:18,color:C.text1}});
