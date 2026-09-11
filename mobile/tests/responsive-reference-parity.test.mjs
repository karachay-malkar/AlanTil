import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { resolveTypography, buttonTextRole } from '../../packages/alantil-ui/typography.js';
import { BUTTON_ROLES } from '../../packages/alantil-ui/buttons.js';
import { semanticTypography } from '../ui/theme.js';

const css = fs.readFileSync(new URL('./fixtures/web-13.15.12/theme.css', import.meta.url), 'utf8');
const blocks = Object.fromEntries(['small','medium','large'].map(code => [code,
  css.match(new RegExp(`html\\[data-text-size="${code}"\\]\\{([^}]+)\\}`))[1]]));

test('reference fixture is the original Web 13.15.12 theme, not the modified shared Web', () => {
  const data=Buffer.from(css);
  const sha=crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
  assert.equal(sha,'9afc17328e22829ad9a13dec8cd7681705131a5f');
});

for (const code of ['small','medium','large']) {
  test(`${code}: all viewport sizes follow the original CSS clamp and fixed tiers`, () => {
    for (const width of [240,320,360,375,390,420,600,768,1024]) {
      const actual=resolveTypography(code,width);
      for (const role of ['micro','caption','body','emphasis','title']) {
        const expected=Number(blocks[code].match(new RegExp(`--text-${role}:(\\d+)px`))[1]);
        assert.equal(actual[role],expected,`${width}: ${role}`);
      }
      for (const role of ['display','result']) {
        const [,min,vw,max]=blocks[code].match(new RegExp(`--text-${role}:clamp\\((\\d+)px,(\\d+)vw,(\\d+)px\\)`)).map(Number);
        assert.equal(actual[role],Math.max(min,Math.min(max,width*vw/100)),`${width}: ${role}`);
      }
    }
  });
}

test('390px medium cards and results are not desktop maximum sizes',()=>{
  const type=semanticTypography('medium',390);
  assert.equal(type.wordCard.fontSize,31.2);
  assert.equal(type.question.fontSize,31.2);
  assert.equal(type.result.fontSize,54.6);
  assert.equal(type.wordCard.fontWeight,'900');
  assert.ok(type.wordCard.lineHeight>type.wordCard.fontSize);
});

test('invalid settings and missing layout width have stable fallbacks',()=>{
  assert.deepEqual(resolveTypography('invalid',390),resolveTypography('medium',390));
  for(const width of [undefined,0,-1,NaN,Infinity]) assert.equal(resolveTypography('medium',width).display,48);
});

test('button roles follow final Web typography overrides',()=>{
  const expected={'station.study':'micro','station.test':'micro','settings.save':'micro','header.text':'caption','text.action':'caption','match.card':'caption','songs.info':'emphasis','auth.provider':'body','test.answer':'body'};
  for(const [role,size] of Object.entries(expected)) assert.equal(buttonTextRole(role,BUTTON_ROLES[role]),size,role);
});
