import Svg, { Path, type SvgProps } from 'react-native-svg';

import { theme } from '@/src/mobile/theme';

export type AlanIconName =
  | 'account'
  | 'artifact'
  | 'back'
  | 'chevron'
  | 'close'
  | 'correct'
  | 'favorite'
  | 'help'
  | 'info'
  | 'learn'
  | 'list'
  | 'locked'
  | 'mastered'
  | 'match'
  | 'milestone'
  | 'path'
  | 'pause'
  | 'play'
  | 'practice'
  | 'profile'
  | 'review'
  | 'search'
  | 'settings'
  | 'songs'
  | 'station'
  | 'test'
  | 'undo'
  | 'wrong';

const ICON_PATHS: Record<AlanIconName, string> = {
  account: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v3h16v-3c0-2.76-3.58-5-8-5Z',
  artifact: 'M12 2 4 6v6c0 5.55 3.84 9.74 8 10 4.16-.26 8-4.45 8-10V6l-8-4Z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z',
  chevron: 'm8.6 4.6 1.4-1.4 8.8 8.8-8.8 8.8-1.4-1.4 7.4-7.4-7.4-7.4Z',
  close: 'm19 6.41-1.41-1.41L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z',
  correct: 'm9 16.17-4.17-4.17-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z',
  favorite: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z',
  help: 'M11 18h2v2h-2v-2Zm1-16a7 7 0 0 0-7 7h2a5 5 0 1 1 6.1 4.87C11.82 14.2 11 15.3 11 16.5V17h2v-.5c0-.31.25-.55.76-.69A7 7 0 0 0 12 2Z',
  info: 'M11 10h2v8h-2v-8Zm0-4h2v2h-2V6Zm1-4a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z',
  learn: 'M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3Z',
  list: 'M5 5h3v3H5V5Zm5 0h9v3h-9V5ZM5 10.5h3v3H5v-3Zm5 0h9v3h-9v-3ZM5 16h3v3H5v-3Zm5 0h9v3h-9v-3Z',
  locked: 'M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2Z',
  mastered: 'M12 2 9.2 7.7 3 8.6l4.5 4.4-1.1 6.2 5.6-2.9 5.6 2.9-1.1-6.2L21 8.6l-6.2-.9L12 2Z',
  match: 'M7 5h10l-2-2 1.4-1.4L20.8 6l-4.4 4.4L15 9l2-2H7V5Zm10 14H7l2 2-1.4 1.4L3.2 18l4.4-4.4L9 15l-2 2h10v2Z',
  milestone: 'M5 3h14v4H5V3Zm2 6h10v12H7V9Z',
  path: 'M3 20 9.5 9l3 5L16 8l5 12H3Z',
  pause: 'M6 4h4v16H6V4Zm8 0h4v16h-4V4Z',
  play: 'M8 5v14l11-7L8 5Z',
  practice: 'M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z',
  profile: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z',
  review: 'M12 4V1L8 5l4 4V6a6 6 0 1 1-5.65 8H4.26A8 8 0 1 0 12 4Z',
  search: 'M10 3a7 7 0 1 0 4.9 12L20 20l1-1-5.1-5A7 7 0 0 0 10 3Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z',
  settings: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
  songs: 'M10 3v12.2A4 4 0 1 0 12 19V8h7V3h-9Z',
  station: 'M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Z',
  test: 'M7 2h10v3h3v17H4V5h3V2Z',
  undo: 'M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6H6v2h6a8 8 0 0 0 0-16Z',
  wrong: 'm19 6.41-1.41-1.41L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z',
};

export function AlanIcon({
  name,
  size = 24,
  color = theme.colors.text,
  ...props
}: Omit<SvgProps, 'color' | 'height' | 'width'> & { name: AlanIconName; size?: number; color?: string }) {
  return (
    <Svg accessibilityElementsHidden focusable={false} height={size} viewBox="0 0 24 24" width={size} {...props}>
      <Path d={ICON_PATHS[name]} fill={color} />
    </Svg>
  );
}
