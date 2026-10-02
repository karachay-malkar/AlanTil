import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

test("Ashyk help is directly available on setup and game screens", () => {
  const web = read("packages/ashyk-game/web/Game.jsx");
  const mobile = read("mobile/screens/ashyk.js");
  assert.match(web, /ashykSetupHelpButton/);
  assert.match(web, /ashykHelpButton/);
  assert.match(web, /onHelp=\{\(\)=>setHelp\(true\)\}/);
  assert.doesNotMatch(web, /function Menu\(\{open,onClose,onHelp/);
  assert.match(mobile, /styles\.setupHelpButton/);
  assert.match(mobile, /styles\.helpButton/);
  assert.match(mobile, /onHelp=\{\(\)=>setHelp\(true\)\}/);
  assert.doesNotMatch(mobile, /function MenuDialog\(\{visible,onClose,onHelp/);
});

test("Ashyk help matches the authoritative capture and scoring mechanics", () => {
  const i18n = read("packages/ashyk-game/i18n.js");
  const engine = read("packages/ashyk-game/engine.js");
  const store = read("packages/ashyk-game/store.js");
  for (const key of ["helpCaptureTitle","helpPenaltyTitle","helpEndTitle"]) assert.match(i18n, new RegExp(key + ":"));
  assert.match(i18n, /Перед ударом игра запоминает верхние грани/);
  assert.match(i18n, /Промах мимо всех ашыков[^']*−1 очко/);
  assert.match(i18n, /После дополнительного удара нового вопроса нет/);
  assert.match(engine, /preShotFaces=new Map\(alive\(\)\.map/);
  assert.match(engine, /if\(targetId===null\)\{targetId=contacted/);
  assert.match(engine, /evaluateCapture\(attackerStartFace,targetStartFace,third\)/);
  assert.match(store, /if\(!result\.hitAny\)\{const scores=\[\.\.\.state\.scores\];scores\[current-1\]-=1/);
  assert.match(store, /if\(state\.phase==='first-shot'\)/);
  assert.match(store, /phase:'bonus-shot'/);
  assert.match(store, /remaining<=1/);
});

test("Ashyk help includes six model-derived face previews on Web and Mobile", () => {
  const web = read("packages/ashyk-game/web/Game.jsx");
  const mobile = read("mobile/screens/ashyk.js");
  for (const face of ["chyk","fok","tau","alchi","biy","kyt"]) {
    assert.match(web, new RegExp("/assets/ashyk/faces/"));
    assert.match(mobile, new RegExp(`faces/${face}\\.png`));
    const webAsset = path.join(ROOT, "assets/ashyk/faces", face + ".png");
    const mobileAsset = path.join(ROOT, "mobile/assets/ashyk/faces", face + ".png");
    const webBytes=fs.readFileSync(webAsset),mobileBytes=fs.readFileSync(mobileAsset);
    assert.ok(webBytes.length > 40000);
    assert.deepEqual(webBytes,mobileBytes);
    assert.equal(webBytes.readUInt32BE(16),512);
    assert.equal(webBytes.readUInt32BE(20),512);
  }
});

test("Ashyk board is framed 15 percent smaller without changing physics", () => {
  const constants = read("packages/ashyk-game/constants.js");
  const webScene = read("packages/ashyk-game/web/scene.jsx");
  const nativeScene = read("mobile/game/ashyk-scene.js");
  assert.match(constants, /export const BOARD=23\.8;/);
  assert.match(constants, /export const BOARD_VIEW_SCALE=\.85;/);
  assert.match(webScene, /27\/BOARD_VIEW_SCALE/);
  assert.match(webScene, /40\/BOARD_VIEW_SCALE/);
  assert.match(nativeScene, /Math\.hypot\(27,23,28\)\/BOARD_VIEW_SCALE/);
  assert.match(nativeScene, /40\/BOARD_VIEW_SCALE/);
});

test("Published Web runtime contains the new help and 15 percent framing", () => {
  const runtime = read("src/features/ashyk/runtime.js");
  for (const marker of ["ashykSetupHelpButton","ashykHelpButton","helpCaptureTitle","helpPenaltyTitle","helpEndTitle","/assets/ashyk/faces/"]) assert.ok(runtime.includes(marker), marker);
  assert.doesNotMatch(runtime, /ashykShotInfo/);
  assert.ok(runtime.includes('Direct shot')||runtime.includes('Прямой удар'));
});

test("Ashyk feature cache keys point to the updated runtime and styles", () => {
  const feature = read("src/features/ashyk/index.js");
  const lazy = read("src/shared/styles/lazy/ashyk.css");
  const layered = read("src/features/ashyk/ashyk-16-7.css");
  assert.match(feature, /runtime\.js\?v=16\.8\.0\.13/);
  assert.match(lazy, /ashyk\.css\?v=16\.8\.0\.13/);
  assert.match(lazy, /ashyk-16-7\.css\?v=16\.8\.0\.13/);
  assert.match(layered, /ashyk-16-6-12\.css\?v=16\.8\.0\.8/);
});

test("Ashyk Rules put faces before shot controls and remain vertically scrollable", () => {
  const web = read("packages/ashyk-game/web/Game.jsx");
  const mobile = read("mobile/screens/ashyk.js");
  const css = read("src/features/ashyk/ashyk-16-6-12.css");
  const i18n = read("packages/ashyk-game/i18n.js");
  const webRules = web.slice(web.indexOf("function Help("), web.indexOf("function Menu(", web.indexOf("function Help(")));
  const mobileRules = mobile.slice(mobile.indexOf("function RulesDialog("), mobile.indexOf("function MenuDialog(", mobile.indexOf("function RulesDialog(")));
  assert.ok(webRules.indexOf("helpFacesTitle") < webRules.indexOf("helpControlsTitle"));
  assert.ok(mobileRules.indexOf("helpFacesTitle") < mobileRules.indexOf("helpControlsTitle"));
  assert.match(webRules, /ashykHelpScroll/);
  assert.match(css, /ashykHelpScroll[^}]*overflow-y:auto/);
  assert.match(css, /-webkit-overflow-scrolling:touch/);
  assert.match(i18n, /help:'Правила'/);
  assert.match(i18n, /rules:'Правила'/);
  assert.match(webRules, /face==='kyt'\?m\.instantWin/);
  assert.match(mobileRules, /face==='kyt'\?m\.instantWin/);
});
