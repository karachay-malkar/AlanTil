import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/shared/social/social-service.js',import.meta.url),'utf8');
test('incoming calls refresh without realtime and survive an active-room failure',async()=>{
 let tick,cleared=false,snapshot={ashyk_invites:[]};const states=[];
 const client={channel(){return {on(){return this;},subscribe(){return this;},unsubscribe(){}};},removeChannel(){},auth:{onAuthStateChange(){return {data:{subscription:{unsubscribe(){}}}};},async getSession(){return {data:{session:{user:{id:'receiver'}}}};}}};
 const controller=new Function('getSupabaseClient','fetchSocialInboxCounts','fetchFriendsSnapshot','fetchActiveAshykRoom','globalThis',source.slice(source.indexOf('export async function startSocialInboxController')).replace('export ','')+';return startSocialInboxController;')(
 async()=>client,async()=>({total:1}),async()=>snapshot,async()=>{throw new Error('room lookup unavailable');},
 {setInterval(fn,ms){assert.equal(ms,5000);tick=fn;return 1;},clearInterval(id){if(id===1)cleared=true;}}
 );
 const stop=await controller(()=>{},state=>states.push(state));
 assert.deepEqual(states.at(-1).snapshot.ashyk_invites,[]);
 snapshot={ashyk_invites:[{invite_id:'incoming'}]};tick();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(states.at(-1).snapshot.ashyk_invites[0].invite_id,'incoming');
 assert.equal(states.at(-1).activeRoom,null);
 stop();assert.equal(cleared,true);const count=states.length;tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(states.length,count);
});
