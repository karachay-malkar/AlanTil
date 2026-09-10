import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONTROL_LAYOUT, stationTabPadding, profileGenderHeight } from '../../packages/alantil-ui/control-layout.js';
import { buttonVisualStyle, buttonRole } from '../../packages/alantil-ui/buttons.js';
test('station tab insets remain inside the reference clamp across viewport sizes',()=>{
  assert.equal(stationTabPadding(280),44);
  assert.ok(Math.abs(stationTabPadding(390)-54.6)<1e-9);
  assert.equal(stationTabPadding(1920),76);
  assert.equal(profileGenderHeight(360),150);
  assert.equal(profileGenderHeight(361),180);
});
test('Web generated control geometry agrees with the native contract',()=>{
  const css=fs.readFileSync(new URL('../../src/shared/styles/shared-visual-tokens.css',import.meta.url),'utf8');
  for(const [key,value] of Object.entries(CONTROL_LAYOUT.progress)){
    const name=key.replace(/[A-Z]/g,c=>`-${c.toLowerCase()}`);
    const unit=typeof value==='number'&&key!=='segments'?'px':'';
    assert.ok(css.includes(`--ui-progress-${name}:${value}${unit};`),key);
  }
});
test('guide actions share the primary button family and fixed terminal metrics',()=>{
  assert.equal(buttonVisualStyle('guide.next').fill,'accent');
  assert.equal(buttonVisualStyle('guide.next').fontSize,11);
  assert.equal(buttonVisualStyle('guide.skip').fill,'transparent');
  assert.equal(buttonRole('guide.skip').shape,'plain');
});
