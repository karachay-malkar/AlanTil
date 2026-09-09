import React,{useSyncExternalStore} from 'react';
import {stationInWindow} from '../../packages/alantil-ui/path-window.js';
export function PathStationWindow({store,y,pinned,children}){
 const window=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
 return stationInWindow(y,window,pinned)?children:null;
}
