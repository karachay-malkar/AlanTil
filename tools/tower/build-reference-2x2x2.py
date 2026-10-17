#!/usr/bin/env python3
"""AlanTil 17.7 - pilot 2x2x2 wild masonry, not a deployable game asset.

True GLB meshes are never replaced with boxes. All placements use rigid
rotation + uniform scale; course stones favour horizontal elongated V/G forms.
Greedy infill targets projected THROUGH holes, never the outer ragged silhouette.
"""
from __future__ import annotations
import argparse, hashlib, importlib.util, json, math
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/tower/prefabs/balkar71/placements-17_5_5.json'
COMMON=ROOT/'assets/tower/prefabs/common94/common-94.glb'
BASE=ROOT/'tools/tower/bake-dense-compact-1758.py'
OUT=ROOT/'assets/tower/prefabs/common94/reference-2x2x2'
PITCH=.0125
MAX_STONES=640
SEED=177202620
MAX_ATTEMPTS=360
KIN='2x2x2'

spec=importlib.util.spec_from_file_location('tower_common94_original_baker',BASE)
legacy=importlib.util.module_from_spec(spec);spec.loader.exec_module(legacy)
legacy.LIBRARY=COMMON
legacy.PITCH=PITCH
legacy.MAX_STONES=MAX_STONES
legacy.MAX_ATTEMPTS=MAX_ATTEMPTS

def encode(name,mat):
    return [name]+[round(float(v),7) for v in mat[:3,:].reshape(-1)]

def real_transform(row):
    return np.array([row[1:5],row[5:9],row[9:13],[0,0,0,1]],float)

def horizontally_elongated(name,shape):
    if name.startswith(('CHINK_','LINTEL_','Zh_')):return False
    span=np.sort(shape['extents'])
    return .28<=span[2]<=.72 and span[2]/span[1]>=1.2 and span[2]/span[0]>=1.37

def is_horizontal(row,shape):
    verts=shape['vertices'] @ real_transform(row)[:3,:3].T
    e=np.ptp(verts,axis=0)
    return max(e[0],e[2])/max(e[1],1e-8)>=1.22

def preselected(pack,shapes):
    source=pack['variants'][KIN][0]['placement']
    large=[x for x in source if horizontally_elongated(x[0],shapes[x[0]]) and is_horizontal(x,shapes[x[0]])]
    # Preserve a few short tie-stones between differently staggered courses.
    ties=[x for i,x in enumerate(source) if i%8==0 and x not in large]
    return large+ties

def map_metrics(grid):
    views=[]
    for axis in range(3):
        silhouette=grid.any(axis=axis)
        # Close narrow gaps ONLY INSIDE the existing rough outline; there
        # is deliberately no fixed rectangular wall skin to be filled.
        hull=ndi.binary_fill_holes(ndi.binary_closing(silhouette,
                                                    structure=np.ones((3,3),bool),
                                                    iterations=3))
        if hull.sum()<1:hull=silhouette
        missing=hull & ~silhouette
        labels,n=ndi.label(missing)
        largest=max((int(np.count_nonzero(labels==k)) for k in range(1,n+1)),default=0)
        views.append({'axis':'xyz'[axis],
                      'silhouetteCoverage':round(float(silhouette.mean()),5),
                      'interiorCoverage':round(float(1-missing.sum()/max(1,hull.sum())),5),
                      'visibleGapSamples':int(missing.sum()),
                      'largestConnectedGapPixels':largest,
                      'naturalContourAreaSamples':int(hull.sum())})
    return views

def hole_target(field,rejections,rng):
    grid=field.grid
    picks=[]
    for axis in range(3):
        cover=grid.any(axis=axis)
        silhouette=ndi.binary_fill_holes(ndi.binary_closing(
            cover,structure=np.ones((3,3),bool),iterations=3))
        if silhouette.sum()<4:continue
        holes=silhouette & ~cover & ~rejections[axis]
        if not holes.any():continue
        dist=ndi.distance_transform_edt(np.pad(holes,1,constant_values=False))[1:-1,1:-1]
        maxd=dist.max()
        points=np.argwhere(dist>=max(1.,maxd*.75))
        if not len(points):continue
        c=points[int(rng.integers(len(points)))]
        quality=float(maxd)+.7*float(holes.sum()/max(1,silhouette.sum()))
        picks.append((quality,axis,c))
    if not picks:return None
    _,axis,uv=max(picks,key=lambda z:z[0])
    other=[j for j in range(3) if j!=axis]
    coords=np.zeros(3,dtype=int)
    coords[other]=uv
    # Choose a genuinely internal depth where at least one wall of stone
    # already exists; never stick a cosmetic pebble outside the silhouette.
    free=np.flatnonzero(~np.take(grid,np.ravel_multi_index((uv[0],uv[1]),[grid.shape[j] for j in other]),axis=axis)
                       ) if False else None
    # Select a mid-depth empty point; 3D proximity will be scored separately.
    depths=[i for i in range(3,grid.shape[axis]-3) if not grid[tuple([i if k==axis else coords[k] for k in range(3)])]]
    if not depths:
        rejections[axis][tuple(uv)]=True
        return None
    coords[axis]=min(depths,key=lambda i:abs(i-grid.shape[axis]/2)+rng.uniform(0,.8))
    center=(coords+.5)*field.step-field.dims/2
    return axis,tuple(int(x) for x in uv),center

def fit_one(field,shapes,main,rubble,center, rng):
    empty=~field.grid
    i=np.clip(np.rint((center+field.dims/2)/field.step-.5).astype(int),0,np.asarray(field.grid.shape)-1)
    dist=ndi.distance_transform_edt(empty,sampling=field.step)
    radius=max(.012,float(dist[tuple(i)]))
    main_phase=radius>.050
    choices=[]
    for trial in range(72):
        preferred=main_phase and trial<48 and rng.random()<.84
        pool=main if preferred else rubble
        name=pool[int(rng.integers(len(pool)))]
        mesh=shapes[name]
        sides=mesh['extents']
        long=int(np.argmax(sides))
        angles=((math.pi/2 if long==1 else 0)+rng.uniform(-.10,.10),
                int(rng.integers(4))*math.pi/2+rng.uniform(-.21,.21),
                rng.uniform(-.10,.10))
        R=legacy.rotation(*angles)
        ext=np.abs(R)@sides
        if ext[1]>max(ext[0],ext[2])*.86:continue
        # Uniform scale only. Coarse first, small chinking as voids narrow.
        length=np.clip(radius*rng.uniform(1.5,2.9),.155,.365) if preferred else np.clip(radius*rng.uniform(.67,1.55),.018,.150)
        scale=float(length/max(ext))
        if np.any(ext*scale>field.dims-.002):
            scale*=float(np.min((field.dims-.002)/np.maximum(ext*scale,1e-8)))
        A=R*scale
        transformed=mesh['vertices']@A.T
        lower=-field.dims/2+.001-transformed.min(axis=0)
        upper=field.dims/2-.001-transformed.max(axis=0)
        if np.any(lower>upper):continue
        M=np.eye(4);M[:3,:3]=A
        ctr=(mesh['vertices'].max(0)+mesh['vertices'].min(0))/2
        M[:3,3]=np.clip(center-A@ctr+rng.uniform(-.007,.007,3),lower,upper)
        sample=field.sample(mesh,M,mesh['planes'])
        if sample is None:continue
        count,collision,region,mask=sample
        if count<2 or collision/count>(.045 if preferred else .07):continue
        new=np.zeros_like(field.grid)
        sub=new[region]
        sub[:]=mask & ~field.grid[region]
        projgain=0
        for axis in range(3):
            projgain+=int(np.count_nonzero(new.any(axis=axis) & ~field.grid.any(axis=axis)))
        if projgain<1:continue
        score=projgain*10+(count-collision)*.16-collision*2.9
        if preferred:score*=1.09
        choices.append((score,name,M,sample,projgain))
    return max(choices,key=lambda c:c[0]) if choices else None

def assemble(shapes,pack,max_stones=MAX_STONES):
    rng=np.random.default_rng(SEED)
    field=legacy.Field(KIN)
    originals=preselected(pack,shapes)
    placed=[];repairs=0
    for row in originals:
        name=row[0]
        sample=field.sample(shapes[name],real_transform(row),shapes[name]['planes'])
        if sample is None:
            repair=legacy.repair_outlying_base(field,shapes[name],row)
            if repair is None:continue
            mat,sample=repair
            row=encode(name,mat);repairs+=1
        field.add(sample);placed.append(row)
    initial=map_metrics(field.grid)
    mains=[name for name in shapes if horizontally_elongated(name,shapes[name])]
    rubble=[name for name in shapes if name.startswith('CHINK_')]
    assert len(mains)>=10 and len(rubble)==29
    rejected={axis:np.zeros_like(field.grid.any(axis=axis)) for axis in range(3)}
    stalls=0;attempts=0
    while len(placed)<max_stones and attempts<MAX_ATTEMPTS:
        metrics=map_metrics(field.grid)
        if min(x['interiorCoverage'] for x in metrics)>=.995 and max(x['largestConnectedGapPixels'] for x in metrics)<=1:
            break
        target=hole_target(field,rejected,rng)
        if target is None:break
        axis,uv,where=target
        fit=fit_one(field,shapes,mains,rubble,where,rng)
        attempts+=1
        if fit is None:
            rejected[axis][uv]=True
            stalls+=1
            if stalls>80:break
            continue
        _,name,mat,sample,_=fit
        field.add(sample);placed.append(encode(name,mat))
        stalls=0
        if attempts%35==0:
            print('PROGRESS',attempts,len(placed),
                  'projections',[m['interiorCoverage'] for m in map_metrics(field.grid)],flush=True)
    final=map_metrics(field.grid)
    primary=[row for row in placed if not row[0].startswith('CHINK_')]
    horizontal=[row for row in primary if horizontally_elongated(row[0],shapes[row[0]]) and is_horizontal(row,shapes[row[0]])]
    report={'version':'17.7-reference-2x2x2.pilot1','sectionId':KIN,'variant':0,
        'dimensionsMeters':[.5,.5,.5],
        'modelsAvailable':94,'geometry':'original Common94 GLB meshes; rigid+uniform transforms',
        'criterion':'through-gap silhouette closure excluding ragged outer contour',
        'samplingPitchMeters':PITCH,
        'coarse':len(primary),'horizontallyElongated':len(horizontal),
        'horizontalShare':round(len(horizontal)/max(1,len(primary)),5),
        'chinking':len(placed)-len(primary),'placements':len(placed),
        'voxelConvexDensityUpperBound':round(float(field.grid.mean()),5),
        'beforeViews':initial,'afterViews':final,
        'visualGapProof':'convex-hull voxel PROXY; cannot certify real triangle geometry',
        'requiresHumanReview':True, 'attempts':attempts,'repairedSourceCoarse':repairs}
    return placed,report

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--out',default=str(OUT))
    p.add_argument('--max-stones',type=int,default=MAX_STONES)
    opt=p.parse_args()
    shapes=legacy.source_geometry()
    assert len(shapes)==94
    pack=json.loads(SOURCE.read_text('utf8'))
    placements,report=assemble(shapes,pack,opt.max_stones)
    output=Path(opt.out);output.mkdir(parents=True,exist_ok=True)
    recipe={'version':report['version'],'cellMeters':.25,
        'library':'/assets/tower/prefabs/common94/common-94.glb',
        'shapes':list(shapes),
        'variants':{KIN:[{'size':[.5,.5,.5],'rocks':len(placements),
            'placement':placements,'sha256':hashlib.sha256(
                 json.dumps(placements,separators=(',',':')).encode()).hexdigest()}]},
        'report':'reference-2x2x2-quality.json'}
    (output/'reference-2x2x2.json').write_text(json.dumps(recipe,ensure_ascii=False,separators=(',',':'))+'\n','utf8')
    (output/'reference-2x2x2-quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf8')
    print('REFERENCE',json.dumps({key:report[key] for key in [
        'placements','coarse','horizontallyElongated','horizontalShare',
        'chinking','voxelConvexDensityUpperBound','afterViews']},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
