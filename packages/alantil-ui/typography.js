import { UI_TOKENS } from './tokens.js';

// Canonical typography has five roles: technical, body, button, accent and result.
// Button is reserved for interactive control labels; Body stays ordinary interface/content copy.
export const BRACKET_NAVIGATION_TEXT_ROLE = 'button';
export const BRACKET_NAVIGATION_LINE_HEIGHT = 1.35;
export const BRACKET_NAVIGATION_FONT_WEIGHT = '750';
export const BRACKET_NAVIGATION_ACTIVE_FONT_WEIGHT = '900';

export function bracketNavigationTextStyle(typography = {}, active = false) {
  const role = typography?.[BRACKET_NAVIGATION_TEXT_ROLE] || typography?.button || typography?.body;
  const fontSize = Number(role?.fontSize);
  if (!Number.isFinite(fontSize) || fontSize <= 0) return {};
  return {
    fontSize,
    lineHeight: fontSize * BRACKET_NAVIGATION_LINE_HEIGHT,
    fontWeight: active ? BRACKET_NAVIGATION_ACTIVE_FONT_WEIGHT : BRACKET_NAVIGATION_FONT_WEIGHT,
  };
}

export const ADAPTIVE_TYPE = Object.freeze({
  small: Object.freeze({ accent: [16, 0, 16], result: [48, 0, 48] }),
  medium: Object.freeze({ accent: [20, 0, 20], result: [48, 0, 48] }),
  large: Object.freeze({ accent: [24, 0, 24], result: [48, 0, 48] }),
  huge: Object.freeze({ accent: [28, 0, 28], result: [48, 0, 48] }),
});

export function resolveTypography(textSizeCode = 'medium', viewportWidth) {
  const code = Object.hasOwn(ADAPTIVE_TYPE, textSizeCode) ? textSizeCode : 'medium';
  const scale = UI_TOKENS.typeScale[code];
  const width = Number(viewportWidth);
  if (!Number.isFinite(width) || width <= 0) return { ...scale };
  const resolve = ([min, vw, max]) => Math.min(max, Math.max(min, width * vw / 100));
  return { ...scale, accent: resolve(ADAPTIVE_TYPE[code].accent), result: resolve(ADAPTIVE_TYPE[code].result) };
}

// Buttons use their own semantic scale. Technical typography remains reserved for data/status values.
export function buttonTextRole() {
  return 'button';
}

export function textMetrics(size, lineHeight = 1.2) {
  return { fontSize: size, lineHeight: size * lineHeight };
}
