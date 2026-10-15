#!/usr/bin/env python3
"""Four immutable connector GLBs for window-to-natural-wall masonry interfaces.

Only the 36 project-authored stone meshes are used; no cuboid filler is made.
Each connector occupies a 0.25 m seam tile and contains 9 irregular stones.
Place only on full-stone cells; the client classifies aperture cells separately.
"""
import importlib.util
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('tower_baker',ROOT/'tools/tower/build-prefab-library.py')
wall=importlib.util.module_from_spec(spec)
spec.loader.exec_module(wall)
models=wall.normalized_rocks(ROOT/'assets/tower/source-original-36.glb')
output=ROOT/'assets/tower/prefabs/architectural'
output.mkdir(parents=True,exist_ok=True)
SEEDS={'x':2091,'y':2741,'z':3339,'corner':4177}
IDS=(20,24,25,27,28,29,18,11,15)
for axis, seed in SEEDS.items():
    rng=np.random.default_rng(seed)
    rocks=[]
    for i,mid in enumerate(IDS):
        u=((i%3+.5)/3-.5)*.210+rng.uniform(-.004,.004)
        v=((i//3+.5)/3-.5)*.210+rng.uniform(-.004,.004)
        n=rng.uniform(-.014,.014)
        if axis=='x':center=[n,u,v]
        elif axis=='y':center=[u,n,v]
        elif axis=='z':center=[u,v,n]
        else:center=[u*.36,v,u*.36]
        # Short irregular source stones, small enough not to spill into the
        # window's empty adjacent 25-cm aperture cells.
        scale=rng.uniform(.082,.100)
        source=models[mid]
        # uniform scale preserves authored source proportions
        pieces=wall.make_mesh(source,[scale,scale,scale],center,
                              wall.PALETTE[int(rng.integers(len(wall.PALETTE)))])
        rocks.append(pieces)
    path=output/f'window-joint-{axis}-v1.glb'
    scene=wall.authored_prefab_scene(rocks,'window-natural-stone-joint-'+axis)
    scene.export(path,file_type='glb')
    print('WINDOW_JOINT_OK',axis,path.stat().st_size,sum(len(g.faces) for g in scene.geometry.values()),flush=True)