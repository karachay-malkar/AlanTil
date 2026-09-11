import React,{useState} from 'react';
import {StyleSheet,View} from 'react-native';
import Svg,{Path} from 'react-native-svg';
import {DEFAULT_USER_SETTINGS} from '../../packages/alantil-core/settings.js';
import {setupText} from '../../packages/alantil-core/learning-setup.js';
import {mobileMsg} from '../i18n.js';
import {getNativeAuthError,signInWithGoogleNative} from '../platform/auth.js';
import {AuthProviderButton,Button,InlineMessage,TextAction} from './components.js';

function GoogleMark(){return <Svg width={20} height={20} viewBox="0 0 24 24" aria-hidden="true"><Path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.22-.2-1.75H12v3.41h5.52a4.71 4.71 0 0 1-2.05 3.09l-.02.11 2.98 2.31.21.02c1.93-1.78 2.96-4.4 2.96-7.19Z"/><Path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.64-2.58l-3.17-2.44c-.85.57-1.98.97-3.47.97-2.6 0-4.81-1.76-5.6-4.19l-.1.01-3.1 2.4-.04.1A10 10 0 0 0 12 22Z"/><Path fill="#FBBC05" d="M6.4 13.76A6 6 0 0 1 6.08 12c0-.61.11-1.2.31-1.76v-.12L3.26 7.68l-.1.05A10 10 0 0 0 2 12c0 1.53.35 2.98 1.16 4.27l3.24-2.51Z"/><Path fill="#EA4335" d="M12 6.05c1.89 0 3.17.82 3.9 1.5l2.8-2.73C16.97 3.2 14.7 2 12 2a10 10 0 0 0-8.84 5.73l3.23 2.51C7.19 7.81 9.4 6.05 12 6.05Z"/></Svg>}

const AUTH_PROVIDERS=Object.freeze([
  Object.freeze({key:'google',label:(copy)=>copy.continueGoogle,icon:()=> <GoogleMark/>,signIn:signInWithGoogleNative}),
]);

export function AuthEntryActions({settings=DEFAULT_USER_SETTINGS,allowGuest=false,onGuest,onAuthenticated,guestPresentation='button',disabled=false,style}){
  const language=settings?.interface_language_code||'ru',copy=setupText(language),authFailure=mobileMsg(language,'account.ne_udalos_podklyuchitsya_k_google'),[busy,setBusy]=useState(''),[error,setError]=useState('');
  const startProvider=async(provider)=>{if(disabled||busy)return;setBusy(provider.key);setError('');try{const session=await provider.signIn();if(session?.user)onAuthenticated?.(session);else{const authError=getNativeAuthError();if(authError)setError(authError?.message||authFailure);}}catch(authError){setError(authError?.message||authFailure);}finally{setBusy('');}};
  const guest=allowGuest&&onGuest?(guestPresentation==='text'?<TextAction onPress={onGuest} disabled={disabled||Boolean(busy)}>{copy.guest}</TextAction>:<Button role="auth.continueGuest" onPress={onGuest} disabled={disabled||Boolean(busy)}>{copy.guest}</Button>):null;
  return <View style={[styles.root,style]}>{error?<InlineMessage type="error">{error}</InlineMessage>:null}{AUTH_PROVIDERS.map(provider=><AuthProviderButton key={provider.key} label={provider.label(copy)} icon={provider.icon()} onPress={()=>startProvider(provider)} loading={busy===provider.key} disabled={disabled||Boolean(busy)}/>) }{guest}</View>;
}

const styles=StyleSheet.create({root:{gap:10}});
