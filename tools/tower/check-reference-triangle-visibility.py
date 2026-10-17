#!/usr/bin/env python3
"""Raycast *original GLB triangles* of staged 2×2×2 stone recipe on 3 axes.

Unlike convex voxel proxies this does not infer that a convex hull is opaque.
Measured projection is a 2D raster of actual triangle intersections.
The exterior irregular contour is omitted via closing only within silhouette.
"""
from __future__ import annotations
import argparse, json
from pathlib import Path
import numpy as np
import trimesh
from scipy import ndimage as ndi

ROOT=Path(__file__).resolve().parents[2]
REVIEW=ROOT/'assets/tower/prefabs/common94/reference-2x2x2'
LIB=ROOT/'assets/tower/prefabs/common94/common-94.glb'

def image_metrics(mask,spacing):
    closure=ndi.binary_fill_holes(ndi.binary_closing(
        mask,structure=np.ones((3,3),bool),
        iterations=max(1,round(.0375/spacing))))
    if closure.sum()<1:closure=mask.copy()
    holes=closure & ~mask
    labels,n=ndi.label(holes)
    count=np.bincount(labels.ravel())[1:]
    return {'samplesPerAxis':int(mask.shape[0]),'samplingMeters':round(spacing,6),
            'silhouetteCoverage':round(float(mask.mean()),6),
            'interiorCoverage':round(float(1.-holes.sum()/max(1,closure.sum())),6),
            'interiorGapPixels':int(holes.sum()),
            'largestInternalHolePixels':int(count.max()) if len(count) else 0,
            'referenceContourPixels':int(closure.sum())}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--samples',type=int,default=80)
    ap.add_argument('--out',default=str(REVIEW/'actual-triangle-visibility.json'))
    options=ap.parse_args()
    if options.samples < 24 or options.samples > 200:raise ValueError('Bad ray grid')
    source=trimesh.load(LIB,force='scene',process=False)
    pack=json.loads((REVIEW/'reference-2x2x2.json').read_text('utf8'))
    items=pack['variants']['2x2x2'][0]['placement']
    solids=[]
    for name,*coords in items:
        mesh=source.geometry[name].copy()
        M=np.eye(4)
        M[:3,:]=np.asarray(coords,dtype=float).reshape(3,4)
        mesh.apply_transform(M)
        solids.append(mesh)
    full=trimesh.util.concatenate(solids)
    count=options.samples
    spacing=.5/count
    positions=np.linspace(-.25+spacing/2,.25-spacing/2,count)
    result=[]
    for axis in range(3):
        other=[i for i in range(3) if i!=axis]
        a,b=np.meshgrid(positions,positions,indexing='ij')
        origins=np.zeros((count*count,3),float)
        origins[:,axis]=.6
        origins[:,other[0]]=a.ravel()
        origins[:,other[1]]=b.ravel()
        rays=np.zeros_like(origins)
        rays[:,axis]=-1
        mask=full.ray.intersects_any(origins,rays).reshape(count,count)
        m=image_metrics(mask,spacing)
        m['axis']='xyz'[axis]
        result.append(m)
        print('REAL_TRIANGLES_AXIS',m['axis'],'coverage',m['interiorCoverage'],
              'gapPx',m['interiorGapPixels'],'largestHole',m['largestInternalHolePixels'],flush=True)
    passed=all(v['interiorCoverage']>=.995 and v['largestInternalHolePixels']<=3 for v in result)
    payload={'asset':'AlanTil 2x2x2 staged reference','geometry':'real transformed source triangles',
             'pointsPerAxis':count*count,'models':len(solids),'rayDirections':'x/y/z; opposite ray is same through-gap projection',
             'passesAt99_5PercentAndAtMost3PixelHole':passed,
             'minimumInternalCoverage':min(v['interiorCoverage'] for v in result),
             'views':result,'liveDeploymentPermitted':False,
             'needsVisualApproval':True}
    target=Path(options.out);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
    print('ACTUAL_RAY_PROOF_WRITTEN',str(target),'pass=',passed,flush=True)

if __name__=='__main__':main()
