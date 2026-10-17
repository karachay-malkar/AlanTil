#!/usr/bin/env python3
"""Independent 3D acceptance: two distinct rugged lintels at each required length.

Verifies the GLB itself, not merely the metadata. Every non-lintel model from
17.7-common100.4 must preserve its geometry hash exactly.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import trimesh

from common100_quality import quality, violations, section_points

ROOT=Path(__file__).resolve().parents[2]
ROOT100=ROOT/"assets/tower/prefabs/common100"
LENGTHS=(1.0,1.0,1.25,1.25,1.5,1.5)


def side_breaks(mesh):
    """Measure irregularity of *both* long Z side boundaries in metres."""
    right,left=[],[]
    for station in np.linspace(.07,.93,18):
        yz=section_points(mesh,float(station))[:,1:]
        if len(yz)<4:
            return (0.0,0.0)
        right.append(float(np.max(yz[:,1])))
        left.append(float(np.min(yz[:,1])))
    return (round(float(np.std(np.diff(right))),5),
            round(float(np.std(np.diff(left))),5))




def endcap_geometry(mesh, sign):
    """Measure actual chipped cap topology and nonplanar depth (no trust in JSON)."""
    n=np.asarray(mesh.face_normals)
    p=np.asarray(mesh.triangles_center)
    v=np.asarray(mesh.vertices)
    length=float(mesh.extents[0])
    # Only faces on the final 5 cm of the selected end.
    f=(p[:,0]*sign>.43*length) & (n[:,0]*sign>.38)
    centers=p[f]
    normal=n[f]
    if len(centers)<18:
        return dict(faces=int(len(centers)), tilted=0, depth=0.0)
    slant=np.sqrt(normal[:,1]**2+normal[:,2]**2)
    cap_vertices=v[(v[:,0]*sign)>(.5*length-.043)]
    thickness=float(np.ptp(cap_vertices[:,0])) if len(cap_vertices)>4 else 0.0
    return dict(faces=int(len(centers)),
                tilted=int(np.count_nonzero(slant>.18)),
                depth=round(thickness,5))

def main():
    meta=json.loads((ROOT100/"common-100.json").read_text())
    old=json.loads((ROOT/"tests/common100-v4-nonlintel-baseline.json").read_text())["models"]
    m={item["name"]:item for item in meta["models"]}
    scene=trimesh.load(ROOT100/"common-100.glb",force="scene",process=False)
    assert len(meta["models"])==len(scene.geometry)==100
    assert len(old)==94
    for name,h in old.items():
        assert m[name]["geometrySHA256"]==h,(name,"regression: untouched model changed")
    specs=[]
    for i,wanted in enumerate(LENGTHS,1):
        name=f"LINTEL_{i:03d}"
        item=m[name]
        rock=scene.geometry[name]
        assert rock.is_watertight and rock.is_volume,name
        assert rock.visual.uv is not None,name
        assert item["category"]=="lintel",name
        assert abs(float(rock.extents[0])-wanted)<.003,(name,rock.extents,wanted)
        assert .18<=rock.extents[1]<=.24,(name,rock.extents)
        assert .28<=rock.extents[2]<=.36,(name,rock.extents)
        assert rock.extents[1]/rock.extents[2]<=.78,(name,rock.extents)
        assert not violations(name,"lintel",quality(rock),rock.extents),name
        side=side_breaks(rock)
        # Long sides must remain calm: v6's sawtooth micro-facets are rejected.
        assert min(side)>=.004,(name,"side too uniform",side)
        assert max(side)<=.032,(name,"over-chipped longitudinal sides",side)
        assert item.get("sideSurfaceVersion")=="v5-restored",(name,"v5 sides were not restored")
        effects=item.get("endTreatments",[])
        assert len(effects)==2 and all(len(effect)>=2 for effect in effects),(name,"missing individual treatments")
        for sign in (-1,1):
            cap=endcap_geometry(rock,sign)
            assert cap["faces"]>=20,(name,"end face has few facets",cap)
            assert cap["tilted"]>=12,(name,"end face is nearly planar",cap)
            assert cap["depth"]>=.013,(name,"end face is too flat",cap)
            print("ENDCAP_AUDIT",name,"left" if sign==-1 else "right",cap,effects[(sign+1)//2])
        # Only two coarse cap meshes were added, never a sawtooth side mesh.
        assert len(rock.faces)<760,(name,"too many triangles; long sides may have been damaged")
        # Two variants of the same length must not be the same geometry,
        # nor should both derive from one extrusion topology.
        assert item.get("lintelStyle"),name
        specs.append((name,wanted,item["lintelStyle"],len(rock.faces),side))
    for i in (0,2,4):
        pair=specs[i:i+2]
        assert pair[0][2]!=pair[1][2],("duplicate form families",pair)
        assert pair[0][3]!=pair[1][3],("duplicate triangulation topology",pair)
    print("LINTELS_100_125_150_X2_ACCEPTED",specs)
    print("NON_LINTEL_94_SOURCE_HASHES_PRESERVED")


if __name__=="__main__":
    main()
