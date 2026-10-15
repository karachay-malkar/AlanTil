#!/usr/bin/env python3
"""Bake the bonded 17.6 architectural window from AlanTil's 36 original rocks.

No cuboids, noise geometry or runtime stone packing. The masonry and the single
stone lintel share exactly the PBR palette used by the 17.5.2 wall library.
"""
from __future__ import annotations
import importlib.util
from pathlib import Path
import numpy as np
import trimesh

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('wall_baker', ROOT / 'tools/tower/build-prefab-library.py')
wall = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wall)
SOURCE = ROOT / 'assets/tower/source-original-36.glb'
OUTPUT = ROOT / 'assets/tower/prefabs/architectural/window-4x5x2-v2.glb'
RNG = np.random.default_rng(1760202)
# Original authored stones only; skip extremely thin or spike-shaped rocks.
CHOICES = (0,3,5,7,10,11,12,14,15,18,19,20,23,24,25,26,27,29,31,32,33,34,35)


def select_model(models, intended):
    """Choose natural source rock needing the least shape distortion."""
    pool = RNG.choice(CHOICES, size=11, replace=False)
    ranked = []
    for index in pool:
        model = models[int(index)]
        stretch = intended / np.maximum(model['aspect'], .08)
        distortion = float(max(stretch) / min(stretch))
        natural = abs(model['fullness'] - .64)
        ranked.append((np.log(distortion) + natural * .9 + RNG.random()*.15, int(index)))
    return models[min(ranked)[1]]


def stone(models, bounds, shade=None):
    lo, hi = map(lambda a: np.asarray(a, dtype=float), bounds)
    dimensions = hi - lo
    if min(dimensions) <= 0:
        raise ValueError('Invalid stone bounds')
    model = select_model(models, dimensions)
    scale = dimensions / model['aspect']
    centre = (lo + hi) / 2
    colour = wall.PALETTE[int(RNG.integers(len(wall.PALETTE)))] if shade is None else shade
    return wall.make_mesh(model, scale, centre, colour)


def cuts(lo, hi, count, row, pier):
    if count == 1:
        return [lo, hi]
    weight = RNG.uniform(.77, 1.24, count)
    if count == 2:
        weight = np.array([1.2, .8]) if (row + pier) % 2 == 0 else np.array([.82, 1.18])
    points = lo + np.r_[0, (np.cumsum(weight) / weight.sum())] * (hi-lo)
    return points.tolist()


def bake():
    models = wall.normalized_rocks(SOURCE)
    parts, courses, profiles = [], [], {'left': [], 'right': []}
    for pier in (0, 1):
        # Each 25cm wide pier carries the lintel; 0.50m clear central opening.
        xmin, xmax = (-.5, -.25) if pier == 0 else (.25, .5)
        nrows = 9
        heights = RNG.uniform(.80, 1.20, nrows)
        heights /= heights.sum()
        ycuts = -.625 + np.r_[0, np.cumsum(heights)]
        ycuts[-1] = .375
        for row in range(nrows):
            yl, yh = ycuts[row], ycuts[row + 1]
            # Intermittent through-stones bind front and rear faces.
            depth_count = 1 if row % 4 == (1 if pier else 2) else (3 if row % 3 == 0 else 2)
            zcuts = cuts(-.25, .25, depth_count, row, pier)
            seams = []
            for depth in range(depth_count):
                zl, zh = zcuts[depth:depth + 2]
                # Sometimes use two side-by-side stones; next course bonds the seam.
                width_count = 2 if (row + depth + pier) % 4 == 0 and depth_count > 1 else 1
                xcuts = cuts(xmin, xmax, width_count, row + depth, pier)
                seams.append((round(zl,4), round(zh,4), width_count))
                for col in range(width_count):
                    xl, xh = xcuts[col:col + 2]
                    # Interpenetrate hidden joints slightly; protect clear aperture.
                    pad = .0015
                    bottom = yl if row == 0 else yl - .008
                    top = yh if row == nrows - 1 else yh + .008
                    rear = zl if depth == 0 else zl - .009
                    front = zh if depth == depth_count - 1 else zh + .009
                    piece = stone(models, ([xl+pad,bottom,rear], [xh-pad,top,front]))
                    parts.append(piece)
            courses.append((pier, row, round(float(yl),4), round(float(yh),4), seams))
            profiles['left' if pier == 0 else 'right'].append((float(yl),float(yh),tuple(zcuts)))
    # ONE monolithic stone lintel; original Rock013 is naturally flat and irregular.
    lintel = models[12]
    extents=np.array([.984,.244,.484]); scale=extents/lintel['aspect']
    parts.append(wall.make_mesh(lintel,scale,[0,.498,0],wall.PALETTE[2]))
    if len(parts) < 36 or len(parts) > 100:
        raise AssertionError(f'Unexpected count: {len(parts)}')
    assert abs(ycuts[-1]-.375)<1e-7
    assert all((p.bounds[1]-p.bounds[0]).min()>.035 for p in parts)
    # Distinct neighbouring side profiles are the anti-stacked-stones invariant.
    for side in profiles.values():
        for a,b in zip(side,side[1:]):
            internal_a=set(np.round(a[2][1:-1],3))
            internal_b=set(np.round(b[2][1:-1],3))
            if internal_a and internal_b and internal_a == internal_b:
                raise AssertionError('Unbonded successive stone courses')
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    scene = wall.authored_prefab_scene(parts,'AlanTil 17.6 bonded window 4x5x2')
    scene.export(OUTPUT,file_type='glb')
    check=trimesh.load(OUTPUT,force='scene')
    assert len(check.geometry)<=4
    bounds=check.bounds
    assert np.all(bounds[0]>=[-.501,-.627,-.251]) and np.all(bounds[1]<=[.501,.627,.251]), bounds
    print(f'WINDOW_BONDED_OK stones={len(parts)} meshes={len(check.geometry)} faces={sum(len(g.faces) for g in check.geometry.values())} bytes={OUTPUT.stat().st_size}',flush=True)
    return OUTPUT


if __name__ == '__main__':
    bake()
