import { UI_TOKENS } from './tokens.js';

// Compatibility shape for Web/Mobile consumers. Typography is intentionally fixed:
// each mode has technical/body/accent sizes, while result remains 48px.
export const ADAPTIVE_TYPE = Object.freeze({
  small: Object.freeze({ display: [16, 0, 16], result: [48, 0, 48] }),
  medium: Object.freeze({ display: [20, 0, 20], result: [48, 0, 48] }),
  large: Object.freeze({ display: [24, 0, 24], result: [48, 0, 48] }),
  huge: Object.freeze({ display: [28, 0, 28], result: [48, 0, 48] }),
});

export function resolveTypography(textSizeCode = 'medium', viewportWidth) {
  const code = Object.hasOwn(ADAPTIVE_TYPE, textSizeCode) ? textSizeCode : 'medium';
  const scale = UI_TOKENS.typeScale[code];
  const width = Number(viewportWidth);
  if (!Number.isFinite(width) || width <= 0) return { ...scale };
  const resolve = ([min, vw, max]) => Math.min(max, Math.max(min, width * vw / 100));
  return { ...scale, display: resolve(ADAPTIVE_TYPE[code].display), result: resolve(ADAPTIVE_TYPE[code].result) };
}

// The final Web typography layer changes size, while preserving feature weight/family.
export function buttonTextRole(role, spec) {
  if (role === 'songs.info') return 'emphasis';
  if (role === 'path.storyTab' || role === 'direction.choice') return 'caption';
  if (['compactPrimary', 'stationStudy', 'stationTest', 'settingsSmall'].includes(spec.style)) return 'micro';
  if (['headerText', 'textAction', 'match'].includes(spec.style)) return 'caption';
  return 'body';
}

export function textMetrics(size, lineHeight = 1.2) {
  return { fontSize: size, lineHeight: size * lineHeight };
}
