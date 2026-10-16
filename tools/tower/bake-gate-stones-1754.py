#!/usr/bin/env python3
"""AlanTil 17.5.4, pre-baked wild masonry from approved 486 gate v7 stones.

Only rigid rotations, uniform scale and translations touch stone geometry.
Old legacy variants and user saves remain immutable. No synthetic cuboids.
"""
import argparse, hashlib, json, math, pathlib, time
from collections import Counter
import numpy as np
import scipy.ndimage as ndi
from scipy.spatial import ConvexHull
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=pathlib.Path(__file__).resolve().parents[2]
GATE=ROOT/'assets/tower/prefabs/architectural/gate-18x10x2-v7.glb'
OUT=ROOT/'assets/tower/prefabs'
PITCH=.025
SIZE={'1x1x1':(1,1,1),'2x2x2':(2,2,2),'2x2x3':(2,2,3),'2x3x4':(2,3,4),'4x4x4':(4,4,4)}
STYLES=(
 ('Дикая перевязка',79441,1.00),
 ('Крупный горизонтальный камень',79467,1.17),
 ('Рваная нерегулярная кладка',79501,.93),
 ('Валуны с переменной толщиной',79519,1.08),
 ('Плотная смешанная кладка',79531,.90),
)
MAT=PBRMaterial(name='ALANTIL_ROCK_FACE_02_SHARED',baseColorFactor=[153,149,143,255],metallicFactor=0,roughnessFactor=.97)

def stones_from_gate():
    source=trimesh.load(GATE,force='scene')
    rocks=[]
    for node in sorted(source.graph.nodes_geometry):
        if '_PIER_' not in node:continue
        matrix,geom=source.graph.get(node)
        mesh=source.geometry[geom].copy();mesh.apply_transform(matrix)
        mat=mesh.visual.material
        assert getattr(mat,'name',None)=='ALANTIL_GATE_ROCK_FACE_02',node
        kind='main' if '_PIER_STONE_' in node else 'chinking' if '_PIER_CHINKING_' in node else None
        if kind is None:raise ValueError('Unclassified gate stone '+node)
        mesh.apply_translation(-mesh.bounds.mean(axis=0))
        assert mesh.visual.kind=='texture'
        mesh.visual=TextureVisuals(uv=np.asarray(mesh.visual.uv),material=MAT)
        rocks.append((node,kind,mesh))
    assert Counter(x[1] for x in rocks)==Counter({'main':189,'chinking':297})
    return rocks

# Input models are game coords XYZ (Y is vertical) and output models stay XYZ.
# Each candidate may change ONLY a uniform scalar, rotation, translation.
class Bake:
    def __init__(self,kind,index,rocks):
        self.kind=kind;self.index=index;self.rocks=rocks
        self.dim=np.asarray(SIZE[kind],dtype=float)*.25
        self.grid=np.ceil(self.dim/PITCH).astype(int)
        self.occupied=np.zeros(tuple(self.grid),bool)
        self.rng=np.random.default_rng(STYLES[index][1]+sum(SIZE[kind])*1000)
        self.primary=[i for i,x in enumerate(rocks) if x[1]=='main']
        self.fill=[i for i,x in enumerate(rocks) if x[1]=='chinking']
        self.placed=[];self.uses=set();self.started=time.monotonic()
    def candidate(self,idx,center,scale,tilt):
        m=self.rocks[idx][2];v=np.asarray(m.vertices)*scale
        rx,ry,rz=tilt
        R=trimesh.transformations.euler_matrix(rx,ry,rz,axes='sxyz')[:3,:3]
        verts=v@R.T
        low=-self.dim/2+.002-verts.min(axis=0)
        high=self.dim/2-.002-verts.max(axis=0)
        if np.any(low>high):return None
        ctr=np.clip(center,low,high)
        return verts+ctr,R,ctr
    def voxels(self,verts):
        a=np.maximum(0,np.floor((verts.min(0)+self.dim/2)/PITCH).astype(int))
        b=np.minimum(self.grid,np.ceil((verts.max(0)+self.dim/2)/PITCH).astype(int)+1)
        if np.any(b<=a):return None
        ijk=np.indices(tuple(b-a),dtype=np.int16).reshape(3,-1).T+a
        p=(ijk+.5)*PITCH-self.dim/2
        eq=ConvexHull(verts).equations
        keep=np.max(p@eq[:,:3].T+eq[:,3],axis=1)<.001
        xyz=ijk[keep]
        return xyz if len(xyz)>2 else None
    def place(self,center,kind,length,tries=10):
        pool=self.primary if kind=='main' else self.fill
        rng=self.rng;best=None
        for _ in range(tries):
            idx=int(rng.choice(pool));mesh=self.rocks[idx][2]
            dims=np.ptp(mesh.vertices,axis=0)
            # Large main stones preserve elongated character and stay horizontal.
            scale=(length/max(dims[0],1e-6))*rng.uniform(.84,1.12)
            scale=np.clip(scale,.25 if self.dim.min()<.35 else .46,1.6)
            if kind=='chinking':scale=np.clip(scale,.48,1.25)
            tilt=.075 if kind=='main' else .21
            rot=(rng.uniform(-tilt,tilt),rng.uniform(-.16,.16),rng.uniform(-tilt,tilt))
            pos=np.asarray(center)+rng.uniform(-.018,.018,3)
            obj=self.candidate(idx,pos,scale,rot)
            if obj is None:continue
            verts,R,c=obj;vox=self.voxels(verts)
            if vox is None or len(vox)<(6 if kind=='main' else 3):continue
            overlap=int(self.occupied[tuple(vox.T)].sum())
            frac=overlap/len(vox)
            if frac>(.23 if kind=='main' else .24):continue
            score=len(vox)-overlap*5
            if kind=='main':
                ext=verts.max(axis=0)-verts.min(axis=0)
                score+=8*ext[0]/max(ext[1],ext[2],.04)
            if best is None or score>best[0]:best=(score,idx,verts,vox,scale,R,c)
        if best is None:return False
        _,idx,verts,vox,s,R,c=best
        self.occupied[tuple(vox.T)]=True
        self.placed.append((idx,kind,s,R,c,verts))
        self.uses.add(idx)
        return True
    def primary_course(self):
        rng=self.rng
        if self.kind=='1x1x1':
            # A tiny 25cm cell should be one convincing natural stone.
            for _ in range(100):
                if self.place([0,0,0],'main',.245,tries=6):break
            self.place([-.06,-.04,.035],'main',.135,tries=15)
            return
        dx,dy,dz=self.dim
        # Horizontal courses; keep large gate-shaped stones, do NOT re-stretch.
        layers=max(2,int(round(dy/.155)))
        columns=max(1,int(round(dx/(.36*STYLES[self.index][2]))))
        depth=max(1,int(round(dz/.31)))
        for iy in range(layers):
            positions=[]
            for ix in range(columns):
                for iz in range(depth):
                    x=(ix+.5)*dx/columns-dx/2+(.024 if iy%2 else -.021)
                    y=(iy+.5)*dy/layers-dy/2
                    z=(iz+.5)*dz/depth-dz/2
                    positions.append((x,y,z))
            rng.shuffle(positions)
            for loc in positions:
                wanted=min(.45*STYLES[self.index][2],dx*.8)
                self.place(loc,'main',wanted,tries=10)
    def large_pockets(self):
        threshold=.072 if self.dim.min()<=.5 else .085
        for _ in range(3):
            distances=ndi.distance_transform_edt(np.pad(~self.occupied,1,constant_values=False))[1:-1,1:-1,1:-1]*PITCH
            loc=np.argwhere(distances>threshold)
            if not len(loc):break
            self.rng.shuffle(loc)
            count=0
            for point in loc[:min(len(loc),400)]:
                if self.occupied[tuple(point)]:continue
                where=(point+.5)*PITCH-self.dim/2
                if self.place(where,'main',min(.34,self.dim[0]*.77),tries=5):count+=1
                if count>=max(4,int(np.prod(self.dim)*40)):break
    def rubble(self,rounds=3):
        for iteration in range(rounds):
            d=ndi.distance_transform_edt(np.pad(~self.occupied,1,constant_values=False))[1:-1,1:-1,1:-1]*PITCH
            coords=np.argwhere(d>((.033 if self.dim.min()<.35 else .065) if iteration==0 else (.028 if self.dim.min()<.35 else .046) if iteration==1 else .025 if self.dim.min()<.35 else .033))
            if not len(coords):break
            self.rng.shuffle(coords)
            count=0
            for p in coords[:min(len(coords),1100)]:
                if self.occupied[tuple(p)]:continue
                center=(p+.5)*PITCH-self.dim/2
                if self.place(center,'chinking',self.rng.uniform(.09,.17),tries=4):count+=1
                if count>=max(10,int(np.prod(self.dim)*100)):break
    def export(self):
        scene=trimesh.Scene();stats={};provenance=[]
        for kind in ('main','chinking'):
            parts=[p for p in self.placed if p[1]==kind]
            vertices=[];faces=[];uv=[];offset=0
            for index,_,scalar,R,c,verts in parts:
                src=self.rocks[index][2]
                # Each vertex in the result must match a rigid+uniform transform.
                np.testing.assert_allclose(verts,np.asarray(src.vertices)*scalar@R.T+c,atol=1e-9)
                vertices.append(verts);faces.append(np.asarray(src.faces)+offset)
                uv.append(np.asarray(src.visual.uv));offset+=len(verts)
                provenance.append([index,kind,round(float(scalar),7)])
            if vertices:
                combined=trimesh.Trimesh(vertices=np.concatenate(vertices),faces=np.concatenate(faces),process=False)
                combined.visual=TextureVisuals(uv=np.concatenate(uv),material=MAT)
                scene.add_geometry(combined,node_name='gate_stone_'+kind,geom_name='gate_stone_'+kind)
                stats[kind]=len(parts)
        result=OUT/f'gate-stone-section-{self.kind}-v{self.index}-17_5_4.glb'
        scene.export(result)
        assert result.is_file() and result.stat().st_size>3000
        assert np.max(np.abs(scene.bounds-np.array([[-self.dim[0]/2,-self.dim[1]/2,-self.dim[2]/2],[self.dim[0]/2,self.dim[1]/2,self.dim[2]/2]])))<self.dim.max()
        return dict(kind=self.kind,variant=self.index,file='/assets/tower/prefabs/'+result.name,
                    main=stats.get('main',0),chinking=stats.get('chinking',0),
                    density=round(float(self.occupied.mean()),4),unique=len(self.uses),
                    triangles=sum(len(m.faces) for m in scene.geometry.values()),
                    bytes=result.stat().st_size,sha256=hashlib.sha256(result.read_bytes()).hexdigest(),
                    source='gate-18x10x2-v7.glb',preservation='rigid transforms and uniform scaling only')

def main():
    a=argparse.ArgumentParser();a.add_argument('--kind',choices=list(SIZE));a.add_argument('--variant',type=int,choices=range(5));args=a.parse_args()
    rocks=stones_from_gate();OUT.mkdir(parents=True,exist_ok=True)
    library=OUT/'gate-stones-library-v1-17_5_4.glb'
    if not library.is_file():
        lib=trimesh.Scene()
        for i,(node,group,mesh) in enumerate(rocks):
            key=f'GATE_{group.upper()}_{i:03d}_{node}'
            lib.add_geometry(mesh,node_name=key,geom_name=key)
        lib.export(library)
        assert len(trimesh.load(library,force='scene').geometry)==486
        print('GATE_LIBRARY',library.stat().st_size,flush=True)

    manifest=OUT/'gate-stone-17_5_4-metrics.json'
    data=json.loads(manifest.read_text()) if manifest.exists() else {'sourceSha256':hashlib.sha256(GATE.read_bytes()).hexdigest(),'types':{}}
    for kind in [args.kind] if args.kind else SIZE:
        for i in [args.variant] if args.variant is not None else range(5):
            t=time.monotonic();b=Bake(kind,i,rocks)
            b.primary_course();b.large_pockets();b.rubble()
            row=b.export();row['buildSeconds']=round(time.monotonic()-t,2)
            vals=data['types'].setdefault(kind,[]);vals[:]=[x for x in vals if x['variant']!=i]+[row];vals.sort(key=lambda x:x['variant'])
            print('DONE',row,flush=True)
    manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
