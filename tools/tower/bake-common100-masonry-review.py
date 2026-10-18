#!/usr/bin/env python3
"""Offline Common100 masonry preview. Never referenced by production tower scene.

All stone positions are stored as immutable geometry instance recipes; the
browser only renders the authored source geometry. Convex stone proxies are
used to search collision-free placements, never exported as blocky geometry.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import trimesh
from scipy.spatial import ConvexHull
from scipy.ndimage import binary_dilation

ROOT=Path(__file__).resolve().parents[2]
LIB=ROOT/"assets/tower/prefabs/common100/common-100.glb"
META=ROOT/"assets/tower/prefabs/common100/common-100.json"
OUT=ROOT/"assets/tower/prefabs/common100/masonry-review-v1.json"
STEP=.025
SIZES={"1x1x1":(1,1,1),"2x2x2":(2,2,2),"2x2x3":(2,2,3),
       "2x3x4":(2,3,4),"4x4x4":(4,4,4)}
ARCH={"window":(4,5,2),"door":(7,9,2),"gate":(18,10,2)}
JOINTS={"joint-x":(2,1,1),"joint-y":(1,1,2),
        "joint-z":(1,2,1),"joint-corner":(1,1,1)}
PRESET=20261018

def clean(v):
    return [float(round(float(z),6)) for z in v]

def candidate(source,name,scale,yaw):
    v=source[name].vertices.copy()
    angle=int(yaw)%4
    rot=np.array([[[1,0,0],[0,1,0],[0,0,1]],
                  [[0,0,1],[0,1,0],[-1,0,0]],
                  [[-1,0,0],[0,1,0],[0,0,-1]],
                  [[0,0,-1],[0,1,0],[1,0,0]]][angle],float)
    world=(v@rot.T)*scale
    low=world.min(axis=0); high=world.max(axis=0)
    length=np.maximum(1,np.ceil((high-low)/STEP).astype(int))
    hull=ConvexHull(world)
    coords=[low[i]+(np.arange(length[i])+.5)*STEP for i in range(3)]
    mesh=np.stack(np.meshgrid(*coords,indexing="ij"),axis=-1).reshape(-1,3)
    inside=(mesh@hull.equations[:,:3].T+hull.equations[:,3]<=.002).all(axis=1)
    mask=inside.reshape(tuple(length))
    if mask.sum()<4: return None
    return {"name":name,"scale":float(scale),"yaw":angle,
            "mask":mask,"n":length,"low":low,"voxels":int(mask.sum()),
            "bounds":(high-low)}

def transform(item,origin,world_size):
    # Authored geometry stays untouched, only a uniform instance transform.
    rot=item["yaw"];s=item["scale"]
    R=([ [1,0,0],[0,1,0],[0,0,1] ] if rot==0 else
       [ [0,0,1],[0,1,0],[-1,0,0] ] if rot==1 else
       [ [-1,0,0],[0,1,0],[0,0,-1] ] if rot==2 else
       [ [0,0,-1],[0,1,0],[1,0,0] ])
    A=np.asarray(R)*s
    offset=np.asarray(origin,dtype=float)*STEP-item["low"]-world_size/2
    return [item["name"],*clean([A[0,0],A[0,1],A[0,2],offset[0],
                                A[1,0],A[1,1],A[1,2],offset[1],
                                A[2,0],A[2,1],A[2,2],offset[2]])]

def inside_target(size,kind):
    eligible=np.ones(size,dtype=bool)
    if kind=="window":
        eligible[10:30,0:40,:]=False
    elif kind=="door":
        eligible[20:50,0:80,:]=False
    elif kind=="gate":
        eligible[50:130,0:80,:]=False
    return eligible

def select_pool(source,meta,dimensions,small=False):
    pool=[]
    groups={"chinking"} if small else {"main","large"}
    for info in meta["models"]:
        if info["category"] not in groups: continue
        for s in ((.85,1.0,1.12) if small else (.60,.76,.92,1.06)):
            for yaw in (0,1):
                item=candidate(source,info["name"],s,yaw)
                if item is not None and np.all(item["n"]<=dimensions):
                    pool.append(item)
    pool.sort(key=lambda p:p["voxels"],reverse=True)
    return pool

def place_one(occupancy,eligible,pool,rng,world_size,placement,metrics,small=False):
    size=occupancy.shape
    if not pool:return False
    # Coarse front-facing and staggered stones are preferred to hidden infill.
    # Trial spots are chosen at the lowest free height of random X/Z columns.
    for _ in range(90 if small else 125):
        x=int(rng.integers(size[0]));z=int(rng.integers(size[2]))
        free=np.flatnonzero(eligible[x,:,z]&~occupancy[x,:,z])
        if not len(free):continue
        h=int(free[0] if rng.random()<.88 else rng.choice(free[:min(5,len(free))]))
        if small:
            item=pool[int(rng.integers(len(pool)))]
        else:
            # Large stones start low; small rocks fill late remaining pockets.
            k=int(len(pool)*(rng.random()**1.7))
            item=pool[min(len(pool)-1,k)]
        n=item["n"]
        if np.any(n>size):continue
        start=np.array([
            np.clip(x-int(rng.integers(n[0])),0,size[0]-n[0]),
            np.clip(h-int(rng.integers(min(n[1],4))),0,size[1]-n[1]),
            np.clip(z-int(rng.integers(n[2])),0,size[2]-n[2])],dtype=int)
        # Source bbox should not cross the invisible structural aperture.
        sl=tuple(slice(int(start[i]),int(start[i]+n[i])) for i in range(3))
        allowed=eligible[sl]; taken=occupancy[sl]; mask=item["mask"]
        if np.any(mask&~allowed):continue
        count=item["voxels"]
        collision=int(np.count_nonzero(mask&taken))
        if collision>max(1,int(count*.008)):continue
        if start[1]>0:
            # A supported stone must contact the existing course from beneath,
            # not simply float near an unrelated neighboring stone.
            bottom=np.zeros(mask.shape[::2],dtype=bool)
            for y in range(mask.shape[1]):
                bottom|=mask[:,y,:]
            under=occupancy[sl[0],slice(max(0,start[1]-1),start[1]),sl[2]]
            contact=0 if not under.size else np.count_nonzero(bottom&under[:,0,:])
            if contact<max(2,int(np.count_nonzero(bottom)*.045)):continue
        if not small and count<15:continue
        occupancy[sl]|=mask
        placement.append(transform(item,start,world_size))
        metrics["overlapVoxels"]+=collision
        return True
    return False

def build_case(kind,variant,source,meta,main_cache,chink_cache):
    dims=tuple(SIZES.get(kind,ARCH.get(kind,JOINTS.get(kind))))
    shape=tuple(10*x for x in dims)
    eligible=inside_target(shape,kind)
    occupied=np.zeros(shape,dtype=bool)
    rng=np.random.default_rng(PRESET+variant*1793+sum(ord(c) for c in kind)*59)
    placement=[]
    stats={"overlapVoxels":0}
    world_size=np.asarray(shape)*STEP
    if kind in ("window","door"):
        # The single self-supporting large stone lintel spans the opening.
        name="LINTEL_001" if kind=="window" else "LINTEL_003"
        width=40 if kind=="window" else 50
        origin=(0 if kind=="window" else 10,40 if kind=="window" else 80,0)
        item=candidate(source,name,1.0,0)
        if item is None or any(item["n"][i]>shape[i]-origin[i] for i in range(3)):
            raise RuntimeError("Cannot seat authorized stone lintel "+kind)
        sl=tuple(slice(origin[i],origin[i]+int(item["n"][i])) for i in range(3))
        if np.any(~eligible[sl]&item["mask"]):
            raise RuntimeError("Lintel obstructs required opening "+kind)
        occupied[sl]|=item["mask"]
        placement.append(transform(item,origin,world_size))
    if kind=="gate":
        # Gate uses its already-approved long spanning header in the current
        # architectural GLB. No unsafe fictitious 2m stone lintel is inserted.
        pass
    key="x".join(map(str,dims))
    if key not in main_cache:
        main_cache[key]=select_pool(source,meta,np.array(shape),False)
        chink_cache[key]=select_pool(source,meta,np.array(shape),True)
    main=main_cache[key];small=chink_cache[key]
    budget={"1x1x1":12,"2x2x2":75,"2x2x3":110,"2x3x4":150,
            "4x4x4":270,"window":95,"door":230,"gate":470,
            "joint-x":12,"joint-y":12,"joint-z":12,"joint-corner":8}[kind]
    failures=0
    for i in range(budget):
        if int(np.count_nonzero(occupied&eligible))>=int(np.count_nonzero(eligible)*.82):
            break
        success=place_one(occupied,eligible,main,rng,world_size,placement,stats)
        failures=0 if success else failures+1
        if failures>20:break
    for i in range(min(250,round(budget*1.35))):
        if int(np.count_nonzero(occupied&eligible))>=int(np.count_nonzero(eligible)*.91):
            break
        success=place_one(occupied,eligible,small,rng,world_size,placement,stats,True)
        failures=0 if success else failures+1
        if failures>45:break
    filled=int(np.count_nonzero(occupied&eligible));total=int(eligible.sum())
    coverage=[]
    for ax in (0,1,2):
        for at in (0,-1):
            at_idx=0 if at==0 else shape[ax]-1
            sl=np.take(occupied,at_idx,axis=ax)
            allowed=np.take(eligible,at_idx,axis=ax)
            coverage.append(round(float((sl&allowed).sum()/max(1,allowed.sum())),3))
    return {"id":kind,"variant":variant,"cells":list(dims),
            "placement":placement,
            "quality":{"voxelPitchMeters":STEP,"estimatedEnvelopeFill":round(filled/total,4),
                       "faceCoverage":coverage,"rocks":len(placement),
                       "overlapVoxels":stats["overlapVoxels"],
                       "note":"Convex proxy occupancy, not proven physical density"}}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--only",default=None,help="optional size or architectural case")
    args=parser.parse_args()
    meta=json.loads(META.read_text())
    if meta["version"]!="17.7-common100.10":
        raise RuntimeError("Unexpected Common100 source version")
    scene=trimesh.load(LIB,force="scene",process=False)
    shapes=scene.geometry
    if len(shapes)!=100 or len(meta["models"])!=100:
        raise RuntimeError("Common100 source incomplete")
    versions={v["name"] for v in meta["models"]}
    if set(shapes)!=versions:raise RuntimeError("GLB / JSON model mismatch")
    if not all(mesh.is_watertight for mesh in shapes.values()):
        raise RuntimeError("An authored rock is open")
    all_cases={**SIZES,**ARCH,**JOINTS}
    main_cache={};chink_cache={}
    output=[]
    for name in all_cases:
        if args.only and name!=args.only:continue
        for v in range(5 if name in SIZES else 1):
            case=build_case(name,v,shapes,meta,main_cache,chink_cache)
            output.append(case)
            print("REVIEW_CASE",name,v,"stones",case["quality"]["rocks"],
                  "proxy_fill",case["quality"]["estimatedEnvelopeFill"],
                  "min_face",min(case["quality"]["faceCoverage"]),flush=True)
    result={"version":"common100-masonry-review.1",
        "sourceVersion":meta["version"],"sourceSHA256":hashlib.sha256(LIB.read_bytes()).hexdigest(),
        "cellMeters":.25,"gridPitchMeters":STEP,
        "previewOnly":True,"productionIntegrated":False,
        "architectureNote":"Gate stone piers only; historic spanning header remains separate",
        "cases":output}
    if not args.only:
        OUT.write_text(json.dumps(result,separators=(",",":"),ensure_ascii=False)+"\n")
    print("MASONRY_REVIEW_PREVIEW_GENERATED",len(output),"cases",flush=True)
if __name__=="__main__":main()
