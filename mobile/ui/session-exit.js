import React, {useRef,useState} from 'react';
import {completeBeforeSessionExit} from '../../packages/alantil-core/session-exit.js';
import {getDisplayedSessionExitPhrase} from '../../packages/alantil-core/alan-display.js';
import {ConfirmDialog} from './modal.js';
import {useMobileMsg,useRuntimeSettings} from './runtime-settings.js';

export function useSessionExit({active,beforeLeave,save,onLeave,message}) {
  const [visible,setVisible]=useState(false),[failed,setFailed]=useState(false),busy=useRef(false);
  const latest=useRef(null);latest.current={active,beforeLeave,save,onLeave,message};
  const m=useMobileMsg(),{settings}=useRuntimeSettings();
  const request=()=>{if(latest.current.active){setFailed(false);setVisible(true);}else latest.current.onLeave();};
  const cancel=()=>{if(!busy.current){setVisible(false);setFailed(false);}};
  const confirm=async()=>{
    if(busy.current)return;
    busy.current=true;
    const action=latest.current.beforeLeave||latest.current.save||(()=>Promise.resolve());
    try{await completeBeforeSessionExit(action,()=>{setVisible(false);latest.current.onLeave();});}
    catch{setFailed(true);}
    finally{busy.current=false;}
  };
  const dialogMessage=failed?m('mobile.session.exit_failed'):(latest.current.message||m('common.vy_tochno_hotite_vyyti_sessiya_budet_sohranena'));
  return {request,dialog:<ConfirmDialog visible={visible} message={dialogMessage} confirmLabel={getDisplayedSessionExitPhrase(settings)} cancelLabel={m('common.ostatsya')} onConfirm={confirm} onCancel={cancel}/>};
}
