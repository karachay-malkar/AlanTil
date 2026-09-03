import React, { createContext, useContext, useMemo } from 'react';
import { DEFAULT_USER_SETTINGS } from '../../packages/alantil-core/settings.js';
import { msg } from '../i18n.js';
import { semanticTypography } from './theme.js';

const RuntimeSettingsContext=createContext({settings:DEFAULT_USER_SETTINGS,typography:semanticTypography('medium')});
export function RuntimeSettingsProvider({settings=DEFAULT_USER_SETTINGS,children}){
  const value=useMemo(()=>({settings,typography:semanticTypography(settings?.text_size_code||'medium')}),[settings?.interface_language_code,settings?.translation_language_code,settings?.alan_script_code,settings?.alan_dialect_code,settings?.text_size_code]);
  return <RuntimeSettingsContext.Provider value={value}>{children}</RuntimeSettingsContext.Provider>;
}
export function useRuntimeSettings(){return useContext(RuntimeSettingsContext);}
export function useMobileMsg(){const {settings}=useRuntimeSettings();return (key,params={})=>msg(settings,key,params);}
export function useSemanticTypography(){return useRuntimeSettings().typography;}
