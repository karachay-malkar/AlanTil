#!/usr/bin/env python3
"""Offline dense wild-masonry packing on the immutable 17.5.5 authored stone library.

No browser-side packing, cubes, fake density, image generation, or source-mesh edits.
Samples convex envelopes on a 2.5 cm grid. These metrics measure convex proxies
and MUST NOT be presented as a watertight-triangle/photometric certification.
Only promote output to a new geometry version after quality and visual QA.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull
import trimesh

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/tower/prefabs/balkar71/placements-17_5_5.json'
LIBRARY=ROOT/'assets/tower/prefabs/balkar71/library-wall-17_5_5.glb'
OUTPUT=ROOT/'assets/tower/prefabs/balkar71/placements-17_5_8.json'
PITCH=.025
CELL=.25
SEED=175800
VERSION='17.5.8'
MAX_STONES=512
MAX_ATTEMPTS=65
KINDS=('1x1x1','2x2x2','2x2x3','2x3x4','4x4x4')

def transform(row):
    return np.array([row[1:5],row[5:9],row[9:13],[0,0,0,1]],dtype=float)

def encode(name,m):
    return [name]+[round(float(v),6) for v in m[:3,:].reshape(-1)]

class Field:
    def __init__(self,key):
        self.dims=np.array([int(x) for x in key.split('x')],dtype=float)*CELL
        self.res=np.rint(self.dims/PITCH).astype(int)
        self.grid=np.zeros(tuple(self.res),bool)
        self.step=self.dims/self.res

    def sample(self,shape,matrix,planes,allow_outside=.002):
        verts=shape['vertices']@matrix[:3,:3].T+matrix[:3,3]
        mn=verts.min(axis=0);mx=verts.max(axis=0)
        if np.any(mn < -self.dims/2-allow_outside) or np.any(mx > self.dims/2+allow_outside):
            return None
        low=np.maximum(0,np.floor((mn+self.dims/2)/self.step).astype(int))
        high=np.minimum(self.res,np.ceil((mx+self.dims/2)/self.step).astype(int))
        if np.any(high<=low):return None
        axes=[(np.arange(low[i],high[i])+.5)*self.step[i]-self.dims[i]/2 for i in range(3)]
        xyz=np.stack(np.meshgrid(*axes,indexing='ij'),axis=-1).reshape(-1,3)
        try: inv=np.linalg.inv(matrix[:3,:3])
        except np.linalg.LinAlgError:return None
        local=(xyz-matrix[:3,3])@inv.T
        inside=np.ones(len(xyz),bool)
        # Each input is an authored mesh, not the bounding box.
        # Convex envelope is a fast conservative collision/occupancy estimate.
        for plane in planes:
            inside &= (local@plane[:3]+plane[3])<=1e-6
            if not inside.any():break
        mask=inside.reshape(tuple(high-low))
        count=int(mask.sum())
        if count<2:return None
        region=tuple(slice(int(lo),int(hi)) for lo,hi in zip(low,high))
        collision=int(np.count_nonzero(self.grid[region]&mask))
        return count,collision,region,mask

    def add(self,trial):
        _,_,region,mask=trial
        self.grid[region]|=mask

    def metrics(self):
        g=self.grid
        # First/last 2 voxel layers: is any part of the exposed face covered?
        face=[]
        for axis in range(3):
            face.append(float(np.take(g,[0,1],axis=axis).any(axis=axis).mean()))
            face.append(float(np.take(g,[-2,-1],axis=axis).any(axis=axis).mean()))
        return dict(occupancy=round(float(g.mean()),5),
                    faceCoverage=[round(v,5) for v in face],
                    minFaceCoverage=round(min(face),5))

def source_geometry():
    scene=trimesh.load(LIBRARY,force='scene',process=False)
    result={}
    for name,mesh in scene.geometry.items():
        verts=np.asarray(mesh.vertices,dtype=float)
        if len(verts)<4:continue
        hull=ConvexHull(verts)
        result[name]=dict(vertices=verts,planes=hull.equations,extents=np.ptp(verts,axis=0))
    return result

def rotation(rx,yaw,rz=0):
    cx,sx=np.cos(rx),np.sin(rx)
    cy,sy=np.cos(yaw),np.sin(yaw)
    cz,sz=np.cos(rz),np.sin(rz)
    return (np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@
            np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])@
            np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]]))

def candidates(field,shapes,names,location,radius,rng,phase):
    scored=[]
    # Initial stone set is immutable and acts as load-bearing large stones;
    # fill only measured vacancies with additional small irregular authored rock.
    for j in range(22):
        name=names[int(rng.integers(len(names)))]
        shape=shapes[name]
        sides=shape['extents']
        if min(sides)<=0:continue
        # Keep the long axis horizontal without non-uniform stretching.
        long=int(np.argmax(sides))
        yaw=(int(rng.integers(4))*math.pi/2)+rng.uniform(-.17,.17)
        rx=math.pi/2*(1 if rng.random()<.5 else -1) if long==1 else rng.uniform(-.10,.10)
        rz=rng.uniform(-.10,.10)
        R=rotation(rx,yaw,rz)
        physical=np.abs(R)@sides
        natural_length=max(float(physical.max()),1e-7)
        diameter=min(.30 if phase==0 else .17,
                     max(.058,2.45*radius*(.86+float(rng.random())*.3)))
        scale=diameter/natural_length
        ext=np.abs(R)@sides*scale
        if ext[1]>max(ext[0],ext[2])*1.8:continue
        # Shift the real rock INSIDE the section instead of shrinking it at
        # boundaries. Previous clipping to the available centre margin left
        # all six exterior faces riddled with small uncovered holes.
        if np.any(ext>field.dims-.003):
            scale*=float(np.min((field.dims-.003)/np.maximum(ext,1e-8)))
        if scale*natural_length<.045:continue
        A=R*scale
        vertices=shape['vertices']@A.T
        lo=-field.dims/2+.001-vertices.min(axis=0)
        hi=field.dims/2-.001-vertices.max(axis=0)
        if np.any(lo>hi):continue
        ctr=(shape['vertices'].min(0)+shape['vertices'].max(0))*.5
        M=np.eye(4)
        M[:3,:3]=A
        M[:3,3]=np.clip(location-A@ctr+rng.uniform(-.007,.007,3),lo,hi)
        trial=field.sample(shape,M,shape['planes'])
        if trial is None:continue
        cells,clashes,*_=trial
        if clashes/cells>(.09 if phase==0 else .065):continue
        # Newly filled envelope rather than a mesh AABB is the score.
        score=(cells-clashes)-4.5*clashes
        scored.append((score,name,M,trial))
    if not scored:return None
    return max(scored,key=lambda x:x[0])

def fill(field,shapes,rng,placements,verbose=False):
    # Prioritise genuinely large connected gaps, then surface chinking.
    names=list(shapes)
    # Avoid over-large material growth by retaining intrinsic source proportions.
    stalls=0
    excluded=np.zeros_like(field.grid)
    for step in range(MAX_STONES-len(placements)):
        void=~(field.grid|excluded)
        if not void.any():break
        dist=ndi.distance_transform_edt(np.pad(void,1,constant_values=False))[1:-1,1:-1,1:-1]*PITCH
        max_rad=float(dist.max())
        if max_rad<.021:break
        # Rotate through high-radius candidate pockets when a peak resists fitting.
        limit=.035 if step<150 else .024
        peaks=np.argwhere(dist>=max(limit,max_rad*.89))
        if len(peaks)==0:break
        index=peaks[int(rng.integers(len(peaks)))]
        center=(index+.5)*field.step-field.dims/2
        phase=0 if max_rad>.063 else 1
        chosen=candidates(field,shapes,names,center,float(dist[tuple(index)]),rng,phase)
        if chosen is None or chosen[0]<2:
            # Skip resistant peaks in SEARCH only; never falsify measured occupancy.
            lo=np.maximum(0,index-1);hi=np.minimum(field.res,index+2)
            excluded[tuple(slice(int(a),int(b)) for a,b in zip(lo,hi))]=True
            stalls+=1
            if stalls>=MAX_ATTEMPTS:break
            continue
        stalls=0
        _,name,matrix,trial=chosen
        field.add(trial)
        placements.append(encode(name,matrix))
        if verbose and step%50==0:
            print('FILL',step,'stones',len(placements),'density',round(field.grid.mean(),4),flush=True)
        if field.grid.mean()>=.94:break

def bake_case(key,variant,pack,shapes,verbose=False):
    rng=np.random.default_rng(SEED+variant*991+sum(int(x) for x in key.split('x'))*1009)
    recipe=pack['variants'][key][variant]
    field=Field(key)
    placements=[]
    bad=[]
    for row in recipe['placement']:
        name=row[0]
        if name not in shapes:raise ValueError('Unknown authored shape '+name)
        trial=field.sample(shapes[name],transform(row),shapes[name]['planes'])
        if trial is None:
            bad.append(name)
            # Retain old geometry in the original file, but reject the new bake
            # if the coordinates do not fit its declared section bounds.
            continue
        placements.append(row)
        field.add(trial)
    if bad:
        raise ValueError(f'{key} variant {variant}: invalid base transforms: {bad[:5]}')
    before=field.metrics()
    fill(field,shapes,rng,placements,verbose)
    quality=field.metrics()
    result=dict(rocks=len(placements),size=recipe['size'],placement=placements,
                occupancy=quality['occupancy'],faceCoverage=quality['faceCoverage'],
                minFaceCoverage=quality['minFaceCoverage'],
                baselineOccupancy=before['occupancy'],
                provenance='unchanged 17.5.5 large stones + offline irregular authored rubble',
                metric='convex-envelope voxel approximation at 0.025m',
                sha256=hashlib.sha256(json.dumps(placements,separators=(',',':')).encode()).hexdigest())
    return result

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--kind',choices=KINDS)
    parser.add_argument('--variant',type=int,choices=range(5))
    parser.add_argument('--verbose',action='store_true')
    parser.add_argument('--out',default=str(OUTPUT))
    args=parser.parse_args()
    pack=json.loads(SOURCE.read_text('utf8'))
    shapes=source_geometry()
    missing=set(pack['shapes'])-set(shapes)
    if missing:raise ValueError(f'GLB source shape names mismatch: {sorted(missing)[:10]}')
    combos=[(key,v) for key in (args.kind,) if key for v in
            ([args.variant] if args.variant is not None else range(5))] if args.kind else [
            (key,v) for key in KINDS for v in range(5)]
    variants={}
    for key,v in combos:
        recipe=bake_case(key,v,pack,shapes,args.verbose)
        variants.setdefault(key,{})[v]=recipe
        print('BAKED',key,v,'stones',recipe['rocks'],'density',
              recipe['occupancy'],'baseline',recipe['baselineOccupancy'],
              'minimum outer face',recipe['minFaceCoverage'],flush=True)
    result=dict(version=VERSION,cellMeters=CELL,library=pack['library'],
                shapes=pack['shapes'],variants={k:[v[i] for i in sorted(v)] for k,v in variants.items()},
                totalPlacements=sum(r['rocks'] for vs in variants.values() for r in vs.values()),
                generator='tools/tower/bake-dense-compact-1758.py',
                sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest())
    out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(result,separators=(',',':'),ensure_ascii=False)+'\n',encoding='utf8')
    print('WRITTEN',out,'bytes',out.stat().st_size,'cases',len(combos),flush=True)

if __name__=='__main__':main()
