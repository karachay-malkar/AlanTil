"""Six single-piece, rough-hewn stone lintels for AlanTil common-100.

Two independent longitudinal fracture patterns at each span:
1.00 m ×2, 1.25 m ×2, 1.50 m ×2. Units are metres.
Explicit face triangulation, warped longitudinal walls, chipped arrises,
wide bearing ends and a relatively stable underside (never six smooth prisms).
"""
from __future__ import annotations

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

STYLES=("quarry-broken","stratified")
# Twelve uneven corners on the Y/Z outline; in stratified form two extra
# offsets make steps rather than a uniformly rounded or cubical contour.
SECTION=np.array([
    [-.44,-.34],[-.49,-.21],[-.49,.29],[-.40,.46],
    [-.15,.49],[.30,.47],[.48,.32],[.50,-.15],
    [.42,-.43],[.12,-.49],[-.26,-.49],[-.43,-.46],
],dtype=float)
MATERIAL=PBRMaterial(name="ALANTIL_COMMON100_ROCK_PBR",
                     baseColorFactor=[193,176,146,255],
                     metallicFactor=0,roughnessFactor=.97)


def build_rugged_lintel(rng,length,style,ordinal):
    if style not in STYLES:
        raise ValueError("Unsupported lintel style "+str(style))
    if float(length) not in (1.0,1.25,1.5):
        raise ValueError("Unsupported solid lintel span")
    count=19+int(ordinal)
    poly=SECTION.copy()
    if style=="stratified":
        poly=np.insert(poly,[3,7],[(poly[2]+poly[3])*.5,(poly[6]+poly[7])*.5],axis=0)
    n=len(poly)
    height=float(rng.uniform(.186,.222))
    depth=float(rng.uniform(.30,.348))
    vertices=[]
    base=float(rng.uniform(-.012,.012))
    # Independent high/low ridges for the entire FRONT and BACK faces.
    # A single extruded YZ profile would leave these walls unrealistically flat.
    front=rng.uniform(-.023,.023,size=count)
    back=rng.uniform(-.023,.023,size=count)
    top=rng.uniform(-.008,.008,size=count)
    scars=np.zeros((count,n),dtype=float)
    for _ in range(12 if style=="stratified" else 16):
        ix=int(rng.integers(1,count-1))
        j=int(rng.integers(n))
        depth_of_chip=float(rng.uniform(.008,.022))
        for shift,weight in ((-1,.36),(0,1),(1,.36)):
            station=ix+shift
            if 0<=station<count:
                scars[station,j]+=depth_of_chip*weight
    for i in range(count):
        x=float(length)*(i/(count-1)-.5)
        for j,(ay,az) in enumerate(poly):
            y=ay*height+base*.5+top[i]*max(0.,ay*2.)+float(rng.uniform(-.006,.006))
            z=az*depth
            if az>.12:
                z+=front[i]*(.5+min(1.,az*2))
                z-=scars[i,j] if az>.3 else scars[i,j]*.25
            elif az<-.12:
                z+=back[i]*(.5+min(1.,-az*2))
                z+=scars[i,j] if az<-.3 else scars[i,j]*.25
            else:
                z+=float(rng.uniform(-.008,.008))
            # Maintain continuous, nearly planar bearing contact underneath.
            if ay<-.42:
                y=-height*.46+float(rng.uniform(-.003,.004))
            xx=x if i in (0,count-1) else x+float(rng.uniform(-.0045,.0045))
            vertices.append([xx,y,z])
    faces=[]
    for i in range(count-1):
        for j in range(n):
            a=i*n+j
            b=i*n+(j+1)%n
            c=(i+1)*n+j
            d=(i+1)*n+(j+1)%n
            if (i+j)%2:
                faces.extend(((a,c,d),(a,d,b)))
            else:
                faces.extend(((a,c,b),(b,c,d)))
    left=len(vertices)
    vertices.append([-float(length)/2,0,0])
    right=len(vertices)
    vertices.append([float(length)/2,0,0])
    for j in range(n):
        faces.append((left,(j+1)%n,j))
        faces.append((right,(count-1)*n+j,(count-1)*n+(j+1)%n))
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=True)
    trimesh.repair.fix_normals(mesh)
    # Precise span of 100/125/150 cm without forcing broad ends into tips.
    mesh.apply_scale(np.array([float(length),height,depth])/mesh.extents)
    mesh.apply_translation(-mesh.bounds.mean(axis=0))
    if not mesh.is_watertight or not mesh.is_volume:
        raise ValueError("Lintel is not a single watertight stone")
    uv=(np.asarray(mesh.vertices,dtype=float)[:,[0,2]]*2.8).astype(np.float32)
    mesh.visual=TextureVisuals(uv=uv,material=MATERIAL)
    return mesh
