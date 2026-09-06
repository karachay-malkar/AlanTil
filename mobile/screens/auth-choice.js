import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { DEFAULT_USER_SETTINGS } from '../../packages/alantil-core/settings.js';
import { setupText } from '../../packages/alantil-core/learning-setup.js';
import { mobileMsg } from '../i18n.js';
import { getNativeAuthError, signInWithGoogleNative, subscribeNativeAuth } from '../platform/auth.js';
import { AuthProviderButton, Button, InlineMessage, Screen } from '../ui/components.js';
import { Topography } from '../ui/topography.js';
import { useSemanticTypography } from '../ui/runtime-settings.js';
import { theme } from '../ui/theme.js';

const C=theme.colors;
function GoogleMark(){return <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true"><Path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.22-.2-1.75H12v3.41h5.52a4.71 4.71 0 0 1-2.05 3.09l-.02.11 2.98 2.31.21.02c1.93-1.78 2.96-4.4 2.96-7.19Z"/><Path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.64-2.58l-3.17-2.44c-.85.57-1.98.97-3.47.97-2.6 0-4.81-1.76-5.6-4.19l-.1.01-3.1 2.4-.04.1A10 10 0 0 0 12 22Z"/><Path fill="#FBBC05" d="M6.4 13.76A6 6 0 0 1 6.08 12c0-.61.11-1.2.31-1.76v-.12L3.26 7.68l-.1.05A10 10 0 0 0 2 12c0 1.53.35 2.98 1.16 4.27l3.24-2.51Z"/><Path fill="#EA4335" d="M12 6.05c1.89 0 3.17.82 3.9 1.5l2.8-2.73C16.97 3.2 14.7 2 12 2a10 10 0 0 0-8.84 5.73l3.23 2.51C7.19 7.81 9.4 6.05 12 6.05Z"/></Svg>}

export function AuthChoiceScreen({settings=DEFAULT_USER_SETTINGS,onAuthenticated,onGuest}){
  const type=useSemanticTypography(),language=settings?.interface_language_code||'ru',msg=(key,params)=>mobileMsg(language,key,params),authCopy=setupText(language);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{const unsubscribe=subscribeNativeAuth((session,authError)=>{if(authError)setError(authError?.message||msg('account.ne_udalos_podklyuchitsya_k_google'));if(session?.user){setBusy(false);setError('');onAuthenticated?.(session);}});const initialError=getNativeAuthError();if(initialError)setError(initialError?.message||msg('account.ne_udalos_podklyuchitsya_k_google'));return unsubscribe;},[]);
  const signIn=async()=>{if(busy)return;setBusy(true);setError('');try{const session=await signInWithGoogleNative();if(!session?.user)setBusy(false);}catch(authError){setBusy(false);setError(authError?.message||msg('account.ne_udalos_podklyuchitsya_k_google'));}};
  return <Screen><Topography opacity={0.22}/><View style={styles.root}><View style={styles.pane}><Text style={[styles.title,type.title]}>{msg('account.akkaunt')}</Text>{error?<InlineMessage type="error">{error}</InlineMessage>:null}<View style={styles.actions}><AuthProviderButton label={authCopy.continueGoogle} icon={<GoogleMark/>} onPress={signIn} loading={busy} disabled={busy}/><Button role="auth.continueGuest" style={styles.guestButton} onPress={onGuest} disabled={busy}>{msg('account.prodolzhit_kak_gost')}</Button></View></View></View></Screen>;
}

const styles=StyleSheet.create({root:{flex:1,justifyContent:'center',paddingHorizontal:16,paddingVertical:24},pane:{width:'100%',maxWidth:520,alignSelf:'center',gap:18},title:{color:C.text1,textAlign:'center'},actions:{gap:10},guestButton:{width:'100%'}});
