#!/usr/bin/env python3
"""Export gate-authored 486-rock placements as fixed instance recipes, offline.

Reuses exactly the approved 17.5.4 gate-inspired packer's transformed meshes,
not a speculative new voxel allocator. No browser-side physics/generation.
Never edits existing 17.5.4/17.5.5 assets, saves, or the 486 source shapes.
"""
from importlib.util import spec_from_file_location,module_from_spec
from pathlib import Path
import hashlib,json,math,numpy as np,trimesh

ROOT=Path(__file__).resolve().parents[2]
PREFAB=ROOT/'assets/tower/prefabs'
GATE_LIB=PREFAB/'gate-stones-library-v1-17_5_4.glb'
BAKER=ROOT/'tools/tower/bake-gate-stones-1754.py'
METRICS=PREFAB/'gate-stone-17_5_4-metrics.json'
OUTPUT=PREFAB/'balkar71/placements-17_5_9.json'
VERSION='17.5.9'
SOURCE_VERSION='17.5.4'
CELL=.25
spec=spec_from_file_location('alantil_gate_baker',BAKER)
mod=module_from_spec(spec);spec.loader.exec_module(mod)

def encode(name,scalar,rot,center):
    a=np.asarray(rot,dtype=float)*float(scalar)
    c=np.asarray(center,dtype=float)
    matrix=np.column_stack((a,c))
    if not np.isfinite(matrix).all():raise ValueError('Nonfinite placement')
    if not np.allclose(a.T@a,np.eye(3)*scalar**2,atol=2e-6):
        raise ValueError('Nonuniform source deformation')
    return [name]+[round(float(x),7) for x in matrix.reshape(-1)]

def face_coverage(solid):
    values=[]
    for axis in range(3):
        values.append(float(np.take(solid,[0,1],axis=axis).any(axis=axis).mean()))
        values.append(float(np.take(solid,[-2,-1],axis=axis).any(axis=axis).mean()))
    return values

def main():
    source_sha=hashlib.sha256(mod.GATE.read_bytes()).hexdigest()
    report=json.loads(METRICS.read_text('utf8'))
    assert source_sha==report['sourceSha256'], 'Approved gate original changed'
    rocks=mod.stones_from_gate()
    assert len(rocks)==486
    library=trimesh.load(GATE_LIB,force='scene',process=False)
    names=[f'GATE_{kind.upper()}_{idx:03d}_{node}'
           for idx,(node,kind,mesh) in enumerate(rocks)]
    assert set(names)==set(library.geometry),'Gate library shape names no longer match'
    assert len(names)==len(set(names))==486
    variants={}
    for section in mod.SIZE:
        group=[]
        checks={r['variant']:r for r in report['types'][section]}
        assert len(checks)==5
        for variant in range(5):
            bake=mod.Bake(section,variant,rocks)
            bake.primary_course()
            bake.large_pockets()
            bake.rubble()
            items=[encode(names[idx],scalar,rot,ctr)
                   for idx,kind,scalar,rot,ctr,verts in bake.placed]
            assert 1<=len(items)<=512,(section,variant,len(items))
            counts={'main':sum(p[1]=='main' for p in bake.placed),
                    'chinking':sum(p[1]=='chinking' for p in bake.placed)}
            approved=checks[variant]
            # Historical 17.5.4 metrics are independently recorded: abort
            # if source stones or packing logic changed, rather than claiming
            # this is the same gate layout.
            assert counts['main']==approved['main'],(section,variant,'main',counts,approved)
            assert counts['chinking']==approved['chinking'],(section,variant,'chinking',counts,approved)
            density=round(float(bake.occupied.mean()),4)
            assert abs(density-approved['density'])<.000051,(section,variant,density,approved['density'])
            coverage=face_coverage(bake.occupied)
            quality=dict(occupancy=density,
                         faceCoverage=[round(x,5) for x in coverage],
                         minFaceCoverage=round(min(coverage),5),
                         stoneCount=len(items),
                         mainStoneCount=counts['main'],chinkingStoneCount=counts['chinking'],
                         methodology='original gate convex-hull voxel method at 0.025m',
                         sourceVersion=SOURCE_VERSION,
                         sourceApprovedDensity=approved['density'])
            group.append(dict(rocks=len(items),
                              size=[x*CELL for x in mod.SIZE[section]],
                              placement=items,
                              **quality,
                              sha256=hashlib.sha256(json.dumps(items,separators=(',',':')).encode()).hexdigest()))
            print('GATE_RECIPE',section,variant,'stones',len(items),
                  'occupancy',density,'minimum face',round(min(coverage),4),flush=True)
        assert len({x['sha256'] for x in group})==5
        variants[section]=group
    result=dict(version=VERSION,cellMeters=CELL,
                library='/assets/tower/prefabs/'+GATE_LIB.name,
                shapes=names,variants=variants,
                totalPlacements=sum(len(r['placement']) for a in variants.values() for r in a),
                sourcedFrom='486 authentic approved gate v7 rocks',
                gateSourceSha256=source_sha,
                generator='tools/tower/emit-gate-recipes-1759.py')
    OUTPUT.parent.mkdir(exist_ok=True,parents=True)
    OUTPUT.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n','utf8')
    print('READY_UNAPPROVED_GATE_RECIPES',OUTPUT.stat().st_size,
          'bytes',result['totalPlacements'],'instances',flush=True)

if __name__=='__main__':main()
