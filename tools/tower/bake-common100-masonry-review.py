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
MASONRY_OCCUPANCY={}  # in-memory only, never serialized
MASONRY_MAIN_OWNERS={}  # medium-stone identity for actual seam contact
MASONRY_SEAM_POOLS={}   # cache authored original stone masks by combined dimensions

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

def place_one(occupancy,eligible,pool,rng,world_size,placement,metrics,small=False,owners=None,course_top=None,allow_pier_seed=False,x_focus=None,prefer_high=False,bearing_target=None):
    """Fit medium stones as connected load-bearing courses; use small stones only for gaps."""
    size=occupancy.shape
    if not pool:return False
    from scipy.ndimage import binary_dilation
    neighbor_grid=binary_dilation(occupancy,iterations=1)
    # Select real free contact faces, not only the lowest empty voxel in a
    # random column. This propagates joined courses across all exposed sides.
    propagation=binary_dilation(owners>=0,iterations=1) if prefer_high and owners is not None else neighbor_grid
    frontier=propagation&eligible&~occupancy
    if course_top is not None:frontier[:,course_top:,:]=False
    if x_focus is not None:
        frontier[:x_focus[0],:,:]=False
        frontier[x_focus[1]:,:,:]=False
    targets=np.argwhere(frontier)
    if prefer_high and len(targets):
        highest_course=int(targets[:,1].max())
        targets=targets[targets[:,1]>=max(0,highest_course-5)]
    desired=np.argwhere(bearing_target&eligible&~occupancy) if prefer_high and bearing_target is not None else np.empty((0,3),dtype=int)
    if x_focus is not None and len(desired):
        desired=desired[(desired[:,0]>=x_focus[0])&(desired[:,0]<x_focus[1])]
    best=None;highest=-1e20
    for trial in range(115 if small else 155):
        # Prefer already occupied neighborhoods and unfilled boundary pockets.
        axis=int(rng.choice((0,2)))
        p=int(rng.integers(size[axis]))
        if rng.random()<(.72 if small else .50):
            p=int(rng.choice((0,1,size[axis]-2,size[axis]-1)))
        q=int(rng.integers(size[2-axis]))
        x,z=(p,q) if axis==0 else (q,p)
        if len(desired)>0 and rng.random()<.46:
            x,h,z=map(int,desired[int(rng.integers(len(desired)))])
        elif len(targets)>0 and rng.random()<(.70 if small else .82):
            x,h,z=map(int,targets[int(rng.integers(len(targets)))])
        else:
            free=np.flatnonzero(eligible[x,:,z]&~occupancy[x,:,z])
            if not len(free):continue
            # Reserve floor-first fallback for disconnected architectural piers.
            h=int(free[0] if rng.random()<.83 else rng.choice(free[:min(6,len(free))]))
        frac=rng.random()
        item=pool[min(len(pool)-1,int(len(pool)*(frac**(1.30 if small else 2.3))))]
        n=item["n"]
        if np.any(n>size):continue
        if x_focus is not None and n[0]>x_focus[1]-x_focus[0]:continue
        ox=int(np.clip(x-int(rng.integers(n[0])),0,size[0]-n[0]))
        oz=int(np.clip(z-int(rng.integers(n[2])),0,size[2]-n[2]))
        if x_focus is not None:
            ox=int(np.clip(ox,x_focus[0],x_focus[1]-n[0]))
        elif rng.random()<.24:
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
            if course_top is not None and yy+int(n[1])>course_top:continue
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
            support_ratio=support/max(1,len(bx))
            if support<2 or support_ratio<(.15 if small else .23):continue
            # A lone point cannot carry a medium rock, even when it touches its underside.
            if not small and n[0]>=4 and max(support_x)-min(support_x)<max(1,int(n[0]*.22)):continue
            if not small and n[2]>=4 and max(support_z)-min(support_z)<max(1,int(n[2]*.22)):continue
            # The stone's projected centre must stay over its actual support
            # polygon (approximately, using a conservative bounding interval).
            centroid=np.asarray(item["centre_xz"])
            tolerance=np.maximum(.35,n[[0,2]]*.07)
            if (centroid[0]<min(support_x)-tolerance[0] or
                centroid[0]>max(support_x)+tolerance[0] or
                centroid[1]<min(support_z)-tolerance[1] or
                centroid[1]>max(support_z)+tolerance[1]):continue
            contact=int(np.count_nonzero(mask&neighbor_grid[sl]&~occupancy[sl]))
            required_contact=max(4,int(np.sqrt(item['voxels'])*.58))
            independent=not small and metrics.get('mediumStoneCount',0)>0 and contact<required_contact
            free_flank=(allow_pier_seed and x_focus is not None and owners is not None and
                        yy==0 and not np.any(owners[x_focus[0]:x_focus[1],:,:]>=0))
            if independent and not free_flank:continue
            if yy>0 and contact<4:continue
            if small and owners is not None:
                # A chink is only allowed into a gap between TWO distinct medium stones.
                start=[max(0,int(st[i])-1) for i in range(3)]
                end=[min(size[i],int(st[i]+n[i])+1) for i in range(3)]
                padded=tuple(slice(start[i],end[i]) for i in range(3))
                region=owners[padded]
                local_mask=np.zeros(region.shape,dtype=bool)
                inner=tuple(slice(int(st[i])-start[i],int(st[i]+n[i])-start[i]) for i in range(3))
                local_mask[inner]=mask
                neighboring=np.unique(region[binary_dilation(local_mask,iterations=1)&(region>=0)])
                if len(neighboring)<2:continue
            border=0
            for a in (0,2):
                for target in (0,size[a]-1):
                    relative=target-int(st[a])
                    if 0<=relative<n[a]:
                        border+=int(np.take(mask,relative,axis=a).sum())
            # Larger stones form the weight-bearing masonry; smaller supported
            # stones preferentially close exposed perimeter recesses.
            score=(item['voxels']-collision)+contact*(2.0 if small else 3.2)+border*(.35 if small else 2.8)
            score+=support*1.8+(size[1]-yy)*.65
            if prefer_high:
                score+=(yy+int(n[1]))*18.0
                if bearing_target is not None:
                    score+=int(np.count_nonzero(mask&bearing_target[sl]))*48.0
            if independent:score-=45
            if score>highest:
                highest=score;accepted=(item,st,sl,collision,support,contact,support_ratio,independent)
        if accepted is not None:
            best=accepted
    if best is None:return False
    item,start,sl,collision,support,contact,support_ratio,independent=best
    if small:
        metrics['gapChinks']=metrics.get('gapChinks',0)+1
    else:
        if owners is not None:
            owners[sl][item['mask']]=metrics.get('mediumStoneCount',0)
        metrics['mediumStoneCount']=metrics.get('mediumStoneCount',0)+1
        if independent:metrics['freePierSeeds']=metrics.get('freePierSeeds',0)+1
    occupancy[sl]|=item['mask']
    placement.append(transform(item,start,world_size))
    metrics["overlapVoxels"]+=collision
    metrics.setdefault("minSupport",support)
    metrics["minSupport"]=min(metrics["minSupport"],support)
    metrics['minSupportRatio']=min(metrics.get('minSupportRatio',1.0),support_ratio)
    metrics["contactFaces"]=metrics.get("contactFaces",0)+contact
    return True


def build_case(kind,variant,source,meta,main_cache,chink_cache):
    dims=tuple(SIZES.get(kind,ARCH.get(kind,JOINTS.get(kind))))
    shape=tuple(10*x for x in dims)
    eligible=inside_target(shape,kind)
    occupied=np.zeros(shape,dtype=bool)
    medium_owners=np.full(shape,-1,dtype=np.int32)
    rng=np.random.default_rng(PRESET+variant*1793+sum(ord(c) for c in kind)*59)
    placement=[]
    stats={"overlapVoxels":0}
    world_size=np.asarray(shape)*STEP
    lintel=None
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
        lintel=(item,origin)
        beam_bearing=np.zeros(shape,dtype=bool)
        ux,uy,uz=item['underside']
        valid=origin[1]+uy>0
        beam_bearing[origin[0]+ux[valid],origin[1]+uy[valid]-1,origin[2]+uz[valid]]=True
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
        # Grow from the foundation upwards. The cap is a construction course,
        # not an artificial target fill percentage.
        course_top=min(shape[1],max(7,int(7+max(0,shape[1]-7)*min(1.,(i+1)/(budget*.44)))))
        # Architectural piers grow together rather than forming one tall column.
        # Lintel later must be borne at both ends, not by randomly stacked chinks.
        pier_x={'window':(10,30),'door':(20,50),'gate':(50,130)}
        side=None
        if kind in pier_x and i%3!=2:
            low,high=pier_x[kind]
            side=(0,low) if i%2==0 else (high,shape[0])
        success=place_one(occupied,eligible,main,rng,world_size,placement,stats,
                          owners=medium_owners,course_top=course_top,
                          allow_pier_seed=kind in ARCH,x_focus=side)
        failures=0 if success else failures+1
        if failures>65:break
    if kind in SIZES:
        # Close the upper load-bearing course with medium stones BEFORE adding
        # chinking. This targets a continuous structural surface, not 90% fill.
        missed=0
        for attempt in range(min(100,round(budget*.42))):
            exposed_top=np.any(occupied[:,-2:,:],axis=1)
            if float(np.count_nonzero(exposed_top))/max(1,exposed_top.size)>=.62:break
            success=place_one(occupied,eligible,main,rng,world_size,placement,stats,
                              owners=medium_owners,course_top=shape[1],prefer_high=True)
            missed=0 if success else missed+1
            if missed>18:break
    lintel_support=None
    if lintel is not None:
        stone,origin=lintel
        ux,uy,uz=stone['underside']
        ox,oy,oz=origin
        opening_left,opening_right={'window':(10,30),'door':(20,50)}[kind]
        def bearing():
            xs=ox+ux;ys=oy+uy;zs=oz+uz
            valid=ys>0
            material=np.zeros(len(xs),dtype=bool)
            material[valid]=medium_owners[xs[valid],ys[valid]-1,zs[valid]]>=0
            return [int(np.count_nonzero(material&(xs<opening_left))),
                    int(np.count_nonzero(material&(xs>=opening_right)))]
        goal=max(8,int(len(ux)*.025))
        # Support each end with ordinary main stones. Small chinks MUST NOT carry a lintel.
        for flank,range_x in enumerate(((0,opening_left),(opening_right,shape[0]))):
            missed=0
            for attempt in range(75):
                if bearing()[flank]>=goal or len(placement)>=470:break
                success=place_one(occupied,eligible,main,rng,world_size,placement,stats,
                                  owners=medium_owners,course_top=oy,
                                  allow_pier_seed=True,x_focus=range_x,prefer_high=True,
                                  bearing_target=beam_bearing)
                missed=0 if success else missed+1
                if missed>18:break
        lintel_support=bearing()
    for i in range(min(512-len(placement),round(budget*.65))):
        success=place_one(occupied,eligible,small,rng,world_size,placement,stats,True,
                          owners=medium_owners)
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
    if kind in SIZES:
        MASONRY_OCCUPANCY[(kind,variant)]=occupied.copy()
        MASONRY_MAIN_OWNERS[(kind,variant)]=medium_owners.copy()
    return {"id":kind,"variant":variant,"cells":list(dims),
            "placement":placement,
            "quality":{"voxelPitchMeters":STEP,"estimatedEnvelopeFill":round(filled/total,4),
                       "faceCoverage":coverage,"rocks":len(placement),
                       "overlapVoxels":stats["overlapVoxels"],"minimumSupportVoxels":stats.get("minSupport",0),"contactFaces":stats.get("contactFaces",0),
                       "mediumStones":stats.get('mediumStoneCount',0),"gapChinks":stats.get('gapChinks',0),
                       "minSupportRatio":round(stats.get('minSupportRatio',0),3),"isolatedPierSeeds":stats.get('freePierSeeds',0),
                       "lintelBearingVoxels":lintel_support,
                       "note":"Convex proxy occupancy, not proven physical density"}}

def build_seam(kind,variant,source,meta):
    """Offline fit one supported seam between variant v and v+1 along X."""
    left=MASONRY_OCCUPANCY[(kind,variant)]
    right=MASONRY_OCCUPANCY[(kind,(variant+1)%5)]
    nx,ny,nz=left.shape
    occupied=np.concatenate((left,right),axis=0).copy()
    combined=occupied.shape
    # A bridging chink must contact original MAIN/LARGE stones on both sides,
    # not merely stick to other chinking or float inside a voxel gap.
    left_main=np.zeros(combined,dtype=bool)
    right_main=np.zeros(combined,dtype=bool)
    left_main[:nx,:,:]=MASONRY_MAIN_OWNERS[(kind,variant)]>=0
    right_main[nx:,:,:]=MASONRY_MAIN_OWNERS[(kind,(variant+1)%5)]>=0
    neighbors_left=binary_dilation(left_main,iterations=1)
    neighbors_right=binary_dilation(right_main,iterations=1)
    rng=np.random.default_rng(PRESET+12131+variant*311+sum(map(ord,kind))*13)
    small=select_pool(source,meta,np.asarray(combined),True)
    # Chinking stones must actually straddle the interface.
    small=[q for q in small if q["n"][0]>=2 and q["n"][0]<2*nx]
    seam=[]
    before=int(np.count_nonzero(~occupied[nx-1,:,:]&~occupied[nx,:,:]))
    # Stage 1: place MAIN stones as load-bearing ties across the prefab boundary.
    # Chinking alone cannot fill a 10-20 cm cavity while remaining supported.
    medium_union=left_main|right_main
    pool_key=tuple(combined)
    if pool_key not in MASONRY_SEAM_POOLS:
        MASONRY_SEAM_POOLS[pool_key]=select_pool(source,meta,np.asarray(combined),False)
    ties=[v for v in MASONRY_SEAM_POOLS[pool_key] if v['n'][0]>=3 and v['n'][0]<=2*nx]
    tie_count=0
    for turn in range(42):
        holes=np.argwhere(~occupied[nx-1,:,:]&~occupied[nx,:,:])
        if len(holes)<3:break
        structural_contact=binary_dilation(medium_union,iterations=1)
        best=None;best_score=-1e20
        for attempt in range(125):
            iy,iz=holes[int(rng.integers(len(holes)))]
            item=ties[int(rng.integers(min(len(ties),max(1,int(len(ties)*.65)))))]
            sx,sy,sz=map(int,item['n'])
            ox_min=max(0,nx-sx+1)
            ox_max=min(nx-1,2*nx-sx)
            if ox_min>ox_max:continue
            ox=int(rng.integers(ox_min,ox_max+1))
            oy=int(np.clip(int(iy)-int(rng.integers(sy)),0,ny-sy))
            oz=int(np.clip(int(iz)-int(rng.integers(sz)),0,nz-sz))
            sl=(slice(ox,ox+sx),slice(oy,oy+sy),slice(oz,oz+sz))
            mask=item['mask']
            taken=occupied[sl]
            if int(np.count_nonzero(mask&taken))>max(1,int(item['voxels']*.003)):continue
            bx,by,bz=item['underside']
            local_y=oy+by
            on_floor=local_y==0
            support_x=bx[on_floor].tolist()
            support_z=bz[on_floor].tolist()
            above=~on_floor
            if np.any(above):
                below=medium_union[ox+bx[above],local_y[above]-1,oz+bz[above]]
                support_x.extend(bx[above][below].tolist())
                support_z.extend(bz[above][below].tolist())
            if len(support_x)<max(3,int(len(bx)*.23)):continue
            mid=item['centre_xz']
            tol=np.maximum(.35,item['n'][[0,2]]*.07)
            if (mid[0]<min(support_x)-tol[0] or mid[0]>max(support_x)+tol[0] or
                mid[1]<min(support_z)-tol[1] or mid[1]>max(support_z)+tol[1]):continue
            structural=int(np.count_nonzero(mask&structural_contact[sl]&~taken))
            if structural<4:continue
            split=nx-ox
            if not np.any(mask[:split]) or not np.any(mask[split:]):continue
            uncovered=~occupied[nx-1,oy:oy+sy,oz:oz+sz]&~occupied[nx,oy:oy+sy,oz:oz+sz]
            gain=int(np.count_nonzero((mask[split-1]|mask[split])&uncovered))
            if gain<2:continue
            original_left=int(np.count_nonzero(mask&neighbors_left[sl]&~taken))
            original_right=int(np.count_nonzero(mask&neighbors_right[sl]&~taken))
            score=gain*15+min(original_left,original_right)*7+structural*2+len(support_x)*.5
            if score>best_score:
                best=(item,(ox,oy,oz),sl)
                best_score=score
        if best is None:break
        item,origin,sl=best
        occupied[sl]|=item['mask']
        medium_union[sl]|=item['mask']
        seam.append(transform(item,origin,np.asarray(combined)*STEP))
        tie_count+=1
    # Stage 2: only after medium ties, add smaller stones between them.
    half_left=medium_union.copy();half_left[nx:,:,:]=False
    half_right=medium_union.copy();half_right[:nx,:,:]=False
    neighbors_left=binary_dilation(half_left,iterations=1)
    neighbors_right=binary_dilation(half_right,iterations=1)
    failures=0
    for turn in range(48):
        gaps=np.argwhere(~occupied[nx-1,:,:]&~occupied[nx,:,:])
        if not len(gaps):break
        dilated=binary_dilation(occupied,iterations=1)
        best=None;top=-1e20
        for attempt in range(115):
            iy,iz=gaps[int(rng.integers(len(gaps)))]
            item=small[int(rng.integers(len(small)))]
            sx,sy,sz=map(int,item["n"])
            ox=int(rng.integers(max(0,nx-sx+1),min(nx-1,2*nx-sx)+1))
            oy=int(np.clip(int(iy)-int(rng.integers(sy)),0,ny-sy))
            oz=int(np.clip(int(iz)-int(rng.integers(sz)),0,nz-sz))
            sl=(slice(ox,ox+sx),slice(oy,oy+sy),slice(oz,oz+sz))
            mask=item["mask"];taken=occupied[sl]
            collision=int(np.count_nonzero(mask&taken))
            if collision>max(1,int(item["voxels"]*.002)):continue
            bx,by,bz=item["underside"]
            yy=oy+by
            ground=yy==0
            support_x=bx[ground].tolist()
            support_z=bz[ground].tolist()
            elevated=~ground
            if np.any(elevated):
                underside=occupied[ox+bx[elevated],yy[elevated]-1,oz+bz[elevated]]
                support_x.extend(bx[elevated][underside].tolist())
                support_z.extend(bz[elevated][underside].tolist())
            if len(support_x)<max(2,int(len(bx)*.15)):continue
            midpoint=item["centre_xz"]
            tol=np.maximum(.35,item["n"][[0,2]]*.07)
            if (midpoint[0]<min(support_x)-tol[0] or midpoint[0]>max(support_x)+tol[0] or
                midpoint[1]<min(support_z)-tol[1] or midpoint[1]>max(support_z)+tol[1]):continue
            contact=(mask&dilated[sl]&~taken)
            split=nx-ox
            left_contact=int(np.count_nonzero(contact[:split,:,:]))
            right_contact=int(np.count_nonzero(contact[split:,:,:]))
            medium_left=int(np.count_nonzero(mask&neighbors_left[sl]&~taken))
            medium_right=int(np.count_nonzero(mask&neighbors_right[sl]&~taken))
            if medium_left<2 or medium_right<2:continue
            if left_contact<2 or right_contact<2:continue
            seam_left=mask[nx-1-ox,:,:]
            seam_right=mask[nx-ox,:,:]
            # Reward only previously open interface patches.
            exposed=~occupied[nx-1,oy:oy+sy,oz:oz+sz]&~occupied[nx,oy:oy+sy,oz:oz+sz]
            gain=int(np.count_nonzero((seam_left|seam_right)&exposed))
            if gain==0:continue
            score=gain*6+len(support_x)*1.1+(medium_left+medium_right)*1.4+item["voxels"]*.04
            if score>top:top=score;best=(item,(ox,oy,oz),sl)
        if best is None:
            failures+=1
            if failures>=3:break
            continue
        failures=0
        item,origin,sl=best
        occupied[sl]|=item["mask"]
        seam.append(transform(item,origin,np.asarray(combined)*STEP))
    after=int(np.count_nonzero(~occupied[nx-1,:,:]&~occupied[nx,:,:]))
    return {"id":kind,"variant":variant,"nextVariant":(variant+1)%5,
            "placement":seam,
            "quality":{"beforeOpenInterfaceVoxels":before,
                       "afterOpenInterfaceVoxels":after,
                       "supportedBridgingStones":len(seam),
                       "mainTieStones":tie_count,
                       "gapChinks":len(seam)-tie_count,
                       "note":"Convex-voxel seam estimate; visual approval required"}}


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
    seams=[build_seam(name,v,shapes,meta) for name in SIZES for v in range(5)] if not args.only else []
    result={"version":"common100-masonry-review.3",
        "sourceVersion":meta["version"],"assemblyAlgorithm":"course-contact-supported.3","sourceSHA256":hashlib.sha256(LIB.read_bytes()).hexdigest(),
        "cellMeters":.25,"gridPitchMeters":STEP,
        "previewOnly":True,"productionIntegrated":False,
        "architectureNote":"Gate stone piers only; historic spanning header remains separate",
        "cases":output,"seams":seams}
    if not args.only:
        OUT.write_text(json.dumps(result,separators=(",",":"),ensure_ascii=False)+"\n")
    print("MASONRY_REVIEW_PREVIEW_GENERATED",len(output),"cases",len(seams),"supported seam recipes",flush=True)
if __name__=="__main__":main()
