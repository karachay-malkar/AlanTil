#!/usr/bin/env python3
"""Experimental 94-rock densely-filled wall recipes. Never switches the live catalog."""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LEGACY = ROOT / 'tools/tower/bake-dense-compact-1758.py'
COMMON = ROOT / 'assets/tower/prefabs/common94/common-94.glb'
SOURCE = ROOT / 'assets/tower/prefabs/balkar71/placements-17_5_5.json'
OUTPUT = ROOT / 'assets/tower/prefabs/common94/candidate-placements-17_7.json'
SIZES = ['1x1x1','2x2x2','2x2x3','2x3x4','4x4x4']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--pilot', action='store_true', help='Only first two small sizes, first variation each')
    ap.add_argument('--max-stones', type=int, default=512)
    ap.add_argument('--out', default=str(OUTPUT))
    args = ap.parse_args()
    if args.max_stones < 50 or args.max_stones > 4096:
        raise ValueError('Stone count outside QA budget')
    spec = importlib.util.spec_from_file_location('legacy_bake', LEGACY)
    legacy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(legacy)
    legacy.LIBRARY = COMMON
    legacy.SOURCE = SOURCE
    legacy.VERSION = '17.7-candidate.1'
    legacy.MAX_STONES = args.max_stones
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
    result = {'version':'17.7-candidate.1','cellMeters':.25,
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
