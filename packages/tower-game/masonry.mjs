import {bounds} from './core.mjs';

// Render-only small stones. No IDs, balance changes, collision or support effects.
export const MASONRY_VERSION = 1;
const STONE_TYPES = new Set(['stone', 'medium', 'long', 'big']);
const OPENING_TYPES = new Set(['window', 'door']);
const overlap = (a0, a1, b0, b1) => [Math.max(a0, b0), Math.min(a1, b1)];
const noise = n => {
  let x = (Math.imul(n | 0, 0x45d9f3b) ^ (n >>> 16)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};
const seedFor = (plane, start, end, face, axis, side) =>
  Math.imul(Math.round(plane * 101 + start * 31 + end * 17 + face * 11), 374761393)
  ^ Math.imul(axis.charCodeAt(0) + side * 97 + MASONRY_VERSION, 668265263);
const hashKey = b => `${b.x}:${b.y}:${b.z}:${b.sx}:${b.sy}:${b.sz}:${b.rotation}:${b.id}`;

/**
 * Detect aligned outer-face joints of adjacent load-bearing blocks.
 * Coordinates and sizes are returned in 25-cm grid cells; visualization only.
 * No filler is generated in intentional window/door reservations.
 */
export function generateMasonry(blocks, {maxStones = 12000, layer = null} = {}) {
  if (!Array.isArray(blocks) || !Number.isFinite(maxStones) || maxStones <= 0) return [];
  const cap = Math.min(Math.floor(maxStones), 12000);
  const solids = blocks.filter(b => STONE_TYPES.has(b.type))
    .map(b => ({box: bounds(b), id: hashKey(b)}))
    .sort((a, b) => a.id.localeCompare(b.id));
  const openings = blocks.filter(b => OPENING_TYPES.has(b.type)).map(bounds);
  const result = [], planes = new Map();
  for (const solid of solids) {
    const b = solid.box;
    for (const axis of ['x', 'y', 'z']) {
      for (const [value, direction] of [[b[axis + '0'], 0], [b[axis + '1'], 1]]) {
        const key = `${axis}:${value}`;
        if (!planes.has(key)) planes.set(key, {a: [], b: []});
        planes.get(key)[direction ? 'b' : 'a'].push(solid);
      }
    }
  }
  function addJoint(axis, a, b, plane) {
    const first = axis === 'y' ? 'x' : 'y';
    const second = axis === 'z' ? 'x' : 'z';
    const [start, end] = overlap(a[first + '0'], a[first + '1'], b[first + '0'], b[first + '1']);
    const [crossStart, crossEnd] = overlap(a[second + '0'], a[second + '1'], b[second + '0'], b[second + '1']);
    if (end - start < .75 || crossEnd - crossStart < .75) return;
    // Only exterior seams, not internal contacts and unseen wall thickness.
    for (const side of [0, 1]) {
      const outer = side ? '1' : '0';
      if (a[second + outer] !== b[second + outer]) continue;
      const face = a[second + outer];
      const steps = Math.min(12, Math.floor((end - start) * 2));
      const seed = seedFor(plane, start, end, face, axis, side);
      for (let j = 0; j < steps && result.length < cap; j++) {
        const rnd = k => noise(seed ^ Math.imul(j + 17, 179426549) ^ Math.imul(k + 3, 14817913));
        const t = (j + .35 + rnd(0) * .3) / steps;
        const p = {x: 0, y: 0, z: 0};
        p[axis] = plane + (rnd(1) - .5) * .09;
        p[first] = start + (end - start) * t;
        p[second] = face + (side ? -.018 : .018);
        if (layer !== null && p.y > layer + 1) continue;
        if (openings.some(h => p.x > h.x0 - .16 && p.x < h.x1 + .16 && p.y > h.y0 - .16 && p.y < h.y1 + .16 && p.z > h.z0 - .16 && p.z < h.z1 + .16)) continue;
        const width = .17 + rnd(2) * .13;
        const length = .18 + rnd(3) * .15;
        const depth = .12 + rnd(4) * .09;
        const dimensions = {x: width, y: length, z: depth};
        dimensions[first] = length;
        dimensions[axis] = width;
        dimensions[second] = depth;
        result.push({...p, sx: dimensions.x, sy: dimensions.y, sz: dimensions.z,
          rotation: rnd(5) * Math.PI * 2, variant: Math.floor(rnd(6) * 7)});
      }
    }
  }
  for (const [key, sides] of planes) {
    if (result.length >= cap) break;
    const [axis, rawPlane] = key.split(':');
    // Index the two in-plane coordinates, so large walls avoid all-pairs scans.
    const axes = ['x', 'y', 'z'].filter(a => a !== axis);
    const tiles = new Map();
    const keysFor = box => {
      const keys = [];
      for (let a = Math.floor(box[axes[0]+'0']/4); a <= Math.floor((box[axes[0]+'1']-.001)/4); a++)
        for (let b = Math.floor(box[axes[1]+'0']/4); b <= Math.floor((box[axes[1]+'1']-.001)/4); b++) keys.push(a+':'+b);
      return keys;
    };
    for (const right of sides.a) for (const tile of keysFor(right.box)) {
      if (!tiles.has(tile)) tiles.set(tile, []);
      tiles.get(tile).push(right);
    }
    for (const left of sides.b) {
      if (result.length >= cap) break;
      const matches = new Map();
      for (const tile of keysFor(left.box))
        for (const right of tiles.get(tile) || []) matches.set(right.id, right);
      for (const right of [...matches.values()].sort((a,b)=>a.id.localeCompare(b.id))) {
        if (result.length >= cap) break;
        if (left === right) continue;
        addJoint(axis, left.box, right.box, Number(rawPlane));
      }
    }
  }
  return result;
}