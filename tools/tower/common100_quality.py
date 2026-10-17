"""Measured cross-section QA for angular common100 stones.

Area checks compare each stone to *its own* central cross sections.
They distinguish a jagged surface from a fragile pointed tip.
"""
from __future__ import annotations
import numpy as np
from scipy.spatial import ConvexHull, QhullError

STA=(.06,.12,.20,.35,.5,.65,.80,.88,.94)


def section_points(mesh, position):
    v=np.asarray(mesh.vertices,dtype=np.float64)
    f=np.asarray(mesh.faces,dtype=np.int64)
    x=v[f,0]
    xx=float(v[:,0].min()+position*np.ptp(v[:,0]))
    points=[]
    for a,b in ((0,1),(1,2),(2,0)):
        xa,xb=x[:,a],x[:,b]
        mask=((xa<=xx)&(xb>=xx)|(xb<=xx)&(xa>=xx))&(np.abs(xb-xa)>1e-10)
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
    top=np.array([p[3] for p in profiles[1:8]],dtype=float)
    side=np.array([p[4] for p in profiles[1:8]],dtype=float)
    rough=max(float(np.std(np.diff(top))),float(np.std(np.diff(side))))
    return {"end12":min(area_ratio[1],area_ratio[7]),
            "shoulder20":min(area_ratio[2],area_ratio[6]),
            "tip06":min(area_ratio[0],area_ratio[8]),
            "roughness":round(rough,5),"profile":area_ratio}


def violations(name,category,q,dims):
    failures=[]
    if category in ("main","large"):
        if q["tip06"]<.12:failures.append("terminal blade (<12% core at 6%)")
        if q["end12"]<.30:failures.append("pointed end (<30% core at 12%)")
        if q["shoulder20"]<.42:failures.append("long thin tongue (<42% core at 20%)")
    elif category=="lintel":
        if float(dims[1])/float(dims[2])>.78:failures.append("lintel not a flat slab")
        if q["tip06"]<.64:failures.append("lintel end is tapered")
        if q["end12"]<.72:failures.append("lintel lacks broad bearing surface")
        if q["shoulder20"]<.82:failures.append("lintel shoulders not massive")
        if q["roughness"]<.005:failures.append("lintel side is too uniformly flat")
    return failures
