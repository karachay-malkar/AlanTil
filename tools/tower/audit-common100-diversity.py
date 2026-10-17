#!/usr/bin/env python3
"""Geometry-only diversity audit for MAIN_035..MAIN_072.

Checks real meshes, not the claimed 'unique' identifiers, mesh hashes or
metadata. It rejects an elongated 9-section prism copied 38 times.
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parents[2]
FOLDER=ROOT/"assets/tower/prefabs/common100"
TARGET=[f"MAIN_{i:03}" for i in range(35,73)]


def inspect(directory=FOLDER):
    meta=json.loads((directory/"common-100.json").read_text())
    meshes=trimesh.load(directory/"common-100.glb",force="scene",process=False).geometry
    entries={e["name"]:e for e in meta["models"]}
    assert len(meshes)==100 and len(entries)==100
    baseline=json.loads((ROOT/"tests/common100-v4-nonlintel-baseline.json").read_text())["models"]
    stable=[n for n,h in baseline.items() if entries[n]["geometrySHA256"]==h]
    print("UNTOUCHED_MODEL_HASHES",len(stable),"OF",len(baseline))
    print("CHANGED_NONLINTELS",[(n,entries[n]["source"],entries[n]["geometrySHA256"],h) for n,h in baseline.items() if entries[n]["geometrySHA256"]!=h])
    assert len(stable)==94, "The 94 non-lintel models must remain geometrically identical"
    models=[meshes[x] for x in TARGET]
    assert all(entries[n]["source"]=="generated" for n in TARGET)
    assert all(x.is_volume and x.is_watertight for x in models)
    # Even generous deviations from a copied ring-extrusion can only yield
    # 162 triangles and nine similar quasi-flat sides in the old baker.
    faces={len(m.faces) for m in models}
    silhouettes=set()
    for mesh in models:
        verts=np.asarray(mesh.vertices,dtype=float)
        width,height,depth=np.asarray(mesh.extents)
        assert width>=max(height,depth) and .199<width<.401
        silhouettes.add((round(height/width,1),round(depth/width,1)))
    families={entries[n].get("shapeFamily") for n in TARGET}
    counts={f:sum(entries[n].get("shapeFamily")==f for n in TARGET) for f in families}
    print("DIVERSITY", "different_triangle_counts",len(faces),
          "proportional_silhouettes",len(silhouettes),
          "families",counts,"triangles",sorted(faces))
    assert len(faces)>=9, "Shared 162-face extrusion topology: 38 stones look alike"
    assert len(silhouettes)>=14, "Insufficient shape proportions"
    assert len(families)>=5 and None not in families, "Need independent named 3D form families"
    assert min(counts.values())>=3, "Form families underrepresented"
    assert max(counts.values())<=11, "Too many same-family repeats"
    print("COMMON100_38_DIVERSE_FORMS_PASS")


if __name__=="__main__":
    inspect()
