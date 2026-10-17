"""Only replace six stone lintel meshes in the already-approved common-100 GLB.

The old full baker is intentionally NOT used: trimesh/QHull may reorder
independently generated stones. Preserve all 94 source geometries by copying
them, not by generating allegedly equivalent replacements.
"""
from __future__ import annotations
from copy import deepcopy
from pathlib import Path
import hashlib
import json
import numpy as np
import trimesh

from common100_lintels import build_rugged_lintel, STYLES, ENDCAP_DESIGNS
from common100_quality import quality, violations

ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/"assets/tower/prefabs/common100"
VERSION="17.7-common100.7"
LENGTHS=(1.0,1.0,1.25,1.25,1.5,1.5)


def geometry_sha(mesh):
    return hashlib.sha256(
        np.asarray(mesh.vertices,dtype="<f4").tobytes() +
        np.asarray(mesh.faces,dtype="<i4").tobytes()
    ).hexdigest()


def rebake(output=DIR):
    metadata_path=output/"common-100.json"
    glb_path=output/"common-100.glb"
    old_data=json.loads(metadata_path.read_text(encoding="utf8"))
    old_scene=trimesh.load(glb_path,force="scene",process=False)
    if len(old_scene.geometry)!=100 or len(old_data["models"])!=100:
        raise ValueError("Source library must contain exactly 100 meshes")
    output_scene=trimesh.Scene(base_frame="world")
    data=deepcopy(old_data)
    data["version"]=VERSION

    lintel_count=0
    unchanged_hashes={}
    for item in data["models"]:
        name=item["name"]
        if name not in old_scene.geometry:
            raise ValueError("Missing approved old mesh: "+name)
        if item["category"]!="lintel":
            # Copy the EXACT archived GLB topology, UVs and normals.
            source_mesh=old_scene.geometry[name]
            mesh=source_mesh.copy()
            unchanged_hashes[name]=geometry_sha(source_mesh)
        else:
            index=lintel_count
            wanted=LENGTHS[index]
            style=STYLES[index%len(STYLES)]
            for attempt in range(80):
                local_rng=np.random.default_rng(970221+index*1129+attempt*113)
                try:
                    mesh=build_rugged_lintel(local_rng,wanted,style,index)
                except ValueError:
                    continue
                if not violations(name,"lintel",quality(mesh),mesh.extents):
                    break
            else:
                raise RuntimeError("Cannot make structurally solid lintel "+name)
            item.update({
                "source":"generated",
                "lintelStyle":style,
                "endcapDesign":list(ENDCAP_DESIGNS[index]),
                "sizeMeters":[round(float(x),5) for x in mesh.extents],
                "triangles":int(len(mesh.faces)),
                "geometrySHA256":geometry_sha(mesh),
                "watertight":bool(mesh.is_watertight),
                "sectionQuality":quality(mesh),
            })
            lintel_count+=1
        output_scene.add_geometry(mesh,node_name=name,geom_name=name)
    if len(unchanged_hashes)!=94 or lintel_count!=6:
        raise ValueError("Invalid preserved/mutated rock count")
    candidate=output/"common-100.pending.glb"
    try:
        output_scene.export(candidate)
        after=trimesh.load(candidate,force="scene",process=False)
        if set(after.geometry)!=set(old_scene.geometry):
            raise ValueError("GLB round trip lost models")
        for name,oldhash in unchanged_hashes.items():
            newmesh=after.geometry[name]
            if geometry_sha(newmesh)!=oldhash:
                raise ValueError("NON-LINTEL SOURCE REGRESSION "+name)
            if newmesh.visual.uv is None or not newmesh.is_watertight:
                raise ValueError("Non-lintel lost UVs or integrity "+name)
        for i in range(6):
            name=f"LINTEL_{i+1:03d}"
            mesh=after.geometry[name]
            if abs(float(mesh.extents[0])-LENGTHS[i])>.003:
                raise ValueError("Wrong lintel length "+name)
            if not mesh.is_watertight or mesh.visual.uv is None:
                raise ValueError("Broken lintel "+name)
        data["glbSHA256"]=hashlib.sha256(candidate.read_bytes()).hexdigest()
        candidate.replace(glb_path)
    finally:
        candidate.unlink(missing_ok=True)
    metadata_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print("COMMON100_ENDCAP_ONLY_BAKE_SUCCESS",{
        "count":len(data["models"]),"unchanged":len(unchanged_hashes),
        "remadeLintels":lintel_count,"version":data["version"],
    })
    return data


if __name__=="__main__":
    rebake()
