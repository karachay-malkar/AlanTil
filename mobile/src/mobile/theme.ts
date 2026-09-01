import { designTokens } from '../../../packages/alantil-design/tokens.js';

export const theme = {
  fonts: {
    mono: 'monospace',
  },
  colors: {
    text: designTokens.colors.text,
    textMuted: designTokens.colors.textMuted,
    textSoft: designTokens.colors.textSoft,
    inverse: designTokens.colors.inverse,
    background: designTokens.colors.background,
    backgroundDeep: designTokens.colors.backgroundDeep,
    surface: designTokens.colors.surface,
    surface2: designTokens.colors.surface2,
    surface3: designTokens.colors.surface3,
    line: designTokens.colors.line,
    lineSoft: designTokens.colors.lineSoft,
    accent: designTokens.colors.accent,
    accentStrong: designTokens.colors.accentStrong,
    success: designTokens.colors.success,
    danger: designTokens.colors.danger,
    locked: designTokens.colors.locked,
  },
  radius: {
    sm: designTokens.radius.sm,
    md: designTokens.radius.md,
    lg: designTokens.radius.lg,
    pill: designTokens.radius.pill,
  },
  space: {
    xs: designTokens.space.xs,
    sm: designTokens.space.sm,
    md: designTokens.space.md,
    lg: designTokens.space.lg,
    xl: designTokens.space.xl,
    xxl: designTokens.space.xxl,
    xxxl: designTokens.space.xxxl,
  },
  typography: designTokens.typography,
  controls: designTokens.controls,
  path: designTokens.path,
} as const;
