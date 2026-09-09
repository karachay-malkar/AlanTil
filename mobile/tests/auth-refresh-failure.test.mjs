import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {isTerminalRefreshError} from '../../packages/alantil-core/auth-failure.js';
for(const platform of ['native','web'])for(const [code,clears] of [['request_timeout',false],['over_request_rate_limit',false],['refresh_token_not_found',true],['refresh_token_already_used',true],[undefined,false]])test(`${platform} refresh ${code||'network'} retains or clears session correctly`,async()=>{
 const error=Object.assign(new Error('failure'),{code});let signs=0;
 const source=readFileSync(new URL(`../platform/auth.${platform}.js`,import.meta.url),'utf8').replace(/^import .*;\n/gm,'').replace(/export /g,'');
 const c=vm.createContext({isTerminalRefreshError,setNativeStorageScope:()=>{},nativeSupabase:{auth:{refreshSession:async()=>({error}),signOut:async()=>{signs++;}}},AsyncStorage:{removeItem:async()=>{},setItem:async()=>{}}});vm.runInContext(source,c);vm.runInContext("currentSession={user:{id:'A'},refresh_token:'token'};syncStartedForUser='A'",c);
 await assert.rejects(vm.runInContext('refreshNativeAuthSession()',c));assert.equal(signs,clears?1:0);assert.equal(vm.runInContext('currentSession===null',c),clears);
});
