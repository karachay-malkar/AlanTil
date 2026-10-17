#!/usr/bin/env python3
"""Pilot pass 2: place authored CHINK meshes only where real triangle rays see through.

Uses the approved Common94 GLB without generating/smearing wall geometry.
No artificial exterior cap, no cuboids, no hidden planar backing surface.
Candidate contact is judged against existing convex occupancy (conservative),
whereas actual gap closure is judged against original mesh-triangle rays.
"""
from __future__ import annotations
import argparse,hashlib,importlib.util,json,math
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
import trimesh

ROOT=Path(__file__).resolve().parents[2]
DIR=ROOT/'assets/tower/prefabs/common94/reference-2x2x2'
GEOM=ROOT/'assets/tower/prefabs/common94/common-94.glb'
BAKER=ROOT/'tools/tower/bake-dense-compact-1758.py'
SEED=177202622
spec=importlib.util.spec_from_file_location('pilot_baseline',BAKER)
baseline=importlib.util.module_from_spec(spec);spec.loader.exec_module(baseline)
baseline.LIBRARY=GEOM
baseline.PITCH=.0125

def matrix(row):
    m=np.eye(4);m[:3,:]=np.asarray(row[1:],dtype=float).reshape(3,4)
    return m

def encode(name,m):
    return [name]+[round(float(v),7) for v in m[:3,:].ravel()]

def rays(axis,n):
    pitch=.5/n
    v=np.linspace(-.25+pitch*.5,.25-pitch*.5,n)
    a,b=np.meshgrid(v,v,indexing='ij')
    other=[x for x in range(3) if x!=axis]
    origin=np.zeros((n*n,3))
    origin[:,axis]=.6
    origin[:,other[0]]=a.ravel()
    origin[:,other[1]]=b.ravel()
    direc=np.zeros_like(origin);direc[:,axis]=-1
    return origin,direc

def mask_metrics(mask,pitch):
    # Outside outline is *never* treated as a defect.
    approx=ndi.binary_fill_holes(ndi.binary_closing(
        mask,structure=np.ones((3,3),bool),
        iterations=max(1,round(.0375/pitch))))
    holes=approx & ~mask
    labels,n=ndi.label(holes)
    counts=np.bincount(labels.ravel())[1:]
    return {'coverage':round(float(1-holes.sum()/max(1,approx.sum())),6),
            'gapPixels':int(holes.sum()),
            'largestGapPixels':int(counts.max()) if len(counts) else 0},holes

def full_mesh(source,recipe):
    placed=[]
    for row in recipe:
        m=source.geometry[row[0]].copy()
        m.apply_transform(matrix(row))
        placed.append(m)
    return trimesh.util.concatenate(placed)

def geometry_and_field(pack):
    field=baseline.Field('2x2x2')
    shapes=baseline.source_geometry()
    placed=pack['variants']['2x2x2'][0]['placement']
    for row in placed:
        name=row[0]
        sample=field.sample(shapes[name],matrix(row),shapes[name]['planes'])
        if sample is None:raise ValueError('Pilot contains an out-of-section stone '+name)
        field.add(sample)
    return shapes,field

def pick_targets(masks,field,n,rng):
    opts=[]
    for axis,mask in enumerate(masks):
        met,holes=mask_metrics(mask,.5/n)
        if not holes.any():continue
        labels,count=ndi.label(holes)
        for k in range(1,count+1):
            coords=np.argwhere(labels==k)
            if not len(coords):continue
            center=coords.mean(axis=0)
            uv=tuple(coords[int(np.argmin(np.sum((coords-center)**2,axis=1)))])
            options=[int(i) for i in range(5,field.grid.shape[axis]-5)]
            others=[j for j in range(3) if j!=axis]
            p=np.zeros(3,dtype=float)
            p[others]=-.25+(np.asarray(uv)+.5)*(.5/n)
            # Candidate center should be inside the masonry, not a sticker
            # attached to one of its external faces.
            rng.shuffle(options)
            for depth in options[:18]:
                p[axis]=-.25+(depth+.5)*field.step[axis]
                vox=np.clip(np.floor((p+.25)/field.step).astype(int),0,np.asarray(field.grid.shape)-1)
                if not field.grid[tuple(vox)]:
                    opts.append((len(coords),axis,uv,p.copy()))
                    break
    return sorted(opts,key=lambda x:-x[0])

def trial_stone(name,shape,field,target,scale,rng):
    ext=shape['extents']
    long=int(np.argmax(ext))
    ax=(math.pi/2 if long==1 else 0)+rng.uniform(-.32,.32)
    yaw=rng.uniform(-math.pi,math.pi)
    R=baseline.rotation(ax,yaw,rng.uniform(-.32,.32))
    L=np.abs(R)@ext
    A=R*(scale/max(L))
    vv=shape['vertices']@A.T
    lo=-field.dims/2+.002-vv.min(axis=0)
    hi=field.dims/2-.002-vv.max(axis=0)
    if np.any(lo>hi):return None
    ctr=(shape['vertices'].max(0)+shape['vertices'].min(0))/2
    M=np.eye(4);M[:3,:3]=A
    M[:3,3]=np.clip(target-A@ctr+rng.uniform(-.015,.015,3),lo,hi)
    test=field.sample(shape,M,shape['planes'])
    if test is None:return None
    amount,collide,region,mask=test
    if amount<2 or collide/max(1,amount)>.12:return None
    # Must contact masonry near existing stone faces (oriented small chinking,
    # NOT unsupported isolated pebbles in the centre of the empty void).
    sub=field.grid[region]
    neighbor=ndi.binary_dilation(field.grid,iterations=2)[region]
    contact=int(np.count_nonzero((mask & neighbor) & ~sub))
    if contact<1:return None
    return M,test

def mesh_hits(name,M,source,origin,dirs):
    mesh=source.geometry[name].copy()
    mesh.apply_transform(M)
    return mesh.ray.intersects_any(origin,dirs)

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--samples',type=int,default=64)
    p.add_argument('--limit',type=int,default=90)
    args=p.parse_args()
    rng=np.random.default_rng(SEED)
    source=trimesh.load(GEOM,force='scene',process=False)
    pack=json.loads((DIR/'reference-2x2x2.json').read_text())
    quality=json.loads((DIR/'reference-2x2x2-quality.json').read_text())
    rows=pack['variants']['2x2x2'][0]['placement']
    shapes,field=geometry_and_field(pack)
    coords=[rays(axis,args.samples) for axis in range(3)]
    initial=full_mesh(source,rows)
    masks=[initial.ray.intersects_any(o,d).reshape(args.samples,args.samples) for o,d in coords]
    initial_report=[mask_metrics(m,.5/args.samples)[0] for m in masks]
    chinks=list(n for n in shapes if n.startswith('CHINK_'))
    assert len(chinks)==29
    accepted=0;attempted=0;ignored=set()
    for step in range(args.limit):
        if all(mask_metrics(m,.5/args.samples)[0]['coverage']>=.997 for m in masks):break
        targets=pick_targets(masks,field,args.samples,rng)
        if not targets:break
        candidates=[x for x in targets if (x[1],x[2]) not in ignored]
        if not candidates:break
        count,axis,uv,center=candidates[0]
        gaps=[np.flatnonzero(mask_metrics(m,.5/args.samples)[1].ravel()) for m in masks]
        all_origin=[coords[k][0][v] for k,v in enumerate(gaps)]
        all_dirs=[coords[k][1][v] for k,v in enumerate(gaps)]
        scored=[]
        for attempt in range(50):
            name=chinks[int(rng.integers(len(chinks)))]
            shape=shapes[name]
            size=float(np.clip(rng.uniform(.026,.115)*(1.25 if attempt<18 else 1),.021,.16))
            center_try=center.copy()
            center_try[axis]+=rng.uniform(-.04,.04)
            trial=trial_stone(name,shape,field,center_try,size,rng)
            if trial is None:continue
            M,mask=trial
            hits=[mesh_hits(name,M,source,origin,direc) if len(origin) else np.empty(0,dtype=bool)
                  for origin,direc in zip(all_origin,all_dirs)]
            gains=[int(v.sum()) for v in hits]
            # Strong preference for closing *real* throughholes, not proxy density.
            score=sum(gains)*15+(mask[0]-mask[1])*.025-2*mask[1]
            if gains[axis]==0:continue
            if score>0:scored.append((score,name,M,mask,hits,gains))
        attempted+=1
        if not scored:
            ignored.add((axis,uv))
            continue
        _,name,M,sample,hits,gains=max(scored,key=lambda x:x[0])
        field.add(sample)
        rows.append(encode(name,M))
        accepted+=1
        for k,ids in enumerate(gaps):
            flat=masks[k].ravel()
            flat[ids]=flat[ids] | hits[k]
        if accepted%10==0:
            print('RAY_CHINK',accepted,'tries',attempted,'coverage',
                  [mask_metrics(m,.5/args.samples)[0]['coverage'] for m in masks],flush=True)
    new_report=[mask_metrics(m,.5/args.samples)[0] for m in masks]
    pack['version']='17.7-reference-2x2x2.pilot2'
    pack['variants']['2x2x2'][0]['rocks']=len(rows)
    pack['variants']['2x2x2'][0]['sha256']=hashlib.sha256(
        json.dumps(rows,separators=(',',':')).encode()).hexdigest()
    quality.update(version=pack['version'],placements=len(rows),
                   chinking=quality['chinking']+accepted,
                   'rayFill':{'accepted':accepted,'trials':attempted,'samples':args.samples,
                              'initial':initial_report,'final':new_report,
                              'method':'actual original GLB triangle ray tests',
                              'stillNeedsFinalWholeSceneReraycast':True},
                   'requiresHumanReview':True)
    for path,record in [('reference-2x2x2.json',pack),('reference-2x2x2-quality.json',quality)]:
        (DIR/path).write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
    print('ACTUAL_THROUGH_GAP_INFILL',json.dumps(quality['rayFill']),flush=True)

if __name__=='__main__':main()
