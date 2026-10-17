"""Six distinct natural fractured-stone families for AlanTil common-100.

Offline Blender-independent mesh modelling. No source geometry or image generation.
Constructive half-space carving creates genuinely different convex outlines;
localized inward fractures add irregular rough planar sides. Output is a
watertight rock with its long dimension X and a stable horizontal bed.
"""
from __future__ import annotations

import numpy as np
import trimesh
from scipy.spatial import HalfspaceIntersection
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

FAMILIES=("massive","flat-bed","trapezoid","short-wide","broken-facet","asymmetric")
MAT=PBRMaterial(name="ALANTIL_COMMON100_ROCK_PBR",
                baseColorFactor=[193,176,146,255], metallicFactor=0,
                roughnessFactor=.97)

# Source dimensions are physical dimensions only AFTER mesh creation.
# They deliberately span short, massive, tabular, and medium horizontal profiles.
RATIOS={
    "massive":((.68,.84),(.70,.90)),
    "flat-bed":((.37,.49),(.70,.88)),
    "trapezoid":((.52,.72),(.57,.75)),
    "short-wide":((.65,.83),(.81,.94)),
    "broken-facet":((.49,.76),(.64,.87)),
    "asymmetric":((.46,.68),(.57,.83)),
}
CUT_RANGES={
    "massive":(12,19),
    "flat-bed":(17,25),
    "trapezoid":(11,20),
    "short-wide":(23,34),
    "broken-facet":(28,39),
    "asymmetric":(18,28),
}


def _rock_hull(rng,family):
    """Convex polyhedron clipped by many angled rock-fracture planes."""
    boundaries=[]
    # Keep thick ends. The near-axis end planes are oblique, never become tips.
    for axis in range(3):
        for sign in (-1,1):
            normal=np.zeros(3)
            normal[axis]=sign
            other=[a for a in range(3) if a!=axis]
            if family in ("trapezoid","asymmetric") and axis!=0:
                normal[0]=rng.uniform(-.29,.29)
            else:
                normal[other]=rng.uniform(-.10,.10,2)
            normal/=np.linalg.norm(normal)
            boundaries.append((normal, rng.uniform(.47,.54)))
    low,high=CUT_RANGES[family]
    for k in range(int(rng.integers(low,high+1))):
        direction=rng.normal(size=3)
        if family=="flat-bed" and k%3==0:
            direction[1]*=1.75
        if family=="asymmetric" and k%4==0:
            direction[0]*=1.65
        direction/=np.linalg.norm(direction)
        # Big cut at corners, narrow cuts on side faces; ensures plate-sized
        # bearing area at X ends instead of a single needle-like endpoint.
        d=rng.uniform(.49,.69)
        if family=="broken-facet":d=rng.uniform(.43,.68)
        boundaries.append((direction,d))
    halfspaces=np.array([np.r_[n,-d] for n,d in boundaries])
    intersections=HalfspaceIntersection(halfspaces,np.zeros(3)).intersections
    if len(intersections)<8:
        raise ValueError("Insufficient 3D half-space intersections")
    stone=trimesh.convex.convex_hull(intersections)
    stone.merge_vertices()
    return stone


def _surface_chips(rng,mesh,family):
    """True irregular side geometry, not a smooth elongated polygonal prism."""
    from trimesh.remesh import subdivide
    p,f=subdivide(np.asarray(mesh.vertices),np.asarray(mesh.faces))
    stone=trimesh.Trimesh(vertices=p,faces=f,process=False)
    v=np.asarray(stone.vertices,dtype=np.float64).copy()
    shots=12 if family=="broken-facet" else 10 if family=="flat-bed" else 7
    extent=np.asarray(mesh.extents,dtype=float)
    for k in range(shots):
        idx=int(rng.integers(0,len(v)))
        anchor=v[idx].copy()
        # Preserve strong broad end shoulders.
        if abs(anchor[0])>.33*float(extent[0]):
            continue
        outward=anchor / max(np.linalg.norm(anchor),1e-8)
        # Chipped pockets, not raised radial thorns. Keep depth conservative.
        sigma=rng.uniform(.065,.18)
        x=(v-anchor)/sigma
        weight=np.exp(-.5*np.sum(x*x,axis=1))
        amp=rng.uniform(.012,.038)
        if family=="broken-facet":amp*=1.30
        v -= (amp*weight)[:,None]*outward[None,:]
    stone.vertices=v
    trimesh.repair.fix_normals(stone)
    if not stone.is_volume or not stone.is_watertight:
        raise ValueError("Unstable irregular rock cut")
    return stone


def build_faceted_stone(rng,longest,family):
    """Unique, angled 3D rock from an independently clipped polyhedron."""
    if family not in RATIOS:
        raise ValueError("Unrecognized rock family "+str(family))
    stone=_rock_hull(rng,family)
    stone=_surface_chips(rng,stone,family)
    ry,rz=RATIOS[family]
    height=float(longest)*rng.uniform(*ry)
    depth=float(longest)*rng.uniform(*rz)
    stone.apply_scale(np.array([float(longest),height,depth])/stone.extents)
    stone.apply_translation(-stone.bounds.mean(axis=0))
    if not stone.is_volume or not stone.is_watertight:
        raise ValueError("Non-watertight generated rock")
    v=np.asarray(stone.vertices,dtype=float)
    uv=(v[:,[0,2]]*2.8).astype(np.float32)
    stone.visual=TextureVisuals(uv=uv,material=MAT)
    return stone
