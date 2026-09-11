import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { DEFAULT_USER_SETTINGS } from '../../packages/alantil-core/settings.js';
import { msg } from '../i18n.js';
import { semanticTypography } from './theme.js';

const RuntimeSettingsContext=createContext({settings:DEFAULT_USER_SETTINGS,typography:semanticTypography('medium')});
export function RuntimeSettingsProvider({settings=DEFAULT_USER_SETTINGS,children}){
  const {width}=useWindowDimensions();
  const value=useMemo(()=>({settings,typography:semanticTypography(settings?.text_size_code||'medium',width)}),[settings,width]);
  return <RuntimeSettingsContext.Provider value={value}>{children}</RuntimeSettingsContext.Provider>;
}
export function useRuntimeSettings(){return useContext(RuntimeSettingsContext);}
export function useMobileMsg(){const {settings}=useRuntimeSettings();return (key,params={})=>msg(settings,key,params);}
export function useSemanticTypography(){return useRuntimeSettings().typography;}
