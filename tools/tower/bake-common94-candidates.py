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



def adaptive_candidate(mod, field, shapes, names, location, radius, rng, phase):
    """Best-fitting natural chinking rock: one rotation, one uniform scale."""
    best=None
    for attempt in range(36):
        name=names[int(rng.integers(len(names)))]
        shape=shapes[name]
        ext=shape['extents']
        long=int(np.argmax(ext))
        rx=(math.pi/2 if long==1 else 0)+rng.uniform(-.12,.12)
        yaw=int(rng.integers(4))*math.pi/2+rng.uniform(-.25,.25)
        R=mod.rotation(rx,yaw,rng.uniform(-.12,.12))
        unscaled=np.abs(R)@ext
        factor=rng.uniform(.65,1.6)*(rng.uniform(.5,.95) if attempt>20 else 1)
        diameter=float(np.clip(radius*factor,.024,.19))
        scale=diameter/max(unscaled)
        if np.any(unscaled*scale>field.dims-.003):
            scale*=float(np.min((field.dims-.003)/np.maximum(unscaled*scale,1e-8)))
        A=R*scale
        xyz=shape['vertices']@A.T
        lo=-field.dims/2+.001-xyz.min(axis=0)
        hi=field.dims/2-.001-xyz.max(axis=0)
        if np.any(lo>hi):continue
        ctr=(shape['vertices'].max(0)+shape['vertices'].min(0))/2
        M=np.eye(4)
        M[:3,:3]=A
        M[:3,3]=np.clip(location-A@ctr+rng.uniform(-.007,.007,3),lo,hi)
        sample=field.sample(shape,M,shape['planes'])
        if sample is None:continue
        amount,overlap,*_=sample
        if amount<2 or overlap/amount>.055:continue
        score=amount-6*overlap
        if score>0 and (best is None or score>best[0]):
            best=(score,name,M,sample)
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
    legacy.VERSION = '17.7-candidate.2'
    legacy.MAX_STONES = args.max_stones
    legacy.MAX_ATTEMPTS = 240
    legacy.PITCH = .0125
    original_fill=legacy.fill
    def small_only(field, shapes, rng, placements, verbose=False):
        small={k:v for k,v in shapes.items() if k.startswith('CHINK_')}
        assert len(small)==29
        return original_fill(field, small, rng, placements, verbose)
    legacy.fill=small_only
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
        recipe = legacy.bake_case(kind,variant,pack,allowed,verbose=False)
        recipe['metric'] = 'preliminary convex proxy; NOT accepted as 90% physical density'
        variants.setdefault(kind,{})[variant] = recipe
        print('CANDIDATE',kind,variant,'stones',len(recipe['placement']),
              'proxyDensity',recipe['occupancy'],flush=True)
    result = {'version':'17.7-candidate.2','cellMeters':.25,
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
