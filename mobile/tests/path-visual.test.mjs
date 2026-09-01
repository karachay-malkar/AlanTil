import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  routeConnectorSegment,
  routeScaleState,
  routeSectionDotCount,
  routeWaveAmplitude,
  routeWaveShift,
} from '../src/mobile/path-visual-policy.ts';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Path follows the final Web 13.15.12 alternating left/right station wave', () => {
  const shifts = Array.from({ length: 8 }, (_, index) => routeWaveShift(index, 360));
  assert.deepEqual(shifts, [-79.2, 79.2, -79.2, 79.2, -79.2, 79.2, -79.2, 79.2]);
  assert.equal(routeWaveAmplitude(200), 64);
  assert.equal(routeWaveAmplitude(1000), 90);
});

test('connector geometry joins the measured centers', () => {
  const segment = routeConnectorSegment({ x: 10, y: 10 }, { x: 40, y: 50 });
  assert.equal(segment.width, 50);
  assert.equal(segment.left, 0);
  assert.equal(segment.top, 30);
  assert.ok(Math.abs(segment.angle - 53.130102) < 0.0001);
});

test('scale mirrors bottom-to-top route progress and stays bounded', () => {
  assert.deepEqual(routeScaleState(800, 1000, 200, 10), { passed: 0, currentIndex: 9 });
  assert.deepEqual(routeScaleState(400, 1000, 200, 10), { passed: 5, currentIndex: 4 });
  assert.deepEqual(routeScaleState(0, 1000, 200, 10), { passed: 10, currentIndex: 0 });
  assert.equal(routeSectionDotCount(10, 100), 5);
});

test('mobile Path renders measured polyline, percentage rings and interactive scale', async () => {
  const source = await read('src/mobile/path.tsx');
  assert.match(source, /RouteConnector/);
  assert.match(source, /StationProgressRing/);
  assert.match(source, /routeWaveShift/);
  assert.match(source, /routeScaleState/);
  assert.match(source, /accessibilityRole="button"/);
});
