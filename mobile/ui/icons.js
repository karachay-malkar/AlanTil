import React from'react';
import Svg,{Circle,Path}from'react-native-svg';
function Fill({size=20,color='#666158',d}){return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={color} d={d}/></Svg>}
function Stroke({size=20,children}){return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">{children}</Svg>}
export function PracticeIcon({size=20,color='#666158'}){return <Fill size={size} color={color} d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"/>}
export function PathIcon({size=22,color='#666158'}){return <Fill size={size} color={color} d="M3 20 9.5 9l3 5L16 8l5 12H3Zm7.3-7.2L7.2 18h6.2l-3.1-5.2Zm6-1.1L13.9 18h4.9l-2.4-6.3Z"/>}
export function ProfileIcon({size=20,color='#666158'}){return <Fill size={size} color={color} d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z"/>}
export function FavoriteIcon({size=22,color='#918b80',filled=true}){return <Svg width={size} height={size} viewBox="0 0 24 24"><Path fill={filled?color:'none'} stroke={filled?'none':color} strokeWidth="1.5" d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z"/></Svg>}
export function ListChecksIcon({size=22,color='#666158'}){return <Stroke size={size}><Path d="m3 5 2 2 4-4M3 12l2 2 4-4M3 19l2 2 4-4M13 6h8M13 13h8M13 20h8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></Stroke>}
export function PuzzleIcon({size=22,color='#666158'}){return <Stroke size={size}><Path d="M19.4 15a1.7 1.7 0 0 0-1.4.7 1.7 1.7 0 0 0-.3 1.6l.3 1.7h-5v-1.7a1.7 1.7 0 1 0-3.4 0V19H5v-4.6h1.7a1.7 1.7 0 1 0 0-3.4H5V6h5V4.3a1.7 1.7 0 1 1 3.4 0V6H18v5h1.7a1.7 1.7 0 0 1-.3 4Z" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></Stroke>}
export function MusicIcon({size=22,color='#666158'}){return <Stroke size={size}><Circle cx="8" cy="18" r="3" stroke={color} strokeWidth="1.7"/><Circle cx="18" cy="16" r="3" stroke={color} strokeWidth="1.7"/><Path d="M11 18V5l10-2v13M11 9l10-2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></Stroke>}
export function BackIcon({size=20,color='#666158'}){return <Fill size={size} color={color} d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>}
export function SearchIcon({size=20,color='#666158'}){return <Fill size={size} color={color} d="M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"/>}
export function InfoIcon({size=20,color='#666158'}){return <Stroke size={size}><Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.6"/><Path d="M12 10v7M12 7h.01" stroke={color} strokeWidth="1.8" strokeLinecap="round"/></Stroke>}
export function PlayIcon({size=20,color='#f4efe6'}){return <Fill size={size} color={color} d="M8 5v14l11-7L8 5Z"/>}
export function PauseIcon({size=20,color='#f4efe6'}){return <Fill size={size} color={color} d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z"/>}
export function UndoIcon({size=20,color='#666158'}){return <Fill size={size} color={color} d="M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6H6v2h6a8 8 0 0 0 0-16Z"/>}
export function CorrectIcon({size=20,color='#5d7654'}){return <Fill size={size} color={color} d="m9 16.17-4.17-4.17-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"/>}
export function WrongIcon({size=20,color='#98564c'}){return <Fill size={size} color={color} d="m19 6.41-1.41-1.41L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"/>}
export function CloseIcon({size=20,color='#666158'}){return <Fill size={size} color={color} d="m19 6.41-1.41-1.41L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"/>}
export function LockedIcon({size=20,color='#666158'}){return <Fill size={size} color={color} d="M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2Zm-8-2a3 3 0 0 1 6 0v2H9V7Zm8 13H7v-9h10v9Z"/>}
export function ChevronIcon({size=20,color='#918b80'}){return <Fill size={size} color={color} d="m9 18 6-6-6-6 1.4-1.4L17.8 12l-7.4 7.4L9 18Z"/>}
