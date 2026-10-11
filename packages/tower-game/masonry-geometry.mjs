import {regularizedRockMesh} from './rock-shapes.mjs';
import {worldDimensions} from './core.mjs';

const OTHER_AXES = [[1, 2], [0, 2], [0, 1]];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Rasterize the actual stone meshes as three double-sided silhouette depth fields.
 * Unlike AABB seam heuristics, this can distinguish faceted rock from empty space.
 * Source models need not be watertight. */
export function buildStoneProfiles(pack, resolution = 40) {
  if (!Number.isInteger(resolution) || resolution < 12 || resolution > 96) throw new RangeError('Invalid resolution');
  const profiles = {};
  for (const [category, entries] of Object.entries(pack)) {
    profiles[category] = entries.map((source,variant) => {
      const mesh=regularizedRockMesh(source,variant);
      const vertexCount=mesh.positions.length/3,faceCount=mesh.indices.length/3;
      const verts=Array.from({length:vertexCount},(_,i)=>[
        mesh.positions[i*3]+.5,mesh.positions[i*3+1]+.5,mesh.positions[i*3+2]+.5
      ]);
      const fields = OTHER_AXES.map(([u, v], axis) => {
        const min = new Float32Array(resolution * resolution).fill(Infinity);
        const max = new Float32Array(resolution * resolution).fill(-Infinity);
        for (let k = 0; k < faceCount; k++) {
          const o = k * 3;
          const a = verts[mesh.indices[o]], b = verts[mesh.indices[o + 1]], c = verts[mesh.indices[o + 2]];
          if (!a || !b || !c) continue;
          const determinant = (b[v] - c[v]) * (a[u] - c[u]) + (c[u] - b[u]) * (a[v] - c[v]);
          if (Math.abs(determinant) < 1e-9) continue;
          const ix0 = clamp(Math.floor(Math.min(a[u], b[u], c[u]) * resolution - .5), 0, resolution - 1);
          const ix1 = clamp(Math.ceil(Math.max(a[u], b[u], c[u]) * resolution - .5), 0, resolution - 1);
          const iy0 = clamp(Math.floor(Math.min(a[v], b[v], c[v]) * resolution - .5), 0, resolution - 1);
          const iy1 = clamp(Math.ceil(Math.max(a[v], b[v], c[v]) * resolution - .5), 0, resolution - 1);
          for (let j = iy0; j <= iy1; j++) for (let i = ix0; i <= ix1; i++) {
            const x = (i + .5) / resolution, y = (j + .5) / resolution;
            const w0 = ((b[v] - c[v]) * (x - c[u]) + (c[u] - b[u]) * (y - c[v])) / determinant;
            const w1 = ((c[v] - a[v]) * (x - c[u]) + (a[u] - c[u]) * (y - c[v])) / determinant;
            const w2 = 1 - w0 - w1;
            if (w0 < -.035 || w1 < -.035 || w2 < -.035) continue;
            const depth = w0 * a[axis] + w1 * b[axis] + w2 * c[axis];
            const n = j * resolution + i;
            min[n] = Math.min(min[n], depth);
            max[n] = Math.max(max[n], depth);
          }
        }
        // Fill minor silhouette raster pinholes caused by open source topology.
        for (let pass = 0; pass < 2; pass++) {
          const lo = min.slice(), hi = max.slice();
          for (let j = 0; j < resolution; j++) for (let i = 0; i < resolution; i++) {
            const n = j * resolution + i;
            if (Number.isFinite(lo[n])) continue;
            let near = Infinity, far = -Infinity, found = 0;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
              const x = i + dx, y = j + dy;
              if (x < 0 || y < 0 || x >= resolution || y >= resolution || !Number.isFinite(lo[y * resolution + x])) continue;
              near = Math.min(near, lo[y * resolution + x]);
              far = Math.max(far, hi[y * resolution + x]); found++;
            }
            if (found >= 3) { min[n] = near; max[n] = far; }
          }
        }
        return {min, max, resolution};
      });
      return fields;
    });
  }
  return profiles;
}

export function rockCategory(type) { return type === 'stone' ? 'small' : type; }

/** Point in the same grid cells and rock orientation as scene.js. */
export function rockContains(block, point, profiles, tolerance = .02) {
  const shapes = profiles[rockCategory(block.type)];
  if (!shapes?.length) return false;
  const fields = shapes[((block.variant || 0) % shapes.length + shapes.length) % shapes.length];
  const dim = worldDimensions(block);
  let x = point[0] - block.x - dim[0] / 2;
  let y = point[1] - block.y - dim[1] / 2;
  let z = point[2] - block.z - dim[2] / 2;
  const r = block.rotation || 0;
  if (r === 1) [x, z] = [-z, x];
  else if (r === 2) [x, z] = [-x, -z];
  else if (r === 3) [x, z] = [z, -x];
  else if (r === 4) [x, y] = [-y, x];
  else if (r === 5) [y, z] = [z, -y];
  const p = [x / block.sx + .5, y / block.sy + .5, z / block.sz + .5];
  if (p.some(v => v < 0 || v > 1)) return false;
  for (let axis = 0; axis < 3; axis++) {
    const [u, v] = OTHER_AXES[axis], field = fields[axis];
    const ix = clamp(Math.floor(p[u] * field.resolution), 0, field.resolution - 1);
    const iy = clamp(Math.floor(p[v] * field.resolution), 0, field.resolution - 1);
    const idx = iy * field.resolution + ix;
    if (!Number.isFinite(field.min[idx])) return false;
    if (p[axis] < field.min[idx] - tolerance || p[axis] > field.max[idx] + tolerance) return false;
  }
  return true;
}
