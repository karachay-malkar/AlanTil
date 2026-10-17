#!/usr/bin/env python3
"""Surface-coverage-scored candidate placement from ORIGINAL gate stone meshes.

Keeps approved 17.5.4 layouts, tests additional irregular rocks against true
convex-envelope voxels, and scores only newly covered exterior-face positions.
Rigid rotations and uniform scale exclusively; no cubes, photo renders or
in-game stochastic geometry.
"""
from pathlib import Path
from importlib.util import spec_from_file_location,module_from_spec
import numpy as np,math
ROOT=Path(__file__).resolve().parents[2]
path=ROOT/'tools/tower/improve-gate-faces-17510.py'
sp=spec_from_file_location('gate_face_base',path)
old=module_from_spec(sp);sp.loader.exec_module(old)
gate=old.gate
PITCH=gate.PITCH
OLD_FACE_PASS=old.face_pass
MAX_FACE_INSTANCES=512

def choose_face_stone(bake,axis,side,target,rad,kind,old_face,tries=50):
    rng=bake.rng
    pool=bake.primary if kind=='main' else bake.fill
    # Source rotations mostly have X-long stones lying flat, like the gate.
    options=[]
    for i in range(tries):
        index=int(rng.choice(pool))
        rock=bake.rocks[index][2]
        dims=np.ptp(rock.vertices,axis=0)
        if np.any(dims<1e-5):continue
        if kind=='main':
            requested=min(.44,max(.16,rad*PITCH*2.8))
        else:
            requested=min(.18,max(.095,rad*PITCH*2.2))
        scale=requested/max(dims[0],1e-6)*float(rng.uniform(.83,1.14))
        scale=np.clip(scale,.20 if kind=='main' else .4,1.7)
        # Align the largest exposed rock surface toward the chosen seam face.
        yaw=(math.pi/2 if axis==0 else 0.)+float(rng.uniform(-.26,.26))
        pitch=float(rng.uniform(-.13,.13))
        roll=float(rng.uniform(-.13,.13))
        center=np.asarray(target,dtype=float).copy()
        center+=rng.uniform(-.019,.019,3)
        sample=bake.candidate(index,center,scale,(pitch,yaw,roll))
        if sample is None:continue
        vertices,rotation,center=sample
        coords=bake.voxels(vertices)
        if coords is None:continue
        conflict=int(bake.occupied[tuple(coords.T)].sum())
        if conflict/len(coords)>(.19 if kind=='main' else .14):continue
        # Exact six-face UV-space coverage score, measured on 2.5cm voxels.
        touching=coords[:,axis] <2 if side==0 else coords[:,axis]>=bake.grid[axis]-2
        border=coords[touching]
        if len(border)==0:continue
        axes=[j for j in range(3) if j!=axis]
        uv=np.unique(border[:,axes],axis=0)
        gain=int(np.count_nonzero(~old_face[uv[:,0],uv[:,1]]))
        if gain==0:continue
        new_vox=len(coords)-conflict
        score=gain*24+new_vox*.09-conflict*2.8
        options.append((score,index,kind,scale,rotation,center,vertices,coords,gain))
    if not options:return False,0
    _,index,kind,scale,R,center,vertices,vox,gain=max(options,key=lambda x:x[0])
    bake.occupied[tuple(vox.T)]=True
    bake.placed.append((index,kind,scale,R,center,vertices))
    bake.uses.add(index)
    return True,gain

def target_face_pass(bake,max_extra=None):
    starts=len(bake.placed)
    budget=min(MAX_FACE_INSTANCES,len(bake.placed)+(max_extra if max_extra is not None else MAX_FACE_INSTANCES))
    rejected={(axis,side):np.zeros_like(old.coverage(bake.occupied,axis,side))
              for axis in range(3) for side in range(2)}
    attempts=0
    improvements=0
    while len(bake.placed)<budget and attempts<720:
        possibilities=[]
        for axis in range(3):
            for side in range(2):
                mask=old.coverage(bake.occupied,axis,side)
                if mask.mean()>=.94:continue
                empty=~(mask|rejected[(axis,side)])
                if not empty.any():continue
                d=old.ndi.distance_transform_edt(np.pad(empty,1,constant_values=False))[1:-1,1:-1]
                radius=float(d.max())
                if radius<=.75:continue
                idx=np.unravel_index(int(np.argmax(d)),d.shape)
                weight=radius*(1.+(1.-mask.mean())*.5)
                possibilities.append((weight,axis,side,idx,radius,mask))
        if not possibilities:break
        _,axis,side,coords,rad,mask=max(possibilities,key=lambda x:x[0])
        target=np.zeros(3)
        other=[j for j in range(3) if j!=axis]
        for i,j in enumerate(other):
            target[j]=(coords[i]+.5)*PITCH-bake.dim[j]/2
        target[axis]=(-1 if side==0 else 1)*(bake.dim[axis]/2-.032)
        kind='main' if rad*PITCH>.053 else 'chinking'
        worked,gain=choose_face_stone(bake,axis,side,target,rad,kind,mask,tries=48)
        if not worked and kind=='main':
            worked,gain=choose_face_stone(bake,axis,side,target,rad,'chinking',mask,tries=24)
        attempts+=1
        if worked:
            improvements+=gain
        else:
            low=np.maximum(0,np.asarray(coords)-1)
            high=np.minimum(rejected[(axis,side)].shape,np.asarray(coords)+2)
            rejected[(axis,side)][tuple(slice(int(a),int(b)) for a,b in zip(low,high))]=True
    return dict(added=len(bake.placed)-starts,attempts=attempts,facePixelsAdded=improvements)

old.face_pass=target_face_pass
old.VERSION='17.5.11'
old.OUTPUT=ROOT/'assets/tower/prefabs/balkar71/placements-17_5_11.json'
if __name__=='__main__':old.main()
