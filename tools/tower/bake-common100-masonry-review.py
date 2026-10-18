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
    underside=mask.copy()
    underside[:,1:,:] &= ~mask[:,:-1,:]
    bx,by,bz=np.where(underside)
    mid=np.argwhere(mask).mean(axis=0)

    return {"name":name,"scale":float(scale),"yaw":angle,
            "mask":mask,"n":length,"low":low,"voxels":int(mask.sum()),
            "bounds":(high-low),"underside":(bx,by,bz),"centre_xz":(mid[0],mid[2])}

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
    """Gravity-supported placement. Fronts are packed before core; no floating filler."""
    size=occupancy.shape
    if not pool:return False
    from scipy.ndimage import binary_dilation
    neighbor_grid=binary_dilation(occupancy,iterations=1)
    best=None;highest=-1e20
    for trial in range(115 if small else 155):
        # Prefer already occupied neighborhoods and unfilled boundary pockets.
        axis=int(rng.choice((0,2)))
        p=int(rng.integers(size[axis]))
        if rng.random()<(.72 if small else .50):
            p=int(rng.choice((0,1,size[axis]-2,size[axis]-1)))
        q=int(rng.integers(size[2-axis]))
        x,z=(p,q) if axis==0 else (q,p)
        free=np.flatnonzero(eligible[x,:,z]&~occupancy[x,:,z])
        if not len(free):continue
        # The bottom of the candidate is seated on the floor or occupied stones.
        h=int(free[0] if rng.random()<.83 else rng.choice(free[:min(6,len(free))]))
        frac=rng.random()
        item=pool[min(len(pool)-1,int(len(pool)*(frac**(1.30 if small else 2.3))))]
        n=item["n"]
        if np.any(n>size):continue
        ox=int(np.clip(x-int(rng.integers(n[0])),0,size[0]-n[0]))
        oz=int(np.clip(z-int(rng.integers(n[2])),0,size[2]-n[2]))
        if rng.random()<.24:
            ox=int(rng.choice((0,size[0]-n[0])))
        if rng.random()<.24:
            oz=int(rng.choice((0,size[2]-n[2])))
        floor=int(np.clip(h-int(rng.integers(max(1,min(n[1],5)))),0,size[1]-n[1]))
        # Test nearby elevations, then move upwards only when necessary.
        levels=sorted(set([floor, max(0,floor-2), max(0,floor-1),
                           min(size[1]-n[1],floor+1),
                           min(size[1]-n[1],floor+2)]))
        accepted=None
        for yy in levels:
            st=np.array((ox,yy,oz),dtype=int)
            sl=tuple(slice(int(st[i]),int(st[i]+n[i])) for i in range(3))
            mask=item["mask"]
            if np.any(mask&~eligible[sl]):continue
            collision=int(np.count_nonzero(mask&occupancy[sl]))
            if collision>max(1,int(item["voxels"]*.003)):continue
            # Bottom contact is evaluated on the actual exposed downward-facing
            # voxel surface, NOT on the projection of the entire stone.
            bx,by,bz=item["underside"]
            global_y=yy+by
            on_floor=global_y==0
            support_x=bx[on_floor].tolist()
            support_z=bz[on_floor].tolist()
            above=~on_floor
            if np.any(above):
                below=occupancy[ox+bx[above],global_y[above]-1,oz+bz[above]]
                support_x.extend(bx[above][below].tolist())
                support_z.extend(bz[above][below].tolist())
            support=len(support_x)
            if support<max(1,int(len(bx)*(.065 if small else .105))):continue
            # The stone's projected centre must stay over its actual support
            # polygon (approximately, using a conservative bounding interval).
            centroid=np.asarray(item["centre_xz"])
            tolerance=np.maximum(1,n[[0,2]]*.17)
            if (centroid[0]<min(support_x)-tolerance[0] or
                centroid[0]>max(support_x)+tolerance[0] or
                centroid[1]<min(support_z)-tolerance[1] or
                centroid[1]>max(support_z)+tolerance[1]):continue
            contact=int(np.count_nonzero(mask&neighbor_grid[sl]&~occupancy[sl]))
            if yy>0 and contact<2:continue
            border=0
            for a in (0,2):
                for target in (0,size[a]-1):
                    relative=target-int(st[a])
                    if 0<=relative<n[a]:
                        border+=int(np.take(mask,relative,axis=a).sum())
            # Larger stones form the weight-bearing masonry; smaller supported
            # stones preferentially close exposed perimeter recesses.
            score=(item["voxels"]-collision)+contact*1.1+border*(3.0 if small else 2.0)
            score+=support*.35
            if score>highest:
                highest=score;accepted=(item,st,sl,collision,support,contact)
        if accepted is not None:
            best=accepted
    if best is None:return False
    item,start,sl,collision,support,contact=best
    occupancy[sl]|=item["mask"]
    placement.append(transform(item,start,world_size))
    metrics["overlapVoxels"]+=collision
    metrics.setdefault("minSupport",support)
    metrics["minSupport"]=min(metrics["minSupport"],support)
    metrics["contactFaces"]=metrics.get("contactFaces",0)+contact
    return True


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
    budget={"1x1x1":18,"2x2x2":145,"2x2x3":190,"2x3x4":245,
            "4x4x4":385,"window":190,"door":330,"gate":420,
            "joint-x":18,"joint-y":18,"joint-z":18,"joint-corner":12}[kind]
    failures=0
    for i in range(budget):
        if int(np.count_nonzero(occupied&eligible))>=int(np.count_nonzero(eligible)*.93):
            break
        success=place_one(occupied,eligible,main,rng,world_size,placement,stats)
        failures=0 if success else failures+1
        if failures>65:break
    for i in range(min(512-len(placement),round(budget*.65))):
        if int(np.count_nonzero(occupied&eligible))>=int(np.count_nonzero(eligible)*.95):
            break
        success=place_one(occupied,eligible,small,rng,world_size,placement,stats,True)
        failures=0 if success else failures+1
        if failures>90:break
    filled=int(np.count_nonzero(occupied&eligible));total=int(eligible.sum())
    coverage=[]
    for ax in (0,1,2):
        for at in (0,-1):
            at_idx=0 if at==0 else shape[ax]-1
            band=[0,1] if at==0 else [shape[ax]-2,shape[ax]-1]
            sl=np.any(np.take(occupied,band,axis=ax),axis=ax)
            allowed=np.any(np.take(eligible,band,axis=ax),axis=ax)
            coverage.append(round(float((sl&allowed).sum()/max(1,allowed.sum())),3))
    return {"id":kind,"variant":variant,"cells":list(dims),
            "placement":placement,
            "quality":{"voxelPitchMeters":STEP,"estimatedEnvelopeFill":round(filled/total,4),
                       "faceCoverage":coverage,"rocks":len(placement),
                       "overlapVoxels":stats["overlapVoxels"],"minimumSupportVoxels":stats.get("minSupport",0),"contactFaces":stats.get("contactFaces",0),
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
    result={"version":"common100-masonry-review.2",
        "sourceVersion":meta["version"],"assemblyAlgorithm":"gravity-supported.2","sourceSHA256":hashlib.sha256(LIB.read_bytes()).hexdigest(),
        "cellMeters":.25,"gridPitchMeters":STEP,
        "previewOnly":True,"productionIntegrated":False,
        "architectureNote":"Gate stone piers only; historic spanning header remains separate",
        "cases":output}
    if not args.only:
        OUT.write_text(json.dumps(result,separators=(",",":"),ensure_ascii=False)+"\n")
    print("MASONRY_REVIEW_PREVIEW_GENERATED",len(output),"cases",flush=True)
if __name__=="__main__":main()
