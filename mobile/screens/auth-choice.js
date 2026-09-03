import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DEFAULT_USER_SETTINGS } from '../../packages/alantil-core/settings.js';
import { mobileMsg } from '../i18n.js';
import { getNativeAuthError, signInWithGoogleNative, subscribeNativeAuth } from '../platform/auth.js';
import { AuthProviderButton, Button, InlineMessage, Screen } from '../ui/components.js';
import { Topography } from '../ui/topography.js';
import { useSemanticTypography } from '../ui/runtime-settings.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;

export function AuthChoiceScreen({settings=DEFAULT_USER_SETTINGS,onAuthenticated,onGuest}){
  const type=useSemanticTypography(),language=settings?.interface_language_code||'ru',msg=(key,params)=>mobileMsg(language,key,params);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const unsubscribe=subscribeNativeAuth((session,authError)=>{if(authError)setError(authError?.message||msg('account.ne_udalos_podklyuchitsya_k_google'));if(session?.user){setBusy(false);setError('');onAuthenticated?.(session);}});const initialError=getNativeAuthError();if(initialError)setError(initialError?.message||msg('account.ne_udalos_podklyuchitsya_k_google'));return unsubscribe;},[]);
  const signIn=async()=>{if(busy)return;setBusy(true);setError('');try{await signInWithGoogleNative();}catch(authError){setBusy(false);setError(authError?.message||msg('account.ne_udalos_podklyuchitsya_k_google'));}};
  return <Screen><Topography opacity={0.22}/><View style={styles.root}><View style={styles.pane}><Text style={[styles.title,type.title]}>{msg('account.akkaunt')}</Text>{error?<InlineMessage type="error">{error}</InlineMessage>:null}<View style={styles.actions}><AuthProviderButton label={msg('account.voyti_cherez_google')} onPress={signIn} loading={busy} disabled={busy}/><Button action style={styles.guestButton} onPress={onGuest} disabled={busy}>{msg('account.prodolzhit_kak_gost')}</Button></View></View></View></Screen>;
}

const styles=StyleSheet.create({root:{flex:1,justifyContent:'center',paddingHorizontal:16,paddingVertical:24},pane:{width:'100%',maxWidth:520,alignSelf:'center',gap:18},title:{color:C.text1,textAlign:'center'},actions:{gap:10},guestButton:{width:'100%'}});
