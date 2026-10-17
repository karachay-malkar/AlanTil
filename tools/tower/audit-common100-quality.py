#!/usr/bin/env python3
"""Geometry acceptance test for common-100 (actual GLB, not reported JSON metrics).

Checks section area and Y/Z dimensions at six stations along a stone's
long axis. Detects unnatural blades, needle-like ends and weak lintel seats.
"""
from __future__ import annotations
import json
from pathlib import Path
import sys
import numpy as np
import trimesh
from scipy.spatial import ConvexHull, QhullError

ROOT=Path(__file__).resolve().parents[2]
DIRECTORY=ROOT/"assets/tower/prefabs/common100"
EXPECTED={"main":72,"large":10,"chinking":12,"lintel":6}
STA=[.06,.12,.20,.35,.5,.65,.80,.88,.94]


def section_points(mesh, position):
    """Compute intersections with triangle EDGES, independent of UV seams."""
    v=np.asarray(mesh.vertices,dtype=np.float64)
    f=np.asarray(mesh.faces,dtype=np.int64)
    x=v[f,0]
    xx=float(v[:,0].min()+position*np.ptp(v[:,0]))
    points=[]
    for a,b in ((0,1),(1,2),(2,0)):
        xa,xb=x[:,a],x[:,b]
        mask=(xa<=xx)&(xb>=xx)|(xb<=xx)&(xa>=xx)
        safe=np.abs(xb-xa)>1e-10
        mask &= safe
        if mask.any():
            t=((xx-xa[mask])/(xb[mask]-xa[mask]))[:,None]
            points.append(v[f[mask,a]]*(1-t)+v[f[mask,b]]*t)
    return np.concatenate(points,axis=0) if points else np.empty((0,3))


def quality(mesh):
    dim=np.asarray(mesh.extents,dtype=float)
    if int(np.argmax(dim))!=0:
        raise AssertionError("longest dimension must lie on X axis")
    profiles=[]
    for station in STA:
        yzs=section_points(mesh,station)[:,1:]
        if len(yzs)<3:
            profiles.append((0.,0.,0.,0.,0.))
            continue
        area=0.
        try:
            area=float(ConvexHull(yzs).volume)
        except QhullError:
            pass
        span=np.ptp(yzs,axis=0)
        profiles.append((area,*span,np.max(yzs[:,0]),np.max(yzs[:,1])))
    central=np.median([profiles[3][0],profiles[4][0],profiles[5][0]])
    if central<=1e-7:
        raise AssertionError("zero core section")
    area_ratio=[round(p[0]/central,4) for p in profiles]
    end_min=min(area_ratio[1],area_ratio[7])
    shoulder_min=min(area_ratio[2],area_ratio[6])
    far_min=min(area_ratio[0],area_ratio[8])
    # A flat, broad lintel needs a visibly irregular top and side.
    top=np.array([p[3] for p in profiles[1:8]],dtype=float)
    side=np.array([p[4] for p in profiles[1:8]],dtype=float)
    rough=max(float(np.std(np.diff(top))),float(np.std(np.diff(side))))
    return {"end12":end_min,"shoulder20":shoulder_min,"tip06":far_min,
            "roughness":round(rough,5),"profile":area_ratio}


def violations(name, category, q, dims):
    failures=[]
    # Conservative screening: disallow tiny terminal cross-sections.
    if category in ("main","large"):
        if q["tip06"]<.12:failures.append("terminal blade (<12% core at 6%)")
        if q["end12"]<.30:failures.append("pointed end (<30% core at 12%)")
        if q["shoulder20"]<.42:failures.append("long thin tongue (<42% core at 20%)")
    if category=="lintel":
        if float(dims[1])/float(dims[2])>.78:failures.append("lintel not a flat slab")
        if q["tip06"]<.64:failures.append("lintel end is tapered")
        if q["end12"]<.72:failures.append("lintel lacks broad bearing surface")
        if q["shoulder20"]<.82:failures.append("lintel shoulders not massive")
        if q["roughness"]<.005:failures.append("lintel side is too uniformly flat")
    return failures


def main():
    meta=json.loads((DIRECTORY/"common-100.json").read_text())
    scene=trimesh.load(DIRECTORY/"common-100.glb",force="scene",process=False)
    assert meta["count"]==100 and meta["counts"]==EXPECTED
    assert len(scene.geometry)==100
    report=[]
    bad=[]
    for item in meta["models"]:
        name=item["name"];cat=item["category"]
        mesh=scene.geometry[name]
        assert mesh.is_watertight and np.isfinite(mesh.vertices).all(),name
        q=quality(mesh)
        fails=violations(name,cat,q,mesh.extents)
        report.append({"name":name,"category":cat,**q,"violations":fails})
        if fails: bad.append((name,q,fails))
    print("COMMON100_QUALITY_COUNT",len(report),"FAILED",len(bad))
    for name,q,errors in bad[:45]:
        print("REJECT",name,"profile",q["profile"],"roughness",q["roughness"],"reason","; ".join(errors))
    if bad:
        print("COMMON100_QUALITY_REJECTED",len(bad))
        sys.exit(1)
    print("COMMON100_QUALITY_ACCEPTED_100")
    return report


if __name__=="__main__":
    main()
