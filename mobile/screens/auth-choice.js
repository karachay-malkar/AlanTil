import React from 'react';
import {StyleSheet,Text,View} from 'react-native';
import {DEFAULT_USER_SETTINGS} from '../../packages/alantil-core/settings.js';
import {mobileMsg} from '../i18n.js';
import {AuthEntryActions} from '../ui/auth-entry-actions.js';
import {Screen} from '../ui/components.js';
import {Topography} from '../ui/topography.js';
import {useSemanticTypography} from '../ui/runtime-settings.js';
import {theme} from '../ui/theme.js';

const C=theme.colors;
export function AuthChoiceScreen({settings=DEFAULT_USER_SETTINGS,onAuthenticated,onGuest}){
  const type=useSemanticTypography(),language=settings?.interface_language_code||'ru',msg=(key,params)=>mobileMsg(language,key,params);
  return <Screen><Topography opacity={0.22}/><View style={styles.root}><View style={styles.pane}><Text style={[styles.title,type.title]}>{msg('account.akkaunt')}</Text><AuthEntryActions settings={settings} allowGuest onGuest={onGuest} onAuthenticated={onAuthenticated}/></View></View></Screen>;
}

const styles=StyleSheet.create({root:{flex:1,justifyContent:'center',paddingHorizontal:16,paddingVertical:24},pane:{width:'100%',maxWidth:520,alignSelf:'center',gap:18},title:{color:C.text1,textAlign:'center'}});
