import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
import{DIFFICULTIES,FACE_DEFS,ASHYK_COLORS}from'../packages/ashyk-game/constants.js';
import{UI_TOKENS}from'../packages/alantil-ui/tokens.js';
import{isInstantKytWin,evaluateCapture}from'../packages/ashyk-game/rules.js';
import{createAshykQuestionDeck,ashykEligibleWords}from'../packages/ashyk-game/vocabulary.js';
import{createAshykOnlineAdapter}from'../packages/ashyk-game/online.js';
import{COZAIM_VERTEX_COUNT,COZAIM_TRIANGLE_COUNT,COZAIM_POSITIONS,COZAIM_INDICES}from'../packages/ashyk-game/model/cozaimGeometry.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const exists=p=>fs.existsSync(path.join(ROOT,p));

test('Ashyk Web route is native to Alan Til shell',()=>{const router=read('src/app/router.js'),registry=read('src/app/screen-registry.js'),feature=read('src/features/ashyk/index.js'),practice=read('src/features/practice/index.js');assert.match(router,/practice\.ashyk/);assert.match(router,/\/practice\/ashyk/);assert.match(router,/ashyk:\s*"\.\.\/features\/ashyk\/index\.js"/);assert.match(registry,/"practice\.ashyk"\s*:\s*\{\s*layout:\s*"detail",\s*header:\s*"standard",\s*bottomNav:\s*false/);assert.doesNotMatch(feature,/<iframe|ashyk-game\/index\.html|appdeploy/i);assert.match(practice,/data-practice-route="practice\.ashyk"/);assert.match(practice,/context\.router\.navigate\(button\.dataset\.practiceRoute,params\)/);assert.doesNotMatch(practice,/3D\s*·|Возвращение к истокам\s*·|Alan\s*→\s*RU/);});

test('exact shared cozaim mesh is present',()=>{assert.equal(COZAIM_VERTEX_COUNT,1387);assert.equal(COZAIM_TRIANGLE_COUNT,2794);assert.equal(COZAIM_POSITIONS.length,1387*3);assert.equal(COZAIM_INDICES.length,2794*3);assert.match(read('packages/ashyk-game/web/scene.jsx'),/createAshykVisual/);assert.match(read('mobile/game/ashyk-scene.js'),/createAshykVisual/);});

test('shared difficulty, faces and Kyt rule match 16.6.11',()=>{assert.deepEqual([DIFFICULTIES.easy.computerShotAccuracy,DIFFICULTIES.normal.computerShotAccuracy,DIFFICULTIES.hard.computerShotAccuracy],[.70,.85,1]);assert.equal(FACE_DEFS.find(x=>x.id==='БИЙ')?.value,15);assert.equal(isInstantKytWin('КЪЫТ','КЪЫТ'),true);assert.equal(evaluateCapture('АЛЧИ','АЛЧИ',false).success,true);assert.equal(evaluateCapture('АЛЧИ','АЛЧИ',true).success,false);assert.equal(ASHYK_COLORS.background,UI_TOKENS.colors.appBg);assert.equal(ASHYK_COLORS.board,'#9a6840');});

test('Return to the roots questions use eligible same-POS words without rapid repeats',()=>{const words=Array.from({length:6},(_,i)=>({id:`w${i}`,word:`alan${i}`,trans:`ru${i}`,pos:'noun',usedInTest:true,dictionary_id:'intermediate',story_id:'roots',synonyms:[]}));words.push({id:'wrong-story',word:'x',trans:'x',pos:'noun',usedInTest:true,dictionary_id:'intermediate',story_id:'other'});assert.equal(ashykEligibleWords(words).length,6);const deck=createAshykQuestionDeck(words,()=>.37),prompts=[];for(let i=0;i<6;i+=1){const q=deck.next();prompts.push(q.prompt);assert.equal(q.options.length,4);assert.ok(q.options.some(x=>x.id===q.answerId));}assert.equal(new Set(prompts).size,6);const next=deck.next();assert.ok(prompts.includes(next.prompt));});

test('Supabase adapter uses deployed RPC parameter contract',async()=>{const calls=[];const channel={on(){return this;},subscribe(){return this;},unsubscribe(){}};const client={rpc:async(name,args)=>{calls.push([name,args]);return{data:{id:'r1',revision:2},error:null};},channel:()=>channel,removeChannel(){}};const online=createAshykOnlineAdapter(client);await online.createRoom({difficulty:'normal'});await online.joinRoom('ab12cd');await online.submitRoomState({id:'r1',revision:2},{scores:[0,0]},'u2','playing');await online.leaveRoom('r1');assert.deepEqual(Object.keys(calls[0][1]),['p_initial_state']);assert.deepEqual(Object.keys(calls[1][1]),['p_code']);assert.deepEqual(Object.keys(calls[2][1]),['p_room_id','p_expected_revision','p_state','p_next_active_user_id','p_status']);assert.deepEqual(Object.keys(calls[3][1]),['p_room_id']);});

test('local runtime, audio and cleanup replace standalone HTML',()=>{for(const p of['assets/ashyk/audio/clack.mp3','assets/ashyk/audio/smaller-horn-dropped-on-stone-floor.mp3','assets/ashyk/audio/wood-hard-hit.wav'])assert.ok(exists(p),p);assert.ok(exists('src/features/ashyk/runtime.js'));const runtime=read('src/features/ashyk/runtime.js');assert.doesNotMatch(runtime,/appdeploy\.ai|<iframe/i);assert.equal(exists('assets/ashyk-game/index.html'),false);assert.equal(exists('mobile/assets/ashyk-game/index.html'),false);assert.equal(exists('.tmp1611'),false);assert.equal(exists('tools/apply-ashyk-router-16-6-11.mjs'),false);assert.equal(exists('tools/vendor-ashyk-v45.mjs'),false);});

test('RU EN TR and Settings segmented controls are wired',()=>{const i18n=read('packages/ashyk-game/i18n.js'),game=read('packages/ashyk-game/web/Game.jsx'),css=read('src/features/ashyk/ashyk.css');for(const code of['ru','en','tr'])assert.match(i18n,new RegExp(`${code}:Object\\.freeze`));assert.match(game,/settingsSegments ashykSegmented/);assert.match(game,/settingsChoice/);assert.doesNotMatch(game,/locale==='tr'\?'MOD'/);assert.match(css,/data-screen="ashyk"/);assert.doesNotMatch(css,/data-feature="ashyk"/);});
