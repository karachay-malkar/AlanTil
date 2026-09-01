import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { designTokens } from '../packages/alantil-design/tokens.js';

const themeCss = await readFile(new URL('../src/shared/styles/theme.css', import.meta.url), 'utf8');
const appCss = await readFile(new URL('../src/shared/styles/app.css', import.meta.url), 'utf8');

function escaped(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectThemeCssVar(name, value) {
  assert.match(themeCss, new RegExp(`--${name}:\\s*${escaped(value)}\\s*;`));
}

test('15.0 shared design tokens stay equal to the 13.15.12 web reference', () => {
  expectThemeCssVar('text-1', designTokens.colors.text);
  expectThemeCssVar('text-2', designTokens.colors.textMuted);
  expectThemeCssVar('text-3', designTokens.colors.textSoft);
  expectThemeCssVar('text-inverse', designTokens.colors.inverse);
  expectThemeCssVar('app-bg', designTokens.colors.background);
  expectThemeCssVar('app-bg-deep', designTokens.colors.backgroundDeep);
  expectThemeCssVar('surface-0', designTokens.colors.surface);
  expectThemeCssVar('surface-1', designTokens.colors.surface2);
  expectThemeCssVar('surface-2', designTokens.colors.surface3);
  expectThemeCssVar('accent', designTokens.colors.accent);
  expectThemeCssVar('accent-strong', designTokens.colors.accentStrong);
  expectThemeCssVar('success', designTokens.colors.success);
  expectThemeCssVar('danger', designTokens.colors.danger);
  expectThemeCssVar('locked', designTokens.colors.locked);
  expectThemeCssVar('radius-sm', `${designTokens.radius.sm}px`);
  expectThemeCssVar('radius-md', `${designTokens.radius.md}px`);
  expectThemeCssVar('radius-lg', `${designTokens.radius.lg}px`);
  expectThemeCssVar('route-section-gap', `${designTokens.path.sectionGap}px`);
  expectThemeCssVar('route-dictionary-gap', `${designTokens.path.dictionaryGap}px`);
  expectThemeCssVar('route-scale-dot-size', `${designTokens.path.scaleDotSize}px`);
  expectThemeCssVar('route-scale-diamond-size', `${designTokens.path.scaleDiamondSize}px`);
  expectThemeCssVar('station-size', `${designTokens.path.stationSize}px`);
});

test('15.0 path tokens follow the effective final web 13.15.12 overrides', () => {
  assert.match(appCss, new RegExp(`--route-station-gap:\\s*${designTokens.path.stationGap}px\\s*;`));
  assert.match(appCss, new RegExp(`--route-wave-amplitude:\\s*clamp\\(${designTokens.path.waveAmplitudeMin}px,22vw,${designTokens.path.waveAmplitudeMax}px\\)\\s*;`));
  assert.match(appCss, new RegExp(`\\.pathView \\.routeCatalogGroups\\{padding-bottom:${designTokens.path.catalogBottomPadding}px\\}`));
  assert.equal(designTokens.path.waveSteps, 4);
  assert.match(appCss, /stationNode\[data-route-step="1"\]\{--station-shift:calc\(0px - var\(--route-wave-amplitude\)\)\}/);
  assert.match(appCss, /stationNode\[data-route-step="2"\]\{--station-shift:0px\}/);
  assert.match(appCss, /stationNode\[data-route-step="3"\]\{--station-shift:var\(--route-wave-amplitude\)\}/);
  assert.match(appCss, /stationNode\[data-route-step="4"\]\{--station-shift:0px\}/);
});
