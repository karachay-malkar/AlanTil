#!/usr/bin/env python3
"""Independent 3D verification of candidate masonry transformations.

Does NOT read the candidate's authored occupancy claims as geometry truth:
it checks every mesh vertex against its logical 25cm grid envelope using the
actual binary GLB vertices, verifies uniform scaling and rigid rotations,
and compares the browser matrix format against real mesh extents.
"""
import argparse,json,numpy as np,trimesh
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser()
p.add_argument('--candidate',default='assets/tower/prefabs/balkar71/placements-17_5_11.json')
args=p.parse_args()
path=ROOT/args.candidate
pack=json.loads(path.read_text('utf8'))
library=ROOT/pack['library'].lstrip('/')
scene=trimesh.load(library,force='scene',process=False)
shapes={name:np.asarray(mesh.vertices) for name,mesh in scene.geometry.items()}
assert set(shapes)==set(pack['shapes']),"Candidate shape names mismatch actual binary GLB"
assert len(shapes)==486
violations=[]
count=0
for kind,variants in pack['variants'].items():
    dims=np.array([float(x)*.25 for x in kind.split('x')])
    assert len(variants)==5
    for variant,recipe in enumerate(variants):
        assert recipe['size']==dims.tolist()
        assert len(recipe['placement'])<=512
        for name,*values in recipe['placement']:
            assert len(values)==12
            a=np.array(values).reshape(3,4)
            mat=a[:,:3];center=a[:,3]
            gram=mat.T@mat
            squared=float(np.trace(gram)/3)
            if squared<=0 or not np.allclose(gram,np.eye(3)*squared,rtol=.00015,atol=.00005):
                violations.append((kind,variant,name,'NONRIGID'));continue
            if np.linalg.det(mat)<0:
                violations.append((kind,variant,name,'MIRRORED'));continue
            verts=shapes[name]@mat.T+center
            if np.any(verts.min(0)<-dims/2-.003) or np.any(verts.max(0)>dims/2+.003):
                violations.append((kind,variant,name,'OUTSIDE_BOUNDS',verts.min(0).tolist(),verts.max(0).tolist()))
            count+=1
if violations:
    print('GEOMETRY_VIOLATIONS',len(violations),'OF',count)
    for row in violations[:20]:print(row)
    raise SystemExit(1)
print('VERIFY_REAL_MESH_BOUNDS_OK',count,'actual 3D authored stones in',path)
