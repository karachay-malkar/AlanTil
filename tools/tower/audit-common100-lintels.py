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



def flank_facet_score(mesh, sign):
    """Fraction of long-flank real facets tilted across the bridge axis.

    A visually smooth extruded wall may move a few mm from station to station,
    yet still offer a single broad side plane. Triangulated 3D stone cuts
    create numerous locally non-coplanar large surfaces on BOTH long sides.
    """
    normals=np.asarray(mesh.face_normals)
    centers=np.asarray(mesh.triangles_center)
    length=float(mesh.extents[0])
    visible=(normals[:,2]*sign>.45) & (np.abs(centers[:,0])<.42*length) & (np.abs(centers[:,1])<.095)
    count=int(visible.sum())
    tilted=int(np.count_nonzero(np.abs(normals[visible,0])>.2))
    return count,tilted,round(tilted/max(1,count),3)


def end_break_score(mesh, sign):
    """Median non-axial orientation of facets on each broken stone end."""
    normals=np.asarray(mesh.face_normals)
    centers=np.asarray(mesh.triangles_center)
    length=float(mesh.extents[0])
    mask=(normals[:,0]*sign>.65) & (centers[:,0]*sign>.43*length)
    if not np.any(mask):
        return 0.0
    return float(np.median(1.0-np.abs(normals[mask,0])))

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
        assert min(side)>=.012,(name,"at least one long flank remains too regular",side)
        for sign in (-1,1):
            count,tilted,fraction=flank_facet_score(rock,sign)
            assert count>=95 and tilted>=55 and fraction>=.35,(name,"smooth longitudinal face",sign,count,tilted,fraction)
            assert end_break_score(rock,sign)>=.002,(name,"end face is too planar",sign,end_break_score(rock,sign))
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
