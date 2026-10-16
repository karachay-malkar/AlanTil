#!/usr/bin/env python3
"""Offline bake of ten approved AlanTil natural-rock masonry variants.
All stone geometry comes from assets/tower/source-original-36.glb.
The browser replaces placeholder material with shared Rock Face 02 PBR.
"""
import argparse, json, math, pathlib, time
from dataclasses import dataclass
from collections import Counter
import numpy as np
import scipy.ndimage as ndi
from scipy.spatial import ConvexHull
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/tower/source-original-36.glb'
OUTPUT=ROOT/'assets/tower/prefabs'
PITCH=.026
STYLES=[
 {'slug':'wild-mixed','label':'Дикая смешанная','seed':75201,'large':.30,'height':.18,'big_bias':.38,'wiggle':.10,'infill':.115},
 {'slug':'long-horizontal','label':'Продольные камни','seed':75202,'large':.37,'height':.15,'big_bias':.78,'wiggle':.08,'infill':.09},
 {'slug':'broken-rough','label':'Ломаная рваная','seed':75203,'large':.35,'height':.235,'big_bias':.27,'wiggle':.17,'infill':.13},
 {'slug':'boulder-deep','label':'Крупные валуны','seed':75204,'large':.36,'height':.195,'big_bias':.65,'wiggle':.15,'infill':.10},
 {'slug':'dense-chinking','label':'Мелкая перевязка','seed':75205,'large':.295,'height':.165,'big_bias':.18,'wiggle':.10,'infill':.085},
]
def source_rocks():
    raw=trimesh.load(SOURCE,force='scene')
    models=[]
    for name,mesh in sorted(raw.geometry.items()):
        if not name.startswith('Rock'): continue
        m=mesh.copy(); v=np.asarray(m.vertices,dtype=np.float64).copy()
        order=np.argsort(np.ptp(v,axis=0))[::-1]
        v=v[:,order];v-=.5*(v.max(0)+v.min(0));v/=np.max(np.ptp(v,axis=0))
        m.vertices=v
        if np.linalg.det(np.eye(3)[:,order])<0:m.invert()
        models.append((name.split('_')[0],m))
    assert len(models)==36
    return models
@dataclass
class BuiltStone:
    model:int
    vertices:np.ndarray
    faces:np.ndarray
    chinking:bool
class Packer:
    def __init__(self,size,style,models,material,variant):
        self.size=size;self.style=style;self.models=models;self.material=material;self.variant=variant
        self.rng=np.random.default_rng(style['seed']+int(size*1433))
        self.grid_shape=np.ceil(np.array([size,size,size])/PITCH).astype(int)
        self.occupied=np.zeros(tuple(self.grid_shape),bool)
        self.stones=[];self.ids=Counter();self.start=time.perf_counter();self.calls=0
    def create(self,index,desired,center,angles,phase):
        name,model=self.models[index]
        target=np.asarray(desired,float);ext=np.ptp(model.vertices,axis=0)
        vertices=np.asarray(model.vertices,float).copy()*target/np.maximum(ext,1e-6)
        rel=vertices/np.maximum(target,1e-6)
        wave=self.style['wiggle'];phase+=index*.4
        vertices[:,2]+=wave*target[2]*(.32*np.sin(rel[:,0]*7+rel[:,1]*3+phase)+.22*np.sin(rel[:,0]*3.5+rel[:,1]*8-phase))
        vertices[:,1]+=.11*target[1]*rel[:,0]*rel[:,2]+wave*target[1]*.32*np.sin(rel[:,0]*3+rel[:,2]*7.3+phase)
        vertices[:,0]+=.075*target[0]*rel[:,2]*rel[:,1]+wave*target[0]*.3*np.sin(rel[:,2]*4+rel[:,1]*4.1+phase)
        shrink=1-.12*(2*np.abs(rel[:,0]))**1.3
        vertices[:,1]*=shrink
        rx,ry,rz=angles
        rot=trimesh.transformations.euler_matrix(rx,ry,rz,axes='sxyz')[:3,:3]
        return vertices@rot.T+np.asarray(center),np.asarray(model.faces)
    def voxel_sample(self,vertices):
        a=np.floor((vertices.min(0)+self.size/2)/PITCH).astype(int)
        b=np.ceil((vertices.max(0)+self.size/2)/PITCH).astype(int)+1
        a=np.maximum(a,0);b=np.minimum(b,self.grid_shape)
        if (b<=a).any():return None
        block=np.indices(tuple(b-a),dtype=np.int16).reshape(3,-1).T+a
        xyz=(block+.5)*PITCH-self.size/2
        hull=ConvexHull(vertices);eq=hull.equations
        inside=np.max(xyz@eq[:,:3].T+eq[:,3],axis=1)<.001
        samples=block[inside]
        return samples if len(samples)>2 else None
    def evaluate(self,vertices,fill=False):
        overshoot=np.maximum(0,np.abs(vertices).max(axis=0)-(self.size/2+.010))
        if overshoot.max()>.004:return None
        vox=self.voxel_sample(vertices)
        if vox is None:return None
        x,y,z=vox.T;count=len(vox)
        minimum=4 if fill else 18
        if count<minimum:return None
        blocked=self.occupied[x,y,z];overlap=blocked.sum()
        if overlap/count>(.32 if fill else .24):return None
        zmin=z.min()
        if zmin<3:support=1
        else:
            bottom=vox[z<=zmin+2];supported=0
            for shift in (1,2,3):
                valid=bottom[:,2]>=shift
                if valid.any():
                    supported+=int(self.occupied[bottom[valid,0],bottom[valid,1],bottom[valid,2]-shift].sum())
            support=min(1,supported/max(len(bottom),1))
        fresh=count-overlap
        if fresh<(4 if fill else 13):return None
        boundary=np.minimum(np.abs(vertices.max(0)-self.size/2),np.abs(vertices.min(0)+self.size/2))
        score=fresh-overlap*5+8*support-10*np.mean(boundary)
        if not fill and support<.03 and zmin>=3:score-=12
        return score,vox
    def place(self,center,desired,fill=False,attempts=8):
        best=None;rng=self.rng
        for i in range(attempts):
            if fill: ix=int(rng.choice([*range(20,30),8,9,17,18,19,22,23]))
            elif rng.random()<self.style['big_bias']:ix=int(rng.choice([3,4,7,10,12,15,20,21,30,31,32,34]))
            else:ix=int(rng.choice([3,5,6,7,8,10,11,12,13,14,15,16,17,18,19,20,21,22,30,31,32,33,34,35]))
            jitter=np.asarray(desired)*rng.uniform(.85,1.15,3)
            jitter[2]=min(jitter[2],jitter[0]*(.78 if fill else .70))
            if fill:jitter=np.maximum(jitter,[.063,.062,.044])
            tilt=.16 if fill else (.27 if self.style['slug']=='broken-rough' else .17)
            angles=(rng.uniform(-tilt,tilt),rng.uniform(-tilt,tilt),rng.uniform(-.20,.20))
            c=np.asarray(center)+rng.uniform(-.02,.02,3)*(.6 if fill else 1.0)
            vertices,faces=self.create(ix,jitter,c,angles,float(rng.random()*6.28));self.calls+=1
            val=self.evaluate(vertices,fill)
            if val is None:continue
            score,indices=val
            if best is None or score>best[0]:best=(score,indices,vertices,faces,ix)
        if best is None:return False
        score,ids,vertices,faces,idx=best
        if score<(1 if fill else 7):return False
        self.occupied[ids[:,0],ids[:,1],ids[:,2]]=True
        self.stones.append(BuiltStone(idx,vertices,faces,fill))
        self.ids[self.models[idx][0]]+=1
        return True
    def primary(self):
        rng=self.rng;sz=self.size
        pitchz=self.style['height']*.84
        n=int(math.ceil(sz/pitchz))
        for k in range(n):
            z=-sz/2+(k+.5)*sz/n
            nx=max(2,round(sz/(self.style['large']*.69)))
            ny=max(2,round(sz/(self.style['large']*.73)))
            ox=rng.uniform(-.09,.09) if k%2 else rng.uniform(-.035,.035)
            oy=rng.uniform(-.08,.08)
            centers=[]
            for a in range(nx):
                for b in range(ny):
                    x=-sz/2+(a+.5)*sz/nx+ox
                    y=-sz/2+(b+.5)*sz/ny+oy
                    centers.append((x,y,z+rng.uniform(-.016,.016)))
            rng.shuffle(centers)
            for x,y,z_ in centers:
                length=self.style['large']*rng.uniform(.82,1.18)
                thickness=self.style['large']*rng.uniform(.69,1.04)
                height=self.style['height']*rng.uniform(.86,1.14)
                if sz<.7:
                    length=min(length,.325);thickness=min(thickness,.28);height=min(height,.20)
                self.place([x,y,z_],(length,thickness,height),False,attempts=12)
    def extra_big_voids(self):
        rng=self.rng
        for phase in range(5):
            free=~self.occupied
            dt=ndi.distance_transform_edt(np.pad(free,1,constant_values=False))[1:-1,1:-1,1:-1]*PITCH
            targets=np.argwhere(dt>(.06 if self.size>.7 else .048))
            if not len(targets):break
            rng.shuffle(targets)
            limit=min(len(targets),220 if self.size>.7 else 50)
            n=0
            for ijk in targets[:limit]:
                if self.occupied[tuple(ijk)]:continue
                pos=(ijk+.5)*PITCH-self.size/2;radius=float(dt[tuple(ijk)])
                dim=np.array([min(.30,max(.13,radius*2.2)),min(.27,max(.13,radius*2.2)),min(.17,max(.10,radius*1.75))])
                if self.place(pos,dim,False,attempts=4):n+=1
                if n>50 if self.size>.7 else n>24:break
    def rubble(self):
        rng=self.rng
        for phase in range(8):
            dt=ndi.distance_transform_edt(np.pad(~self.occupied,1,constant_values=False))[1:-1,1:-1,1:-1]*PITCH
            threshold=.050 if phase<2 else .035
            targets=np.argwhere(dt>threshold)
            if not len(targets):break
            scores=dt[tuple(targets.T)];order=np.argsort(scores)[::-1]
            pool=targets[order[:min(len(order),750 if self.size>.7 else 150)]]
            rng.shuffle(pool);additions=0;max_new=100 if self.size>.7 else 36
            for ijk in pool:
                if additions>=max_new:break
                if self.occupied[tuple(ijk)]:continue
                dist=float(dt[tuple(ijk)]);pos=(ijk+.5)*PITCH-self.size/2
                d=np.asarray([min(.21,max(.110,dist*3.55)),min(.19,max(.090,dist*3.3)),min(.15,max(.077,dist*2.55))])
                if self.place(pos,d,True,attempts=7):additions+=1
    def surface_fill(self):
        rng=self.rng;n=self.grid_shape
        order=[(axis,side) for axis in range(3) for side in (0,1)]
        checks=0;maxchecks=190 if self.size>.7 else 320
        for phase in range(2):
            rng.shuffle(order)
            for axis,side in order:
                if checks>=maxchecks:return
                others=[j for j in range(3) if j!=axis]
                possible=[];na,nb=int(n[others[0]]),int(n[others[1]])
                for u in range(0,na,2 if self.size>.7 else 1):
                    for v in range(0,nb,2 if self.size>.7 else 1):
                        loc=[0,0,0];loc[axis]=0 if side==0 else int(n[axis])-1
                        loc[others[0]]=u;loc[others[1]]=v
                        if not self.occupied[tuple(loc)]:possible.append((u,v))
                rng.shuffle(possible);added=0;limit=18 if self.size<.7 else 32
                for u,v in possible:
                    if added>=limit or checks>=maxchecks:break
                    loc=[0,0,0];loc[axis]=0 if side==0 else int(n[axis])-1
                    loc[others[0]]=u;loc[others[1]]=v
                    if self.occupied[tuple(loc)]:continue
                    pos=np.zeros(3);pos[axis]=(-1 if side==0 else 1)*(self.size/2-.048)
                    pos[others[0]]=(u+.5)*PITCH-self.size/2
                    pos[others[1]]=(v+.5)*PITCH-self.size/2
                    dims=np.array([.142,.132,.095]);dims[axis]=.114
                    dims[others[0]]=.135 if self.size<.7 else .158
                    dims[others[1]]=.118 if self.size<.7 else .155
                    checks+=1
                    if self.place(pos,dims,True,attempts=3):added+=1
    def export(self,path):
        all_triangles=[];all_uv=[]
        for stone in self.stones:
            triangles=stone.vertices[stone.faces]
            normals=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0])
            face_axis=np.argmax(np.abs(normals),axis=1)
            uv=np.zeros((len(triangles),3,2),float)
            for axis in range(3):
                idx=np.where(face_axis==axis)[0]
                if len(idx):
                    ab=[j for j in range(3) if j!=axis]
                    uv[idx]=triangles[idx][:,:,ab]/.28
            uv+=np.array([stone.model*.173,stone.model*.112])
            pts=triangles.reshape(-1,3)[:,[0,2,1]].copy();pts[:,2]*=-1
            all_triangles.append(pts);all_uv.append(uv.reshape(-1,2))
        all_v=np.concatenate(all_triangles,axis=0);all_uv=np.concatenate(all_uv,axis=0)
        faces=np.arange(len(all_v)).reshape(-1,3)
        result=trimesh.Trimesh(vertices=all_v,faces=faces,process=False)
        result.visual=TextureVisuals(uv=all_uv,material=self.material)
        scene=trimesh.Scene();scene.add_geometry(result,node_name='Rock_Full_Volume_Natural_Masonry',geom_name='Rock_Full_Volume_Natural_Masonry')
        scene.export(path)
        return dict(variant=self.variant,style=self.style['slug'],name=self.style['label'],dimensionMeters=self.size,mainStones=sum(not s.chinking for s in self.stones),smallChinking=sum(s.chinking for s in self.stones),totalStoneModels=len(self.stones),uniqueRockPrototypes=len(self.ids),convexHullVoxelOccupancy=round(float(self.occupied.mean()),4),triangleCount=len(result.faces),sourceRockNames=sorted(self.ids),voxelPitchMeters=PITCH,processingSeconds=round(time.perf_counter()-self.start,1),attemptedPlacements=self.calls,note='Hull grid occupancy is approximate and not watertight packing verification',asset=path.name)
def main():
    OUTPUT.mkdir(parents=True,exist_ok=True)
    ap=argparse.ArgumentParser()
    ap.add_argument('--size',type=float,choices=[.5,1.0],default=None)
    ap.add_argument('--variant',type=int,choices=range(5),default=None)
    a=ap.parse_args()
    models=source_rocks()
    mat=PBRMaterial(name='Wild masonry runtime Rock Face 02 replacement',baseColorFactor=[126,122,116,255],roughnessFactor=.97,metallicFactor=0)
    records=[]
    for size in ([a.size] if a.size else [.5,1.0]):
        kind='2x2x2' if size==.5 else '4x4x4'
        for v in ([a.variant] if a.variant is not None else list(range(5))):
            pack=Packer(size,STYLES[v],models,mat,v)
            print('START',kind,'variant',v,flush=True)
            pack.primary();pack.extra_big_voids();pack.rubble();pack.surface_fill();pack.rubble()
            out=OUTPUT/f'wild-section-{kind}-v{v}-17_5_3.glb'
            stat=pack.export(out);records.append(stat)
            print('DONE',kind,v,stat['mainStones'],stat['smallChinking'],stat['convexHullVoxelOccupancy'],flush=True)
    p=ROOT/'docs/tower/wild-pilot-metrics-17_5_3.json'
    prev=json.loads(p.read_text()) if p.exists() else {'version':'17.5.3','source':'source-original-36.glb','types':{}}
    for record in records:
        typ='2x2x2' if record['dimensionMeters']==.5 else '4x4x4'
        arr=prev['types'].setdefault(typ,[])
        arr=[x for x in arr if x['variant']!=record['variant']]+[record]
        arr.sort(key=lambda x:x['variant']);prev['types'][typ]=arr
    p.write_text(json.dumps(prev,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
