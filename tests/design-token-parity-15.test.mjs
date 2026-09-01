import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { designTokens } from '../packages/alantil-design/tokens.js';

const css = await readFile(new URL('../src/shared/styles/theme.css', import.meta.url), 'utf8');

function expectCssVar(name, value) {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  assert.match(css, new RegExp(`--${name}:\\s*${escaped.replaceAll('rgba\\(', 'rgba\\(')}\\s*;`));
}

test('15.0 shared design tokens stay equal to the 13.15.12 web reference', () => {
  expectCssVar('text-1', designTokens.colors.text);
  expectCssVar('text-2', designTokens.colors.textMuted);
  expectCssVar('text-3', designTokens.colors.textSoft);
  expectCssVar('text-inverse', designTokens.colors.inverse);
  expectCssVar('app-bg', designTokens.colors.background);
  expectCssVar('app-bg-deep', designTokens.colors.backgroundDeep);
  expectCssVar('surface-0', designTokens.colors.surface);
  expectCssVar('surface-1', designTokens.colors.surface2);
  expectCssVar('surface-2', designTokens.colors.surface3);
  expectCssVar('accent', designTokens.colors.accent);
  expectCssVar('accent-strong', designTokens.colors.accentStrong);
  expectCssVar('success', designTokens.colors.success);
  expectCssVar('danger', designTokens.colors.danger);
  expectCssVar('locked', designTokens.colors.locked);
  expectCssVar('radius-sm', `${designTokens.radius.sm}px`);
  expectCssVar('radius-md', `${designTokens.radius.md}px`);
  expectCssVar('radius-lg', `${designTokens.radius.lg}px`);
  expectCssVar('route-station-gap', `${designTokens.path.stationGap}px`);
  expectCssVar('route-section-gap', `${designTokens.path.sectionGap}px`);
  expectCssVar('route-dictionary-gap', `${designTokens.path.dictionaryGap}px`);
  expectCssVar('route-scale-dot-size', `${designTokens.path.scaleDotSize}px`);
  expectCssVar('route-scale-diamond-size', `${designTokens.path.scaleDiamondSize}px`);
  expectCssVar('station-size', `${designTokens.path.stationSize}px`);
});
