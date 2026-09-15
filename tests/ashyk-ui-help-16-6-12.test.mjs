import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('Ashyk Web uses compact icon HUD without restart',()=>{const game=read('packages/ashyk-game/web/Game.jsx'),icons=read('packages/ashyk-game/shot-icons.js');assert.match(game,/ShotIcon kind="tap"/);assert.match(game,/ShotIcon kind="flat"/);assert.match(game,/ShotIcon kind="hop"/);assert.match(icons,/stroke|paths|circles/i);assert.doesNotMatch(game,/store\.restart\(/);assert.doesNotMatch(game,/>↻</);});

test('Ashyk Web help is structured and includes all six faces',()=>{const game=read('packages/ashyk-game/web/Game.jsx'),i18n=read('packages/ashyk-game/i18n.js');for(const key of['faceChyk','faceFok','faceTau','faceAlchi','faceBiy','faceKyt'])assert.match(i18n,new RegExp(`${key}:`));for(const key of['helpGoalTitle','helpControlsTitle','helpFacesTitle','helpQuestionsTitle','helpKytTitle'])assert.match(game,new RegExp(`m\\.${key}`));assert.match(i18n,/youWon:'Вы победили'/);assert.match(i18n,/youLost:'Вы проиграли'/);});

test('Ashyk Web uses standard router leave guard',()=>{const feature=read('src/features/ashyk/index.js'),router=read('src/app/router.js');assert.match(feature,/sessionActive/);assert.match(feature,/export function canLeave\(\)\{return !sessionActive;\}/);assert.doesNotMatch(feature,/getLeaveMessage/);assert.match(router,/common\.vy_tochno_hotite_vyyti_sessiya_budet_sohranena/);});

test('Ashyk 16.6.12 compact help styles are readable',()=>{const css=read('src/features/ashyk/ashyk-16-6-12.css');assert.match(css,/\.ashykShotIcons button[^}]*width:30px/);assert.match(css,/\.ashykHelpSection p[^}]*line-height:1\.55/);assert.match(css,/\.ashykFacesGrid/);assert.match(css,/\.ashykHelpControls/);});
