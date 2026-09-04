import { Platform } from 'react-native';

// Single public auth contract. Only the selected platform adapter is executed;
// Native owns alantil:// callbacks, Web owns its current HTTPS origin.
const auth=Platform.OS==='web'?require('./auth.web.js'):require('./auth.native.js');

export const refreshNativeAuthSession=(...args)=>auth.refreshNativeAuthSession(...args);
export const handleNativeAuthUrl=(...args)=>auth.handleNativeAuthUrl(...args);
export const bootstrapNativeAuth=(...args)=>auth.bootstrapNativeAuth(...args);
export const subscribeNativeAuth=(...args)=>auth.subscribeNativeAuth(...args);
export const getNativeAuthSession=(...args)=>auth.getNativeAuthSession(...args);
export const getNativeAuthError=(...args)=>auth.getNativeAuthError(...args);
export const getNativeAuthProvider=(...args)=>auth.getNativeAuthProvider(...args);
export const signInWithGoogleNative=(...args)=>auth.signInWithGoogleNative(...args);
export const signOutNative=(...args)=>auth.signOutNative(...args);
export const nativeAuthFetch=(...args)=>auth.nativeAuthFetch(...args);

bootstrapNativeAuth().catch(()=>{});
