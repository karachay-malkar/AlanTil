#!/usr/bin/env python3
"""Experimental 94-rock densely-filled wall recipes. Never switches the live catalog."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import math
import numpy as np
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEGACY = ROOT / 'tools/tower/bake-dense-compact-1758.py'
COMMON = ROOT / 'assets/tower/prefabs/common94/common-94.glb'
SOURCE = ROOT / 'assets/tower/prefabs/balkar71/placements-17_5_5.json'
OUTPUT = ROOT / 'assets/tower/prefabs/common94/candidate-placements-17_7.json'
SIZES = ['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4']



def is_medium_elongated(name, shape):
    """Natural medium elongated stone, never a box or a synthetic stretched mesh.

    Ratio is on the ORIGINAL untransformed geometry. Camera-facing orientation
    is selected separately; the GLB triangles are immutable.
    """
    if name.startswith(('CHINK_', 'LINTEL_', 'Zh_')):
        return False
    e = np.asarray(shape['extents'], dtype=float)
    if np.min(e) <= 0:
        return False
    sorted_e = np.sort(e)
    return (.28 <= sorted_e[2] <= .72 and
            sorted_e[2] / sorted_e[1] >= 1.20 and
            sorted_e[2] / sorted_e[0] >= 1.37)


def profile_for_instance(shape, row):
    """Measured on transformed vertices; used to review existing coarse stones."""
    m = legacy_matrix(row)
    verts = shape['vertices'] @ m[:3, :3].T
    d = np.ptp(verts, axis=0)
    long_xz = max(float(d[0]), float(d[2]))
    short_xz = max(1e-7, min(float(d[0]), float(d[2])))
    return (long_xz >= .17 and long_xz / max(float(d[1]), 1e-7) >= 1.25
            and long_xz / short_xz >= 1.12)


def legacy_matrix(row):
    return np.array([row[1:5], row[5:9], row[9:13], [0, 0, 0, 1]], dtype=float)


def curated_base(placement, shapes):
    """Preserve the best original course stones, repack coarse irregular voids.

    Only new candidate layouts use this reduction. Original approved placement
    recipes and all user-saved sections remain untouched.
    """
    retained = []
    excluded = 0
    for idx, row in enumerate(placement):
        name = row[0]
        if name not in shapes:
            raise ValueError('Original stone missing from common94: ' + name)
        preferred = is_medium_elongated(name, shapes[name]) and profile_for_instance(shapes[name], row)
        # Keep every fourth other stone as a tie/binder; do not produce
        # one-shape wallpaper or remove all non-elongated support stones.
        if preferred or idx % 4 == 0:
            retained.append(row)
        else:
            excluded += 1
    if not retained and placement:
        retained = [placement[0]]
        excluded = len(placement) - 1
    return retained, excluded


def adaptive_candidate(mod, field, shapes, names, location, radius, rng, phase):
    """Prefer medium elongated horizontal stones while voids are large.

    Remaining narrow joints receive only the 29 original CHINK_* meshes.
    An elongated rough profile means NOT a manufactured rectangular block.
    """
    medium = [n for n in names if is_medium_elongated(n, shapes[n])]
    chinks = [n for n in names if n.startswith('CHINK_')]
    if not medium or len(chinks) != 29:
        raise ValueError('Missing medium horizontal source rocks or 29 chinks')
    best = None
    for attempt in range(64):
        broad_void = phase == 0 and radius >= .055
        # Strong but not exclusive preference; final attempts always allow
        # a little irregular rubble when elongated candidates cannot fit.
        use_medium = broad_void and (attempt < 48) and (rng.random() < .83)
        pool = medium if use_medium else chinks
        name = pool[int(rng.integers(len(pool)))]
        shape = shapes[name]
        ext = shape['extents']
        long = int(np.argmax(ext))
        rx = (math.pi/2 if long == 1 else 0.) + rng.uniform(-.09,.09)
        yaw = int(rng.integers(4)) * math.pi/2 + rng.uniform(-.23,.23)
        R = mod.rotation(rx, yaw, rng.uniform(-.09,.09))
        unscaled = np.abs(R) @ ext
        if unscaled[1] > .9 * max(unscaled[0], unscaled[2]):
            continue
        if use_medium:
            # Medium stones remain substantial and predominantly horizontal.
            diameter = float(np.clip(radius * rng.uniform(1.7,3.3), .17, .48))
        else:
            factor = rng.uniform(.6,1.6) * (rng.uniform(.5,.95) if attempt>36 else 1.)
            diameter = float(np.clip(radius * factor, .024, .19))
        scale = diameter / max(unscaled)
        if np.any(unscaled*scale > field.dims-.003):
            scale *= float(np.min((field.dims-.003)/np.maximum(unscaled*scale,1e-8)))
        A = R * scale
        xyz = shape['vertices'] @ A.T
        lo = -field.dims/2+.001-xyz.min(axis=0)
        hi = field.dims/2-.001-xyz.max(axis=0)
        if np.any(lo>hi):
            continue
        ctr = (shape['vertices'].max(0)+shape['vertices'].min(0))/2
        M = np.eye(4)
        M[:3,:3] = A
        M[:3,3] = np.clip(location-A@ctr+rng.uniform(-.006,.006,3),lo,hi)
        trial = field.sample(shape,M,shape['planes'])
        if trial is None:
            continue
        count, overlap, *_ = trial
        if count < 2 or overlap/count > (.035 if use_medium else .055):
            continue
        score = count-6*overlap
        if score > 0 and (best is None or score>best[0]):
            best = (score,name,M,trial)
    return best



def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pilot', action='store_true', help='Only first two small sizes, first variation each')
    ap.add_argument('--max-stones', type=int, default=1024)
    ap.add_argument('--out', default=str(OUTPUT))
    args = ap.parse_args()
    if args.max_stones < 50 or args.max_stones > 4096:
        raise ValueError('Stone count outside QA budget')
    spec = importlib.util.spec_from_file_location('legacy_bake', LEGACY)
    legacy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(legacy)
    legacy.LIBRARY = COMMON
    legacy.SOURCE = SOURCE
    legacy.VERSION = '17.7-elongated-candidate.1'
    legacy.MAX_STONES = args.max_stones
    legacy.MAX_ATTEMPTS = 240
    legacy.PITCH = .0125
    legacy.candidates=lambda field, shapes, names, location, radius, rng, phase: adaptive_candidate(legacy,field,shapes,names,location,radius,rng,phase)
    pack = json.loads(SOURCE.read_text('utf8'))
    shapes = legacy.source_geometry()
    allowed = {k:v for k,v in shapes.items() if not k.startswith('LINTEL_')}
    assert len(shapes) == 94 and len(allowed) == 92
    combos = [(size,v) for size in SIZES for v in range(5)]
    if args.pilot:
        combos = [('1x1x1',0),('2x2x2',0)]
    variants = {}
    for kind,variant in combos:
        base=pack['variants'][kind][variant]
        selected, excluded=curated_base(base['placement'], allowed)
        candidate_pack={'variants': {kind: list(pack['variants'][kind])}}
        candidate_pack['variants'][kind][variant]={**base, 'placement': selected}
        recipe=legacy.bake_case(kind,variant,candidate_pack,allowed,verbose=False)
        main=[x for x in recipe['placement'] if not x[0].startswith('CHINK_')]
        medium_names={n for n,v in allowed.items() if is_medium_elongated(n,v)}
        elongated=[x for x in main if x[0] in medium_names and profile_for_instance(allowed[x[0]],x)]
        recipe['elongatedMedium'] = len(elongated)
        recipe['coarseStones'] = len(main)
        recipe['coarseElongatedShare'] = round(len(elongated)/max(1,len(main)),5)
        recipe['replacedLegacyCoarse'] = excluded
        recipe['metric'] = 'preliminary convex proxy; visual gap closure not certified'
        variants.setdefault(kind,{})[variant] = recipe
        print('CANDIDATE',kind,variant,'stones',len(recipe['placement']),
              'medium',len(elongated),'/',len(main),
              'proxyDensity',recipe['occupancy'],flush=True)
    result = {'version':'17.7-elongated-candidate.1','cellMeters':.25,
              'library':'/assets/tower/prefabs/common94/common-94.glb',
              'shapes':list(shapes), 'variants':{k:[v[i] for i in sorted(v)] for k,v in variants.items()},
              'totalPlacements':sum(len(v['placement']) for vs in variants.values() for v in vs.values()),
              'provenance':'63 original irregular stones plus 29 new small rocks; single-stone lintels reserved for apertures',
              'originalRecipeSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest()}
    target = Path(args.out)
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    print('WRITTEN',target,'cases',len(combos), 'bytes',target.stat().st_size,flush=True)


if __name__ == '__main__':
    main()
