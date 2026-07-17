const PATHS = Object.freeze({
  route: '<circle cx="6" cy="19" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><circle cx="18" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/>',
  dumbbell: '<path d="m6.5 6.5 11 11M21 21l-1-1M3 3l1 1M18 22l4-4M2 6l4-4M3 10l7-7M14 21l7-7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  userRound: '<circle cx="12" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M20 21a8 8 0 0 0-16 0" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  listChecks: '<path d="m3 5 2 2 4-4M3 12l2 2 4-4M3 19l2 2 4-4M13 6h8M13 13h8M13 20h8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  puzzle: '<path d="M19.4 15a1.7 1.7 0 0 0-1.4.7 1.7 1.7 0 0 0-.3 1.6l.3 1.7h-5v-1.7a1.7 1.7 0 1 0-3.4 0V19H5v-4.6h1.7a1.7 1.7 0 1 0 0-3.4H5V6h5V4.3a1.7 1.7 0 1 1 3.4 0V6H18v5h1.7a1.7 1.7 0 0 1-.3 4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  music2: '<circle cx="8" cy="18" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="18" cy="16" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M11 18V5l10-2v13M11 9l10-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  brain: '<path d="M9.5 4.5a3 3 0 0 0-5 2.2 3 3 0 0 0-1 5.7A3.5 3.5 0 0 0 7 18h2.5V4.5Zm5 0a3 3 0 0 1 5 2.2 3 3 0 0 1 1 5.7A3.5 3.5 0 0 1 17 18h-2.5V4.5ZM9.5 9H7a2 2 0 0 1-2-2M14.5 9H17a2 2 0 0 0 2-2M9.5 14H7a2 2 0 0 0-2 2M14.5 14H17a2 2 0 0 1 2 2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6M9 12h10" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  undo2: '<path d="M9 7 4 12l5 5M4 12h9a7 7 0 1 1 0 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  lockKeyhole: '<rect x="3" y="11" width="18" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M7 11V7a5 5 0 0 1 10 0v4M12 15v2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  circleCheck: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="m8 12 2.5 2.5L16 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  chartCombined: '<path d="M3 3v18h18M7 16l4-5 4 3 5-7M7 19v-5M11 19v-3M15 19v-7M19 19V9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>',
  waypoint: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M3 12h6M15 12h6M12 3v6M12 15v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
  circleDot: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  back: '<path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>',
  path: '<path d="M3 20 9.5 9l3 5L16 8l5 12H3Zm7.3-7.2L7.2 18h6.2l-3.1-5.2Zm6-1.1L13.9.0 18h4.9l-2.4-6.3Z"/>',
  practice: '<path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"/>',
  profile: '<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-5 0-9 2.5-9 5.5V22h18v-2.5C21 16.5 17 14 12 14Z"/>',
  learn: '<path d="M4 3h13a3 3 0 0 1 3 3v15H7a3 3 0 0 1-3-3V3Zm3 14h11V6a1 1 0 0 0-1-1H6v12.17c.31-.11.65-.17 1-.17Zm0 2a1 1 0 0 0 0 2h11v-2H7Z"/>',
  test: '<path d="M7 2h10v3h3v17H4V5h3V2Zm2 3h6V4H9v1Zm-3 2v13h12V7h-1v2H7V7H6Zm3 5h6v2H9v-2Zm0 4h6v2H9v-2Z"/>',
  match: '<path d="M7 5h10l-2-2 1.4-1.4L20.8 6l-4.4 4.4L15 9l2-2H7V5Zm10 14H7l2 2-1.4 1.4L3.2 18l4.4-4.4L9 15l-2 2h10v2Z"/>',
  songs: '<path d="M10 3v12.2A4 4 0 1 0 12 19V8h7V3h-9Zm-2 18a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z"/>',
  favorite: '<path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.62L12 2 9.19 8.62 2 9.24l5.46 4.73L5.82 21 12 17.27Z"/>',
  undo: '<path d="M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6H6v2h6a8 8 0 0 0 0-16Z"/>',
  correct: '<path d="m9 16.17-4.17-4.17-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z"/>',
  wrong: '<path d="m19 6.41-1.41-1.41L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41Z"/>',
  locked: '<path d="M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2Zm-8-2a3 3 0 0 1 6 0v2H9V7Zm8 13H7v-9h10v9Z"/>',
  review: '<path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-5.65 8H4.26A8 8 0 1 0 12 4Z"/>',
  mastered: '<path d="M12 2 9.2 7.7 3 8.6l4.5 4.4-1.1 6.2L12 16.3l5.6 2.9-1.1-6.2L21 8.6l-6.2-.9L12 2Z"/>',
  settings: '<path d="M19.4 13a7.8 7.8 0 0 0 .05-1 7.8 7.8 0 0 0-.05-1l2.1-1.65-2-3.46-2.55 1.03a7.5 7.5 0 0 0-1.73-1L14.83 3h-4l-.39 2.92a7.5 7.5 0 0 0-1.73 1L6.16 5.89l-2 3.46L6.26 11a7.8 7.8 0 0 0-.05 1 7.8 7.8 0 0 0 .05 1l-2.1 1.65 2 3.46 2.55-1.03a7.5 7.5 0 0 0 1.73 1l.39 2.92h4l.39-2.92a7.5 7.5 0 0 0 1.73-1l2.55 1.03 2-3.46L19.4 13ZM12.83 16A4 4 0 1 1 12.83 8a4 4 0 0 1 0 8Z"/>',
  account: '<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v3h16v-3c0-2.76-3.58-5-8-5Z"/>',
  artifact: '<path d="M12 2 4 6v6c0 5.55 3.84 9.74 8 10 4.16-.26 8-4.45 8-10V6l-8-4Zm0 2.18L18 7v5c0 4.18-2.66 7.3-6 7.91C8.66 19.3 6 16.18 6 12V7l6-2.82Z"/>',
  milestone: '<path d="M5 3h14v4H5V3Zm2 6h10v12H7V9Zm2 2v8h6v-8H9Z"/>',
  station: '<path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 10a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z"/>',
  difficult: '<path d="M12 2 2 20h20L12 2Zm0 5.8 6.6 10.2H5.4L12 7.8ZM11 11v4h2v-4h-2Zm0 5v2h2v-2h-2Z"/>',
  chevron: '<path d="m9 18 6-6-6-6 1.4-1.4L17.8 12l-7.4 7.4L9 18Z"/>',
  search: '<path d="M9.5 3a6.5 6.5 0 1 0 3.98 11.64L19.85 21 21 19.85l-6.36-6.37A6.5 6.5 0 0 0 9.5 3Zm0 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Z"/>',
  play: '<path d="M8 5v14l11-7L8 5Z"/>',
  pause: '<path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z"/>',
});

export function uiIcon(name, className = "uiIcon") {
  const path = PATHS[name] || PATHS.artifact;
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${path}</svg>`;
}

export const STAR_ICON_SVG = uiIcon("favorite", "starSvg");
export const STATUS_OK_ICON_SVG = uiIcon("correct");
export const STATUS_BAD_ICON_SVG = uiIcon("wrong");
export const SEARCH_ICON_SVG = uiIcon("search");
export const PLAY_ICON_SVG = uiIcon("play");
export const PAUSE_ICON_SVG = uiIcon("pause");
