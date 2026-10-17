#!/usr/bin/env python3
"""Offline face-first packing of remaining gaps in the 486 gate-stone recipes.

This changes only new candidate transforms; 17.5.4/17.5.5 source GLBs and
server-stored old geometry versions remain untouched.
"""
import argparse,hashlib,json,math
from importlib.util import spec_from_file_location,module_from_spec
from pathlib import Path
import numpy as np
from scipy import ndimage as ndi

ROOT=Path(__file__).resolve().parents[2]
PREFAB=ROOT/'assets/tower/prefabs'
SCRIPT=ROOT/'tools/tower/emit-gate-recipes-1759.py'
OUTPUT=PREFAB/'balkar71/placements-17_5_10.json'
spec=spec_from_file_location('gate_recipes',SCRIPT)
src=module_from_spec(spec);spec.loader.exec_module(src)
gate=src.mod
VERSION='17.5.10'
MAX_STONES=512

def coverage(grid,axis,side):
    sl=[slice(None)]*3
    sl[axis]=slice(0,2) if side==0 else slice(-2,None)
    return grid[tuple(sl)].any(axis=axis)

def face_pass(bake,max_extra=None):
    starts=len(bake.placed)
    if max_extra is None:max_extra=MAX_STONES-starts
    excluded={(axis,side):np.zeros_like(coverage(bake.occupied,axis,side))
              for axis in range(3) for side in range(2)}
    attempted=0
    accepted=0
    rounds=0
    while len(bake.placed)<min(MAX_STONES,starts+max_extra):
        options=[]
        for axis in range(3):
            for side in range(2):
                mask=coverage(bake.occupied,axis,side)
                if float(mask.mean())>=.93:continue
                free=~(mask|excluded[(axis,side)])
                if not free.any():continue
                distance=ndi.distance_transform_edt(np.pad(free,1,constant_values=False))[1:-1,1:-1]
                peak=float(distance.max())
                if peak<.75:continue
                target=np.unravel_index(int(distance.argmax()),distance.shape)
                # Give priority to largest exposed gaps and worst covered faces.
                score=peak*(1.+(1.-float(mask.mean()))*.5)
                options.append((score,axis,side,target,peak,mask.mean()))
        if not options:break
        _,axis,side,coord,rad,oldFace=max(options,key=lambda x:x[0])
        where=np.zeros(3,float)
        other=[i for i in range(3) if i!=axis]
        for i,j in enumerate(other):
            where[j]=(coord[i]+.5)*gate.PITCH-bake.dim[j]/2
        where[axis]=(-.5 if side==0 else .5)*bake.dim[axis]+(.038 if side==0 else -.038)
        # Wide natural slabs bridge big outdoor holes; small authored pebbles
        # chink their remaining irregular seams. There are NO geometric cubes.
        kind='main' if rad*gate.PITCH>=.055 else 'chinking'
        length=min(.42 if kind=='main' else .16,max(.12,rad*gate.PITCH*2.2))
        before=int(coverage(bake.occupied,axis,side).sum())
        worked=bake.place(where,kind,length,tries=22 if kind=='main' else 16)
        if not worked and kind=='main':
            worked=bake.place(where,'chinking',min(.17,length*.6),tries=14)
        after=int(coverage(bake.occupied,axis,side).sum())
        attempted+=1
        if worked:
            accepted+=1
            if after-before<1:
                # Placed but did not close this exterior face. Avoid recursing
                # into its exact uncovered coordinate over and over.
                excluded[(axis,side)][coord]=True
        else:
            lo=np.maximum(0,np.array(coord)-1);hi=np.minimum(excluded[(axis,side)].shape,np.array(coord)+2)
            excluded[(axis,side)][tuple(slice(int(a),int(z)) for a,z in zip(lo,hi))]=True
        rounds+=1
        if attempted>=1000:break
    return {'added':len(bake.placed)-starts,'accepted':accepted,'attempts':attempted}

def run(section,variant,rocks,names,approved):
    bake=gate.Bake(section,variant,rocks)
    bake.primary_course();bake.large_pockets();bake.rubble()
    before_density=round(float(bake.occupied.mean()),4)
    assert abs(before_density-approved['density'])<.000051
    baseline=src.face_coverage(bake.occupied)
    report=face_pass(bake)
    placements=[src.encode(names[idx],s,R,c)
                for idx,kind,s,R,c,vertices in bake.placed]
    after=src.face_coverage(bake.occupied)
    return dict(rocks=len(placements),size=[x*.25 for x in gate.SIZE[section]],
                placement=placements,
                occupancy=round(float(bake.occupied.mean()),5),
                faceCoverage=[round(x,5) for x in after],
                minFaceCoverage=round(min(after),5),
                beforeOccupancy=before_density,
                beforeFaceCoverage=[round(x,5) for x in baseline],
                surfacePacking=report,
                metric='convex-envelope voxel occupancy 0.025m',
                sourceApprovedDensity=approved['density'],
                sha256=hashlib.sha256(json.dumps(placements,separators=(',',':')).encode()).hexdigest())

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--kind',choices=tuple(gate.SIZE))
    p.add_argument('--variant',type=int,choices=range(5))
    p.add_argument('--out',default=str(OUTPUT))
    opt=p.parse_args()
    rocks=gate.stones_from_gate()
    names=[f'GATE_{kind.upper()}_{idx:03d}_{node}' for idx,(node,kind,mesh) in enumerate(rocks)]
    assert len(rocks)==len(names)==486
    original=json.loads(src.METRICS.read_text('utf8'))
    combos=[(opt.kind,v) for v in ([opt.variant] if opt.variant is not None else range(5))] if opt.kind else [(k,v) for k in gate.SIZE for v in range(5)]
    out={}
    for section,variant in combos:
        reference={r['variant']:r for r in original['types'][section]}[variant]
        row=run(section,variant,rocks,names,reference)
        out.setdefault(section,{})[variant]=row
        print('FACE_PACK',section,variant,'stones',row['rocks'],
              'occupancy',row['beforeOccupancy'],'=>',row['occupancy'],
              'minimum face',round(min(row['beforeFaceCoverage']),4),'=>',row['minFaceCoverage'],
              'added',row['surfacePacking']['added'],flush=True)
    payload=dict(version=VERSION,cellMeters=.25,library='/assets/tower/prefabs/'+src.GATE_LIB.name,
                 shapes=names,variants={k:[vs[i] for i in sorted(vs)] for k,vs in out.items()},
                 totalPlacements=sum(r['rocks'] for vs in out.values() for r in vs.values()),
                 sourceVersion='17.5.4',generator='tools/tower/improve-gate-faces-17510.py')
    path=Path(opt.out);path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n','utf8')
    print('FACE_PACK_WRITTEN',path.stat().st_size,'bytes',len(combos),'variants',flush=True)

if __name__=='__main__':main()
