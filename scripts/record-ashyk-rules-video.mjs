import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
import {normalizeSupabaseWordEntry} from '../packages/alantil-core/word-normalizer.js';
import {storiesByDictionary} from '../packages/alantil-core/dictionary-contract.js';
import {createHash} from 'node:crypto';
const requireDeps=createRequire(path.resolve('tools/ashyk-web/package.json'));
const {build}=requireDeps('esbuild');
await fs.mkdir('video-output',{recursive:true});
const hash=v=>createHash('sha256').update(v).digest('hex');
const parity={};
for(const file of ['src/features/ashyk/runtime.js','src/shared/styles/app.css','src/features/ashyk/ashyk.css','src/features/ashyk/ashyk-16-7.css']){
 const local=await fs.readFile(file);const response=await fetch('https://alantil.ru/'+file,{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error('Live source check failed: '+file+' '+response.status);
 const live=Buffer.from(await response.arrayBuffer());parity[file]={local:hash(local),live:hash(live),matches:hash(local)===hash(live)};
}
await fs.writeFile('video-output/source-parity.json',JSON.stringify(parity,null,2));
console.log('SOURCE_PARITY',JSON.stringify(parity));
if(Object.values(parity).some(v=>!v.matches))throw Error('Copied build differs from current website; refusing to claim exact visual parity');
const original=await fs.readFile('packages/ashyk-game/web/Game.jsx','utf8');
const needle='const {engine,store}=storeRef.current,state=useStore(store)';
if(!original.includes(needle))throw Error('Recording hook location changed');
await fs.writeFile('packages/ashyk-game/web/Game.jsx',original.replace(needle,'globalThis.__ashykRecording=storeRef.current;'+needle));
// Enable only the existing local store controller in this disposable build.
// The UI flags and online access stay identical to the copied game.
const storePath='packages/ashyk-game/store.js';
const originalStore=await fs.readFile(storePath,'utf8');
await fs.writeFile(storePath,originalStore.replace('if(!ASHYK_FEATURE_FLAGS.allowLocalSameDevice)return false;',''));
const snapshot=JSON.parse(await fs.readFile('src/data/dictionary-snapshot.json','utf8'));
function findWords(o){if(Array.isArray(o)){if(o.some(v=>v&&typeof v==='object'&&(v.word||v.wordAlanCyrillic)))return o;for(const v of o){const r=findWords(v);if(r)return r;}}else if(o&&typeof o==='object'){for(const v of Object.values(o)){const r=findWords(v);if(r)return r;}}return null;}
const stories=storiesByDictionary(snapshot.stories||[]);
const words=(snapshot.words||[]).map(row=>normalizeSupabaseWordEntry(row,stories.get(String(row.dictionary_id||''))||null)).filter(Boolean);
if(!words.length)throw Error('No dictionary words found');
await fs.writeFile('video-output/words.json',JSON.stringify(words));
await fs.writeFile('video-output/entry.jsx',String.raw`import {mountAshykGame} from '../packages/ashyk-game/web/entry.jsx';
const words=await fetch('/video-output/words.json').then(r=>r.json());
mountAshykGame(document.querySelector('.ashykHost'),{words,locale:'ru',userId:'offline-recording',onExit:()=>location.reload()});`);
await build({entryPoints:['video-output/entry.jsx'],outfile:'video-output/runtime.js',bundle:true,format:'esm',platform:'browser',target:['es2022'],jsx:'automatic',nodePaths:[path.resolve('tools/ashyk-web/node_modules')],define:{'process.env.NODE_ENV':'"production"'}});
await fs.writeFile('video-output/index.html',String.raw`<!doctype html><html lang="ru" data-theme="alan-paper" data-text-size="medium"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ашыкъ оюн — правила</title><link rel="stylesheet" href="/src/shared/styles/app.css"><link rel="stylesheet" href="/src/features/ashyk/ashyk.css"><link rel="stylesheet" href="/src/features/ashyk/ashyk-16-7.css"><style>
html,body{margin:0;width:1280px;height:900px;overflow:hidden;background:#eee9df}
.appShell{position:absolute!important;inset:0 auto 0 0!important;width:850px!important;height:900px!important;max-width:none!important;--ashyk-content-top:20px}
.appScreenHost,.ashykView,.ashykHost{width:100%;height:100%}
#notes{position:absolute;left:850px;top:0;width:430px;height:900px;box-sizing:border-box;padding:64px 38px;background:#24251f;color:#f5f0e6;display:flex;flex-direction:column;justify-content:center;font:23px/1.55 Arial,sans-serif;z-index:100000}
#notes small{font-size:14px;letter-spacing:2px;color:#d4bb86}#notes h1{font:700 34px/1.15 Arial;margin:24px 0}#notes p{margin:0;white-space:pre-line}#notes footer{font-size:14px;color:#c1baae;margin-top:36px}
</style><div class="appShell" data-screen="ashyk"><div class="appScreenHost"><section class="view ashykView"><div class="ashykHost"></div></section></div></div><aside id="notes"><small>АЛАН ТИЛ · АШЫКЪ ОЮН</small><h1 id="title"></h1><p id="copy"></p><footer>Настоящий игровой движок, модель и звуки.<br>Учебные расстановки в отдельной копии игры.</footer></aside><script type="module" src="/video-output/runtime.js"></script></html>`);
const server=spawn('python3',['-m','http.server','8080'],{stdio:'ignore'});
const browser=await chromium.launch({headless:false,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required','--start-fullscreen','--window-position=0,0','--window-size=1280,900']});
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.goto('http://localhost:8080/video-output/index.html');
await page.waitForFunction(()=>!!globalThis.__ashykRecording);
await page.locator('body').click({position:{x:880,y:880}});
await page.waitForTimeout(3000);
const ffmpeg=spawn('ffmpeg',['-y','-f','x11grab','-framerate','30','-video_size','1280x900','-i',process.env.DISPLAY||':99','-f','pulse','-i','default','-c:v','libx264','-preset','veryfast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','video-output/ashyk-rules.mp4'],{stdio:['pipe','ignore','inherit']});
const results=[];
async function caption(title,copy,ms=6000){await page.evaluate(({title,copy})=>{document.querySelector('#title').textContent=title;document.querySelector('#copy').textContent=copy;},{title,copy});await page.waitForTimeout(ms);}
async function layout(kind='same'){
 await page.evaluate(kind=>{
 const{engine,store}=globalThis.__ashykRecording;
 store.startLocal('easy');
 const q=(face)=>face==='kyt'?[0,0,Math.SQRT1_2,Math.SQRT1_2]:face==='chyk'?[1,0,0,0]:[0,0,0,1];
 const positions=[[-2.2,.8,0],[0,.8,0],kind==='third'?[2,.8,0]:[8,.8,7]];
 const s=engine.snapshot();
 for(const p of s.pieces){p.alive=p.id<3;if(p.alive){p.position=positions[p.id];p.quaternion=q(kind==='kyt'?'kyt':kind==='mismatch'&&p.id===1?'chyk':'fok');}}
 engine.applySnapshot(s);
 },kind);
 await page.waitForFunction(()=>globalThis.__ashykRecording.engine.isReady());
 await page.evaluate(()=>globalThis.__ashykRecording.store.startTurn(1));
}
async function shoot(kind,mode='flat'){
 await page.evaluate(({kind,mode})=>{
 const{engine}=globalThis.__ashykRecording;engine.select(0);
 const a=engine.getPiece(0).body.position,b=engine.getPiece(1)?.body.position||{x:a.x,z:a.z+5};
 if(!engine.launch(0,{mode,directionX:kind==='miss'?0:b.x-a.x,directionZ:kind==='miss'?1:b.z-a.z,pullRatio:kind==='third'?.48:.36,pullLength:(kind==='third'?.48:.36)*6.8}))throw Error('Launch rejected');
 },{kind,mode});
 await page.waitForFunction(()=>!globalThis.__ashykRecording.engine.isShotActive(),{timeout:12000});
 const state=await page.evaluate(()=>globalThis.__ashykRecording.store.getState());
 console.log('SCENE_RESULT',kind,JSON.stringify({outcome:state.lastOutcome,phase:state.phase,remaining:state.remainingAshyks}));
 results.push({kind,mode,scores:state.scores,outcome:state.lastOutcome,phase:state.phase,winner:state.winner});
 return state;
}
try{
 await layout();
 console.log('PREFLIGHT_BEFORE',JSON.stringify(await page.evaluate(()=>({state:globalThis.__ashykRecording.store.getState(),pieces:globalThis.__ashykRecording.engine.getPieces().filter(p=>p.alive).map(p=>({id:p.id,face:globalThis.__ashykRecording.engine.getFace(p.id),pos:p.body.position}))}))));
 await page.screenshot({path:'video-output/preview.png'});
 const preflight=await shoot('same');
 if(preflight.lastOutcome?.code!=='capture')throw Error('Preflight capture failed');
 await page.evaluate(()=>globalThis.__ashykRecording.store.restart());
 await caption('Как играть','Цель — набрать больше очков.\n\nВыберите ашык и ударьте им по другому ашыку с такой же верхней гранью.',9000);
 await layout();
 await caption('Сначала сравните грани','Сравнивайте верхние грани при ударе.\n\nПоложение после столкновения не определяет взятие.',8000);
 await page.evaluate(()=>globalThis.__ashykRecording.engine.select(0));
 await caption('Направление и сила','Нажмите на ашык, затем потяните выбранный ашык и отпустите.\n\nПунктир показывает направление. Длина движения задаёт силу.',8500);
 await caption('Прямой удар','Ашык движется по плоскости.\n\nУдаряем «Фок» в «Фок»: при успешном взятии начисляются 2 очка.',1000);
 const capture=await shoot('same');
 if(capture.lastOutcome?.code!=='capture'||capture.phase!=='bonus-question')throw Error('Capture demo failed: '+JSON.stringify(capture.lastOutcome));
 await caption('Вопрос после взятия','Правильный ответ: +3 очка и один дополнительный удар.\n\nСначала выберите перевод, затем нажмите «Ответить».',7000);
 const answer=await page.evaluate(()=>{const{store}=globalThis.__ashykRecording;const q=store.getState().question;return q.options.find(x=>String(x.id)===String(q.answerId)).text;});
 await page.getByRole('button',{name:answer,exact:true}).click();
 await page.getByRole('button',{name:'Ответить',exact:true}).click();
 await caption('Дополнительный удар','За верный ответ получены +3 очка.\n\nДополнительное взятие даёт очки за грань. Новая цепочка вопросов после него не начинается.',9000);
 await shoot('miss');
 await layout();
 await caption('Удар с подбросом','Второй тип удара — подброс.\n\nАшык летит по дуге. Правила совпадения граней и касания третьего ашыка сохраняются.',7500);
 await page.getByRole('button',{name:/подброс/i}).first().click().catch(()=>{});
 await shoot('hop','hop');
 await layout('mismatch');
 await caption('Грани не совпали','Попадания недостаточно.\n\nЕсли верхние грани различаются, взятие не засчитывается. Ход переходит сопернику.',6000);
 const mismatch=await shoot('mismatch');if(mismatch.lastOutcome?.code!=='faceMismatch')throw Error('Mismatch demo failed');
 await caption('Почему нет очков?','Здесь «Фок» ударил по другой грани.\n\nРезультат: 0 очков за взятие.',6500);
 await layout('third');
 await caption('Нельзя задевать третьего','Если бьющий ашык или цель заденут третий ашык, взятие отменяется.\n\nДаже при совпадении граней.',6500);
 const third=await shoot('third');if(third.lastOutcome?.code!=='thirdTouched')throw Error('Third piece demo failed');
 await caption('Взятие отменено','Задет третий ашык.\n\nОчки за такое взятие не начисляются; следующий ход делает соперник.',6500);
 await layout('miss');
 await caption('Промах','Удар без попадания по любому ашыку снимает 1 очко.\n\nПосле промаха ход переходит сопернику.',6000);
 const miss=await shoot('miss');if(miss.lastOutcome?.code!=='miss'||miss.scores[0]!==-1)throw Error('Miss demo failed');
 await caption('Штраф за промах','Счёт уменьшился на 1.\n\nНесовпадение граней и касание третьего ашыка — это другие исходы: за них взятие даёт 0.',6500);
 await layout();await shoot('same');
 await caption('Неверный ответ','За ошибочный перевод снимается 1 очко.\n\nОчки уже выполненного взятия сохраняются. Дополнительного удара нет.',7000);
 const wrong=await page.evaluate(()=>{const q=globalThis.__ashykRecording.store.getState().question;return q.options.find(x=>String(x.id)!==String(q.answerId)).text;});
 await page.getByRole('button',{name:wrong,exact:true}).click();await page.getByRole('button',{name:'Ответить',exact:true}).click();
 await caption('Можно пропустить?','Да. «Не отвечать» передаёт ход сопернику без штрафа за ответ.\n\nДополнительный удар при пропуске не выдаётся.',6000);
 await layout();await shoot('same');await page.getByRole('button',{name:'Не отвечать',exact:true}).click();
 await caption('Время и завершение','Следите за таймером в игре.\n\nПосле окончания времени ход переходит сопернику. В обычной партии победитель определяется по счёту, когда остаётся один ашык.',8000);
 await layout('kyt');
 await caption('Особое правило: Къыт','Успешное взятие «Къыт → Къыт» — мгновенная победа.\n\nТекущий счёт не имеет значения. Касание третьего ашыка всё равно отменяет взятие.',7500);
 const kyt=await shoot('kyt');if(!kyt.winByKyt||kyt.winner!==1)throw Error('Kyt demo failed');
 await caption('Запомните главное','Одинаковые грани при ударе.\nНе заденьте третий ашык.\nВерный ответ даёт +3 и ещё удар.\n«Къыт → Къыт» сразу завершает игру.',10000);
 await page.screenshot({path:'video-output/preview.png'});
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
 await fs.writeFile('video-output/verification.json',JSON.stringify({sourceCommit:process.env.GITHUB_SHA,scenes:results,errors,notes:'Offline instructional arrangements, original renderer, engine and audio. No generated imagery.'},null,2));
}finally{
 ffmpeg.stdin.write('q\n');await new Promise(r=>ffmpeg.once('exit',r));await browser.close();server.kill();
 await fs.writeFile('packages/ashyk-game/web/Game.jsx',original);
 await fs.writeFile(storePath,originalStore);
}
