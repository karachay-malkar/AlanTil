import { UI_TOKENS } from './tokens.js';

// Web 13.15.12, commit 3249e0d: theme.css --text-display/--text-result.
// Width is the viewport in CSS pixels / native layout points, never physical pixels.
export const ADAPTIVE_TYPE = Object.freeze({
  small: Object.freeze({ display: [24, 7, 40], result: [36, 12, 54] }),
  medium: Object.freeze({ display: [28, 8, 48], result: [40, 14, 64] }),
  large: Object.freeze({ display: [32, 9, 56], result: [44, 15, 72] }),
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
