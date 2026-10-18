#!/usr/bin/env python3
"""QA for only end-face sculpting of six single-piece lintels, 100/125/150 cm.

An intentionally calm v5 long flank is expected; v6 longitudinal faceting
is forbidden. Validate measured end-cap geometry from exported GLB, not just
names/metadata. The other 94 library meshes MUST be unchanged.
"""
from __future__ import annotations
import json
from pathlib import Path
import numpy as np
import trimesh

from common100_quality import quality, violations
from common100_lintels import PROFILE_NAMES

ROOT=Path(__file__).resolve().parents[2]
ROOT100=ROOT/"assets/tower/prefabs/common100"
LENGTHS=(1.0,1.0,1.25,1.25,1.5,1.5)


def cap_features(mesh,sign):
    """Large true end facets and irregular face depths.

    A single smooth planar ngon/fan has too few strongly oblique cap normals.
    Cap-only radial cracks/chips create a nonplanar face with varied depths.
    """
    verts=np.asarray(mesh.vertices,dtype=float)
    centers=np.asarray(mesh.triangles_center,dtype=float)
    normal=np.asarray(mesh.face_normals,dtype=float)
    area=np.asarray(mesh.area_faces,dtype=float)
    long=float(mesh.extents[0])
    face=(centers[:,0]*sign>long*.445)&(normal[:,0]*sign>.24)
    count=int(face.sum())
    if not count:
        return {"count":0,"facets":0,"roughArea":0.,"depth":0.,"broadFacets":0}
    bent=(normal[:,0]*sign>.28)&(normal[:,0]*sign<.94)
    rough_area=float(np.sum(area[face&bent]))
    full_area=float(np.sum(area[face]))
    broad=int(np.count_nonzero(face&bent&(area>.00016)))
    cap_vertices=verts[np.abs(verts[:,0]*sign-long/2)<min(.04,long*.04)]
    depth=float(np.ptp(cap_vertices[:,0])) if len(cap_vertices)>0 else 0.
    # The tip must have a broad frontal region, never a single sharp vertex.
    terminal=float(np.max(verts[:,0]*sign))
    tip=verts[verts[:,0]*sign>=terminal-.0061]
    return {
        "tipVertices":int(len(tip)),
        "tipHeight":float(np.ptp(tip[:,1])) if len(tip) else 0.,
        "tipWidth":float(np.ptp(tip[:,2])) if len(tip) else 0.,
        "count":count,
        "facets":int(np.count_nonzero(face&bent)),
        "broadFacets":broad,
        "roughArea":round(rough_area/max(full_area,1e-9),3),
        "depth":round(depth,5),
    }


def central_flank_facets(mesh):
    """Reject the dense, artificial sawtooth triangles added in common100.6."""
    centers=np.asarray(mesh.triangles_center)
    normals=np.asarray(mesh.face_normals)
    long=float(mesh.extents[0])
    mid=(np.abs(centers[:,0])<long*.36)
    flanks=(np.abs(normals[:,2])>.38)&mid
    return int(np.count_nonzero(flanks))


def main():
    meta=json.loads((ROOT100/"common-100.json").read_text(encoding="utf8"))
    previous=json.loads((ROOT/"tests/common100-v4-nonlintel-baseline.json").read_text(encoding="utf8"))["models"]
    items={m["name"]:m for m in meta["models"]}
    scene=trimesh.load(ROOT100/"common-100.glb",force="scene",process=False)
    assert len(scene.geometry)==len(meta["models"])==100
    assert len(previous)==94
    for name,h in previous.items():
        assert items[name]["geometrySHA256"]==h,(name,"Non-lintel changed")
    results=[]
    for i,wanted in enumerate(LENGTHS,1):
        name=f"LINTEL_{i:03d}"
        model=scene.geometry[name]
        datum=items[name]
        assert model.is_volume and model.is_watertight,name
        assert model.visual.uv is not None,name
        assert abs(float(model.extents[0])-wanted)<.003,(name,model.extents)
        assert .18<=model.extents[1]<=.24,(name,model.extents)
        assert .28<=model.extents[2]<=.36,(name,model.extents)
        assert model.extents[1]/model.extents[2]<=.78,(name,model.extents)
        assert not violations(name,"lintel",quality(model),model.extents),(name,"Lintel too pointed")
        left=cap_features(model,-1)
        right=cap_features(model,1)
        for side,cap in (("left",left),("right",right)):
            assert cap["count"]>=18,(name,side,"End cap is almost smooth/flat",cap)
            assert cap["broadFacets"]>=8,(name,side,"Too few broad angular end facets",cap)
            assert cap["roughArea"]>=.18,(name,side,"End cap looks like saw cut",cap)
            assert cap["depth"]>=.012,(name,side,"No real relief in end cap",cap)
            assert cap["tipVertices"]>=3,(name,side,"Sharp isolated apex",cap)
            assert cap["tipHeight"]>=.035,(name,side,"Tip narrows into a needle",cap)
            assert cap["tipWidth"]>=.05,(name,side,"Tip narrows into a blade",cap)
        assert datum.get("endcapProfile")==PROFILE_NAMES[i-1],(name,"Wrong end profile")
        assert len(datum.get("endcapDesign",[]))==2,(name,"Missing design metadata")
        assert datum["endcapDesign"][0]!=datum["endcapDesign"][1],name
        count=central_flank_facets(model)
        assert count<230,(name,"Introduced excessive triangulated side noise",count)
        results.append((name,wanted,datum["lintelStyle"],datum["endcapDesign"],len(model.faces),left,right,count))
    assert len({items[f"LINTEL_{i:03d}"]["endcapProfile"] for i in range(1,7)})==6
    for i in (0,2,4):
        a,b=results[i:i+2]
        assert a[2]!=b[2],("Paired lintel lacks silhouette variations",a,b)
        assert a[4]!=b[4],("Paired lintel uses identical topology",a,b)
    print("COMMON100_ENDCAPS_RESTORED_SIDE_AND_DAMAGED_BOTH_ENDS",results)
    print("COMMON100_NON_LINTEL_94_HASHES_UNCHANGED")


if __name__=="__main__":
    main()
