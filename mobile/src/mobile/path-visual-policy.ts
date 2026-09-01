export type RoutePoint = { x: number; y: number };

export type RouteConnectorSegment = {
  left: number;
  top: number;
  width: number;
  angle: number;
};

export function routeWaveAmplitude(routeWidth: number) {
  const width = Number.isFinite(routeWidth) ? Math.max(0, routeWidth) : 0;
  return Math.max(42, Math.min(90, width * 0.22 || 64));
}

export function routeWaveShift(index: number, routeWidth: number) {
  const amplitude = routeWaveAmplitude(routeWidth);
  return [-amplitude, 0, amplitude, 0][Math.max(0, Math.floor(index)) % 4];
}

export function routeConnectorSegment(from: RoutePoint, to: RoutePoint): RouteConnectorSegment {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const width = Math.sqrt(dx * dx + dy * dy);
  return {
    left: (from.x + to.x - width) / 2,
    top: (from.y + to.y) / 2,
    width,
    angle: Math.atan2(dy, dx) * (180 / Math.PI),
  };
}

export function routeScaleState(scrollY: number, contentHeight: number, viewportHeight: number, itemCount: number) {
  const count = Math.max(0, Math.floor(itemCount));
  const maxScroll = Math.max(0, contentHeight - viewportHeight);
  const boundedScroll = Math.max(0, Math.min(maxScroll, scrollY));
  const routeProgress = maxScroll > 0 ? (maxScroll - boundedScroll) / maxScroll : 0;
  const passed = Math.round(routeProgress * count);
  return {
    passed,
    currentIndex: count ? Math.max(0, count - passed - 1) : -1,
  };
}

export function routeSectionDotCount(stationCount: number, totalStations: number) {
  if (stationCount <= 0 || totalStations <= 0) return 3;
  const share = stationCount / totalStations;
  return Math.max(3, Math.min(10, Math.round(3 + share * 24)));
}
