import { readScopedJson, removeScopedValue, writeScopedJson } from "../progress/storage-scope.js?v=13.9.0";

const KEY_PREFIX="alantil_practice_snapshot_v1";
function key(type){const value=String(type||"").trim();return value==='test'||value==='match'?`${KEY_PREFIX}:${value}`:'';}
export function loadPracticeSnapshot(type){const storageKey=key(type);return storageKey?readScopedJson(storageKey,null):null;}
export function savePracticeSnapshot(type,snapshot){const storageKey=key(type);if(!storageKey||!snapshot?.id)return false;return writeScopedJson(storageKey,{...snapshot,savedAt:new Date().toISOString()});}
export function clearPracticeSnapshot(type){const storageKey=key(type);return storageKey?removeScopedValue(storageKey):false;}