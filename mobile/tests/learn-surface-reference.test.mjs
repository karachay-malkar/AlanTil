import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LEARN_SURFACE,cssGradientLine,learnCardPadding} from '../../packages/alantil-ui/learn-surface.js';
const css=readFileSync(new URL('./fixtures/web-13.15.12/theme.css',import.meta.url),'utf8');
test('Learn gradient uses the pinned Web surface colors and alpha',()=>{
 const match=css.match(/--surface-learn-gradient:linear-gradient\((\d+)deg,rgba\((\d+),(\d+),(\d+),([.\d]+)\),rgba\((\d+),(\d+),(\d+),([.\d]+)\)\)/);
 assert.ok(match);const hex=values=>'#'+values.map(v=>Number(v).toString(16).padStart(2,'0')).join('');
 assert.equal(LEARN_SURFACE.angle,Number(match[1]));assert.equal(LEARN_SURFACE.start,hex(match.slice(2,5)));assert.equal(LEARN_SURFACE.end,hex(match.slice(6,9)));assert.equal(LEARN_SURFACE.startOpacity,Number(match[5]));assert.equal(LEARN_SURFACE.endOpacity,Number(match[9]));
});
test('CSS gradient endpoints preserve the angle on tall and wide cards',()=>{
 for(const [width,height] of [[374,620],[560,300]]){
  const line=cssGradientLine(width,height);assert.ok(Math.abs((line.x1+line.x2)/2-width/2)<1e-9);assert.ok(Math.abs((line.y1+line.y2)/2-height/2)<1e-9);
  const angle=Math.atan2(line.x2-line.x1,-(line.y2-line.y1))*180/Math.PI;assert.ok(Math.abs(angle-145)<1e-9);
 }
});
test('Learn padding preserves the compact override and wide viewport clamps',()=>{
 assert.deepEqual(learnCardPadding(390),{frontHorizontal:18,frontVertical:22,backHorizontal:18});
 assert.deepEqual(learnCardPadding(600),{frontHorizontal:30,frontVertical:30,backHorizontal:24});
 assert.deepEqual(learnCardPadding(1200),{frontHorizontal:42,frontVertical:42,backHorizontal:30});
});
