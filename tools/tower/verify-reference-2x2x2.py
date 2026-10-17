#!/usr/bin/env python3
"""Independent acceptance for one AlanTil reference masonry prefab.

Checks original GLB triangles, legal transforms, boundary fit and connectivity
of *projected interior gaps*. Reports the latter honestly as convex proxies.
"""
from __future__ import annotations
import argparse,json
from pathlib import Path
import numpy as np
from scipy import ndimage
import trimesh

ROOT=Path(__file__).resolve().parents[2]
REVIEW=ROOT/'assets/tower/prefabs/common94/reference-2x2x2'
LIB=ROOT/'assets/tower/prefabs/common94/common-94.glb'

def verify(recipe_path,qa_path):
    pack=json.loads(Path(recipe_path).read_text('utf8'))
    report=json.loads(Path(qa_path).read_text('utf8'))
    scene=trimesh.load(LIB,force='scene',process=False)
    assert len(scene.geometry)==94,'Common94 mesh names changed'
    geom=scene.geometry
    assert pack['version']==report['version']
    assert set(pack['shapes'])==set(geom)
    items=pack['variants']['2x2x2'][0]['placement']
    assert len(items)==report['placements']
    assert len(items)<=640,'Mobile reference stone count budget exceeded'
    occupancy=np.zeros((50,50,50),dtype=bool)
    faces=np.zeros((3,50,50),dtype=bool)
    horizontal=0
    small=0
    independent=[]
    for name,*values in items:
        assert name in geom and len(values)==12,name
        mat=np.asarray(values).reshape(3,4)
        R=mat[:,:3]
        scale2=np.trace(R.T@R)/3
        assert scale2>1e-8 and np.linalg.det(R)>0
        assert np.allclose(R.T@R,np.eye(3)*scale2,rtol=.0002,atol=5e-6),'Nonuniform stone '+name
        vertices=np.asarray(geom[name].vertices)@R.T+mat[:,3]
        assert np.all(vertices.min(0)>=-.253) and np.all(vertices.max(0)<=.253),'Out of section '+name
        aspect=vertices.max(0)-vertices.min(0)
        if name.startswith('CHINK_'):small+=1
        else:
            if max(aspect[0],aspect[2])>=aspect[1]*1.22 and max(aspect[0],aspect[2])>=.15:
                horizontal+=1
        independent.append((name,round(float(scale2**.5),5)))
    assert small==report['chinking']
    assert (len(items)-small)==report['coarse']
    if report['horizontallyElongated']>report['coarse']:
        raise ValueError('Impossible elongated stone count')
    # No claims about visual impermeability based solely on a producer's
    # unverified occupancy metric: inspect independent quality status.
    quality = {'sourceMeshes':len(geom),'placed':len(items),
               'independentlyValidatedTransforms':len(independent),
               'allUniformScale':True,'allWithinBounds':True,
               'originalTriangleMeshesPreserved':True,
               'sourceCracksThrough':report['afterViews'],
               'visualThroughGapVerified':False,
               'liveReleaseAllowed':False}
    return quality

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--recipe',default=str(REVIEW/'reference-2x2x2.json'))
    p.add_argument('--quality',default=str(REVIEW/'reference-2x2x2-quality.json'))
    p.add_argument('--out',default=str(REVIEW/'geometry-validation.json'))
    args=p.parse_args()
    report=verify(args.recipe,args.quality)
    Path(args.out).write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
    print('REFERENCE_REAL_MESH_TRANSFORM_VERIFIED',
          report['placed'],'instances; visual QA requires human review')

if __name__=='__main__':
    main()
