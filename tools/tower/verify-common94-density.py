#!/usr/bin/env python3
"""Independent offline stone-masonry density gate. Never trusts a recipe's claimed occupancy.

A convex-hull sample is an *upper bound* on occupied space. If that upper
bound is < 0.90, a section conclusively fails without expensive raycasting.
Only surviving candidates receive real triangle-mesh point-in-solid checks.
No clipping, manufactured boxes, overlap inflation or mesh deformation.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
import trimesh

CELL = .25
TARGET = .90
PROXY_PITCH = .025
SOLID_PITCH = .0125
OVERLAP_CAP = .08


def load_geometry(path):
    scene = trimesh.load(path, force='scene', process=False)
    if len(scene.geometry) != 94:
        raise ValueError(f'Expected exactly 94 shared stone geometries, found {len(scene.geometry)}')
    return dict(scene.geometry)


def matrices(recipe):
    for row in recipe.get('placement', []):
        if not isinstance(row, list) or len(row) != 13 or not isinstance(row[0], str):
            raise ValueError('Expected named stone plus 3x4 transform')
        data = np.asarray(row[1:], dtype=float)
        if not np.isfinite(data).all():
            raise ValueError('Stone transform contains nonfinite values')
        yield row[0], data.reshape(3, 4)


def sample_grid(kind, pitch):
    dims = np.asarray([int(i) * CELL for i in kind.split('x')], dtype=float)
    resolution = np.rint(dims / pitch).astype(int)
    if len(dims) != 3 or np.any(resolution < 4):
        raise ValueError('Invalid section dimensions')
    return dims, resolution


def touched_cells(mesh, matrix, dims, resolution, exact=False):
    A = matrix[:, :3]
    t = matrix[:, 3]
    if np.linalg.det(A) <= 1e-10:
        raise ValueError('Stone transform is mirrored or singular')
    # Do not silently clip out-of-bounds vertices.
    world = mesh.vertices @ A.T + t
    if np.any(world.min(axis=0) < -dims / 2 - .003) or np.any(world.max(axis=0) > dims / 2 + .003):
        raise ValueError('Stone escapes cell-boundary by >3mm')
    lo = np.maximum(0, np.floor((world.min(axis=0) + dims / 2) / (dims / resolution)).astype(int))
    hi = np.minimum(resolution, np.ceil((world.max(axis=0) + dims / 2) / (dims / resolution)).astype(int))
    if np.any(hi <= lo):
        return None
    axes = [(np.arange(lo[k], hi[k]) + .5) * (dims[k] / resolution[k]) - dims[k] / 2 for k in range(3)]
    pts = np.stack(np.meshgrid(*axes, indexing='ij'), axis=-1).reshape(-1, 3)
    local = (pts - t) @ np.linalg.inv(A).T
    if exact:
        if not mesh.is_volume:
            raise ValueError('Exact-solid certification requires watertight outward-facing meshes')
        occupied = np.concatenate([mesh.contains(part) for part in np.array_split(local, max(1, (len(local) + 999) // 1000))])
    else:
        hull = ConvexHull(mesh.vertices)
        occupied = np.ones(len(local), dtype=bool)
        for eq in hull.equations:
            occupied &= (local @ eq[:3] + eq[3] <= 1e-7)
            if not occupied.any():
                break
    return tuple(slice(int(a), int(b)) for a, b in zip(lo, hi)), occupied.reshape(tuple(hi - lo))


def compute_coverage(kind, recipe, geom, pitch, exact=False):
    dims, resolution = sample_grid(kind, pitch)
    covered = np.zeros(tuple(resolution), dtype=bool)
    collided = 0
    attempted = 0
    for name, matrix in matrices(recipe):
        if name not in geom:
            raise ValueError(f'Unknown model: {name}')
        sampled = touched_cells(geom[name], matrix, dims, resolution, exact=exact)
        if sampled is None:
            continue
        extent, mask = sampled
        sub = covered[extent]
        collided += int(np.count_nonzero(sub & mask))
        attempted += int(np.count_nonzero(mask))
        sub |= mask
    density = float(covered.mean())
    overlap = collided / max(1, attempted)
    return {'density': round(density, 5),
            'overlapFraction': round(overlap, 5),
            'stones': len(recipe['placement']),
            'samples': int(covered.size),
            'metric': 'actual-triangle-solid' if exact else 'convex-upper-bound'}


def assess(kind, recipe, geom, min_density=TARGET):
    upper = compute_coverage(kind, recipe, geom, PROXY_PITCH)
    result = {'section': kind, 'convexUpperBound': upper}
    if upper['density'] + 1e-9 < min_density:
        result.update(passed=False, reason='convex upper bound below required real-solid density',
                      measuredActual=False)
        return result
    if upper['overlapFraction'] > OVERLAP_CAP:
        result.update(passed=False, reason='too much overlapping solid proxy geometry',
                      measuredActual=False)
        return result
    exact = compute_coverage(kind, recipe, geom, SOLID_PITCH, exact=True)
    result.update(actual=exact, measuredActual=True,
                  passed=exact['density'] >= min_density and exact['overlapFraction'] <= OVERLAP_CAP)
    if not result['passed']:
        result['reason'] = 'triangle-solid occupancy or overlap below acceptance limits'
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--library', default='assets/tower/prefabs/common94/common-94.glb')
    ap.add_argument('--recipes', required=True)
    ap.add_argument('--report', required=True)
    ap.add_argument('--min-density', type=float, default=TARGET)
    ap.add_argument('--require-pass', action='store_true')
    opts = ap.parse_args()
    if not 0 < opts.min_density <= 1:
        raise ValueError('Invalid density threshold')
    geometry = load_geometry(Path(opts.library))
    pack = json.loads(Path(opts.recipes).read_text('utf8'))
    rows = []
    for kind, variants in pack['variants'].items():
        for index, recipe in enumerate(variants):
            result = assess(kind, recipe, geometry, opts.min_density)
            result['variant'] = index
            rows.append(result)
            print('CHECK', kind, index, result['convexUpperBound']['density'],
                  'PASS' if result['passed'] else 'FAIL', result.get('reason', ''), flush=True)
    out = {'targetActualDensity': opts.min_density, 'tested': len(rows),
           'passes': sum(r['passed'] for r in rows),
           'approved': bool(rows) and all(r['passed'] for r in rows),
           'rows': rows}
    p = Path(opts.report)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(out, indent=2, ensure_ascii=False) + '\n', encoding='utf8')
    if opts.require_pass and not out['approved']:
        raise SystemExit('DENIED: actual density of at least 0.90 is NOT independently proven')


if __name__ == '__main__':
    main()
