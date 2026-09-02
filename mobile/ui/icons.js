import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

function IconBase({ size = 22, color = 'currentColor', children, fill = 'none' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill={fill}>{React.Children.map(children, (child) => React.cloneElement(child, { color }))}</Svg>;
}

export function PracticeIcon({ size = 20, color = '#666158' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={color} d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" /></Svg>;
}

export function PathIcon({ size = 22, color = '#666158' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={color} d="M3 20 9.5 9l3 5L16 8l5 12H3z" /></Svg>;
}

export function ProfileIcon({ size = 20, color = '#666158' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={color} d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z" /></Svg>;
}

export function FavoriteIcon({ size = 22, color = '#918b80', filled = true }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={filled ? color : 'none'} stroke={filled ? 'none' : color} strokeWidth="1.5" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z" /></Svg>;
}

export function ListChecksIcon({ size = 22, color = '#666158' }) {
  return <IconBase size={size} color={color}><Path d="m3 5 2 2 4-4M3 12l2 2 4-4M3 19l2 2 4-4M13 6h8M13 13h8M13 20h8" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>;
}

export function PuzzleIcon({ size = 22, color = '#666158' }) {
  return <IconBase size={size} color={color}><Path d="M19.4 15a1.7 1.7 0 0 0-1.4.7 1.7 1.7 0 0 0-.3 1.6l.3 1.7h-5v-1.7a1.7 1.7 0 1 0-3.4 0V19H5v-4.6h1.7a1.7 1.7 0 1 0 0-3.4H5V6h5V4.3a1.7 1.7 0 1 1 3.4 0V6H18v5h1.7a1.7 1.7 0 0 1-.3 4Z" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></IconBase>;
}

export function MusicIcon({ size = 22, color = '#666158' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx="8" cy="18" r="3" stroke={color} strokeWidth="1.7"/><Circle cx="18" cy="16" r="3" stroke={color} strokeWidth="1.7"/><Path d="M11 18V5l10-2v13M11 9l10-2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}

export function BackIcon({ size = 20, color = '#666158' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Path d="m15 18-6-6 6-6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><Path d="M9 12h10" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></Svg>;
}

export function InfoIcon({ size = 20, color = '#666158' }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none"><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6"/><Path d="M12 10v7M12 7h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></Svg>;
}
