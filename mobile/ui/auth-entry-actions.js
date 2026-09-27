import React,{useState} from 'react';
import {StyleSheet,View} from 'react-native';
import {DEFAULT_USER_SETTINGS} from '../../packages/alantil-core/settings.js';
import {setupText} from '../../packages/alantil-core/learning-setup.js';
import {mobileMsg} from '../i18n.js';
import {
  sendPasswordResetNative,
  signInWithEmailNative,
  signInWithLegacyGoogleNative,
  signUpWithEmailNative,
  updateNativePassword,
} from '../platform/auth.js';
import {Button,FormField,InlineMessage,TextAction} from './components.js';

const MIN_PASSWORD_LENGTH=6;
const MODES=new Set(['signin','signup','forgot']);
function normalizeMode(value){const mode=String(value||'').trim();return MODES.has(mode)?mode:'signin';}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value||'').trim());}

export function AuthEntryActions({settings=DEFAULT_USER_SETTINGS,allowGuest=false,onGuest,onAuthenticated,guestPresentation='button',disabled=false,style}){
  const language=settings?.interface_language_code||'ru',copy=setupText(language),t=(key)=>mobileMsg(language,key);
  const [mode,setMode]=useState('signin'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
  const blocked=disabled||Boolean(busy);
  const fail=(value)=>setError(value?.message||String(value||t('account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe')));
  const submit=async()=>{if(blocked)return;const current=normalizeMode(mode);setError('');setMessage('');if(!validEmail(email)){setError(t('service.vvedite_elektronnuyu_pochtu'));return;}if(current!=='forgot'&&password.length<MIN_PASSWORD_LENGTH){setError(t('account.parol_min_6'));return;}if(current==='signup'&&password!==confirm){setError(t('account.paroli_ne_sovpadayut'));return;}setBusy(current);try{if(current==='signin'){const session=await signInWithEmailNative(email,password);if(session?.user)onAuthenticated?.(session);return;}if(current==='signup'){const data=await signUpWithEmailNative(email,password);if(data?.session?.user)onAuthenticated?.(data.session);else setMessage(t('account.proverte_pochtu_dlya_podtverzhdeniya'));return;}await sendPasswordResetNative(email);setMessage(t('account.ssylka_dlya_smeny_parolya_otpravlena'));}catch(nextError){fail(nextError);}finally{setBusy('');}};
  const legacy=async()=>{if(blocked)return;setError('');setMessage('');setBusy('legacy');try{const session=await signInWithLegacyGoogleNative();if(session?.user)onAuthenticated?.(session);}catch(nextError){fail(nextError);}finally{setBusy('');}};
  const switchMode=(next)=>{setMode(normalizeMode(next));setPassword('');setConfirm('');setError('');setMessage('');};
  const guest=allowGuest&&onGuest?(guestPresentation==='text'?<TextAction onPress={onGuest} disabled={blocked}>{copy.guest}</TextAction>:<Button role="auth.continueGuest" onPress={onGuest} disabled={blocked}>{copy.guest}</Button>):null;
  return <View style={[styles.root,style]}>
    {error?<InlineMessage type="error">{error}</InlineMessage>:null}
    {message?<InlineMessage type="success">{message}</InlineMessage>:null}
    <FormField label={t('account.email')} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress"/>
    {mode!=='forgot'?<FormField label={t('account.parol')} value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry autoComplete={mode==='signup'?'new-password':'current-password'} textContentType={mode==='signup'?'newPassword':'password'}/>:null}
    {mode==='signup'?<FormField label={t('account.povtorite_parol')} value={confirm} onChangeText={setConfirm} autoCapitalize="none" secureTextEntry autoComplete="new-password" textContentType="newPassword"/>:null}
    <Button role="generic.primary" onPress={submit} disabled={blocked}>{mode==='signup'?t('account.sozdat_akkaunt'):mode==='forgot'?t('account.otpravit_ssylku'):t('account.voyti')}</Button>
    {mode==='signin'?<View style={styles.links}><TextAction onPress={()=>switchMode('signup')} disabled={blocked}>{t('account.sozdat_akkaunt')}</TextAction><TextAction onPress={()=>switchMode('forgot')} disabled={blocked}>{t('account.zabyli_parol')}</TextAction></View>:<TextAction onPress={()=>switchMode('signin')} disabled={blocked}>{mode==='signup'?t('account.uzhe_est_akkaunt_voyti'):t('account.nazad_ko_vhodu')}</TextAction>}
    <InlineMessage>{t('account.legacy_google_note')}</InlineMessage>
    <TextAction onPress={legacy} disabled={blocked}>{t('account.ranshe_vhodili_cherez_google')}</TextAction>
    {guest}
  </View>;
}

export function PasswordSetupActions({settings=DEFAULT_USER_SETTINGS,flow='recovery',disabled=false,onUpdated,onSignOut,style}){
  const language=settings?.interface_language_code||'ru',t=(key)=>mobileMsg(language,key),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async()=>{if(disabled||busy)return;setError('');if(password.length<MIN_PASSWORD_LENGTH){setError(t('account.parol_min_6'));return;}if(password!==confirm){setError(t('account.paroli_ne_sovpadayut'));return;}setBusy(true);try{await updateNativePassword(password);onUpdated?.();}catch(nextError){setError(nextError?.message||t('account.ne_udalos_vypolnit_operatsiyu_povtorite_pozzhe'));}finally{setBusy(false);}};
  return <View style={[styles.root,style]}>
    <InlineMessage>{t(flow==='legacy_google'?'account.legacy_google_password_note':'account.recovery_password_note')}</InlineMessage>
    {error?<InlineMessage type="error">{error}</InlineMessage>:null}
    <FormField label={t('account.novyy_parol')} value={password} onChangeText={setPassword} autoCapitalize="none" secureTextEntry autoComplete="new-password" textContentType="newPassword"/>
    <FormField label={t('account.povtorite_parol')} value={confirm} onChangeText={setConfirm} autoCapitalize="none" secureTextEntry autoComplete="new-password" textContentType="newPassword"/>
    <Button role="generic.primary" onPress={save} disabled={disabled||busy}>{t('account.sohranit_parol')}</Button>
    {onSignOut?<TextAction onPress={onSignOut} disabled={disabled||busy}>{t('account.vyyti')}</TextAction>:null}
  </View>;
}

const styles=StyleSheet.create({root:{gap:10},links:{gap:2}});
