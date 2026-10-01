import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as accessModule from '../packages/alantil-core/ashyk-access.js';
import {createAshykGameStore} from '../packages/ashyk-game/store.js';

const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const engine={reset(){},clearSelection(){},snapshot(){return {pieces:[]}}};
const timers={setTimer:null,clearTimer:null,setRepeater:null,clearRepeater:null};

test('guest sees friend mode but shared access contract marks it auth-protected',()=>{
  assert.equal(typeof accessModule.ashykVisibleModesForUser,'function');
  assert.equal(typeof accessModule.ashykModeAccess,'function');
  assert.deepEqual(accessModule.ashykVisibleModesForUser('').map(item=>item.id),['computer','online']);
  assert.deepEqual(accessModule.ashykAccessForUser('').modes,['computer']);
  assert.deepEqual(accessModule.ashykModeAccess('online',{userId:''}),{
    mode:'online',visible:true,allowed:false,requiresAuth:true,
  });
  assert.equal(accessModule.ashykModeAccess('online',{userId:'user-1'}).allowed,true);
});

test('shared game store refuses online mode and room hydration for guests',()=>{
  const guest=createAshykGameStore({engine,userId:'',...timers});
  assert.equal(guest.setMode('online'),false);
  assert.equal(guest.getState().gameMode,'computer');
  const room={id:'r1',host_user_id:'user-1',guest_user_id:'user-2',active_user_id:'user-1',status:'playing',phase:'first-shot',game_state:{scores:[0,0]}};
  assert.equal(guest.hydrateOnline(room,''),false);
  assert.equal(guest.getState().gameMode,'computer');
  guest.destroy();

  const account=createAshykGameStore({engine,userId:'user-1',...timers});
  assert.equal(account.setMode('online'),true);
  assert.equal(account.getState().gameMode,'online');
  account.restart();
  assert.equal(account.hydrateOnline(room,'user-1'),true);
  assert.equal(account.getState().gameMode,'online');
  account.destroy();
});

test('Web setup renders visible friend mode and routes auth-required selection through one shared guard',()=>{
  const game=read('packages/ashyk-game/web/Game.jsx');
  const feature=read('src/features/ashyk/index.js');
  assert.match(game,/ashykVisibleModesForUser/);
  assert.match(game,/ashykModeAccess/);
  assert.match(game,/onAuthRequired/);
  assert.match(game,/ashykModeAccessLock/);
  assert.match(feature,/isAshykModeAllowed\('online',\{userId\}\)/);
  assert.match(feature,/onlineAllowed\?takePendingAshykInvite\(\):/);
  assert.match(feature,/onlineAllowed\?takePendingAshykIntent\(\):/);
  assert.match(feature,/onAuthRequired:\(\)=>context\.router\.navigate\('account\.home'\)/);
});

test('Mobile setup uses the same mode guard and AppRoot guards room entry',()=>{
  const screen=read('mobile/screens/ashyk.js');
  const app=read('mobile/AppRoot.js');
  assert.match(screen,/ashykVisibleModesForUser/);
  assert.match(screen,/ashykModeAccess/);
  assert.match(screen,/onAuthRequired/);
  assert.match(screen,/modeAccessLock/);
  assert.match(screen,/createAshykGameStore\(\{engine,words,userId/);
  assert.match(app,/isAshykModeAllowed\('online',\{userId:authUserKey\}\)/);
  assert.match(app,/openAshykRoom=.*isAshykModeAllowed/);
});

test('guest-facing copy says only friend mode requires an account',()=>{
  const social=read('packages/alantil-core/social-i18n.js');
  assert.match(social,/loginForModes:M\('Для игры с другом войдите или создайте аккаунт\.'/);
  assert.doesNotMatch(social,/Ашыкъ оюн доступен только зарегистрированным пользователям/);
});
