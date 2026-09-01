import { forwardRef, useMemo } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { useSettings } from '@/src/mobile/settings';
import { textSizeScale } from '@/src/mobile/typography-policy';

export { textSizeScale } from '@/src/mobile/typography-policy';

function rounded(value: number) {
  return Math.round(value * 2) / 2;
}

export function scaledTextMetrics(style: StyleProp<TextStyle>, scale: number): TextStyle | undefined {
  if (scale === 1) return undefined;
  const flat = StyleSheet.flatten(style);
  if (!flat) return undefined;
  const fontSize = typeof flat.fontSize === 'number' ? rounded(flat.fontSize * scale) : undefined;
  const lineHeight = typeof flat.lineHeight === 'number' ? rounded(flat.lineHeight * scale) : undefined;
  if (fontSize === undefined && lineHeight === undefined) return undefined;
  return { fontSize, lineHeight };
}

export function useTextScale() {
  const { settings } = useSettings();
  return textSizeScale(settings.text_size_code);
}

export const AppText = forwardRef<NativeText, TextProps & { unscaled?: boolean }>(function AppText({ style, unscaled = false, ...props }, ref) {
  const scale = useTextScale();
  const metrics = useMemo(() => scaledTextMetrics(style, unscaled ? 1 : scale), [scale, style, unscaled]);
  return <NativeText ref={ref} style={[style, metrics]} {...props} />;
});
