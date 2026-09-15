import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs';
import path from'node:path';
import{fileURLToPath}from'node:url';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');

test('native Ashyk uses shared session exit confirmation',()=>{const screen=read('mobile/screens/ashyk.js'),exit=read('mobile/ui/session-exit.js');assert.match(screen,/useSessionExit/);assert.match(screen,/active:state\.status==='playing'/);assert.match(screen,/onBack=\{requestExit\}/);assert.match(screen,/\{exit\.dialog\}/);assert.match(exit,/getDisplayedSessionExitPhrase/);});

test('native Ashyk has compact shared shot icons and no restart',()=>{const screen=read('mobile/screens/ashyk.js');for(const kind of['tap','flat','hop'])assert.match(screen,new RegExp(`kind="${kind}"`));assert.match(screen,/react-native-svg/);assert.doesNotMatch(screen,/store\.restart\(/);});

test('native Ashyk help is scrollable and contains face scoring',()=>{const screen=read('mobile/screens/ashyk.js');assert.match(screen,/helpScroll/);assert.match(screen,/FACE_HELP/);assert.match(screen,/helpFacesTitle/);assert.match(screen,/helpQuestionsTitle/);assert.match(screen,/helpKytTitle/);});

test('native Ashyk result uses complete localized phrases',()=>{const screen=read('mobile/screens/ashyk.js'),i18n=read('packages/ashyk-game/i18n.js');assert.match(screen,/m\.youWon/);assert.match(screen,/m\.youLost/);assert.match(i18n,/youWon:'Вы победили'/);assert.doesNotMatch(screen,/` \$\{m\.won\}`/);});
