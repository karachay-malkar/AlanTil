export type TextSizeCode = 'small' | 'medium' | 'large';

export function textSizeScale(size: TextSizeCode) {
  if (size === 'small') return 0.9;
  if (size === 'large') return 1.15;
  return 1;
}
