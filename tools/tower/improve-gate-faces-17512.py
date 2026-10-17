#!/usr/bin/env python3
"""Probe more face-chinking stones for LARGE masonry sections with approved 486-rock GLB.

17.5.11 remains identical (512 stones maximum). This new candidate uses 1024,
is not activated in the live app, and requires mobile performance review.
"""
from importlib.util import spec_from_file_location,module_from_spec
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=spec_from_file_location('alantil_surface_17511',ROOT/'tools/tower/improve-gate-faces-17511.py')
model=module_from_spec(spec);spec.loader.exec_module(model)
model.MAX_FACE_INSTANCES=1024
model.old.VERSION='17.5.12'
model.old.OUTPUT=ROOT/'assets/tower/prefabs/balkar71/placements-17_5_12.json'
if __name__=='__main__':
    model.old.main()
