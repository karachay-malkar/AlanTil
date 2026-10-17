"""V5 wall-stable lintels with individual chipped, cracked, asymmetric stone ends.

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



# Each model gets an individual, asymmetric treatment at EACH end.
# The broad sidewall triangulation below is exactly the approved v5 generator.
ENDCAP_DESIGNS=END_TREATMENTS=(
    ("large-chip","angled-bevel"),
    ("crack-groove","chipped-corner"),
    ("large-chip","softened-edge"),
    ("fractured-ridge","crack-groove"),
    ("deep-chip","slanted-facet"),
    ("mixed-chip-crack","rounded-bevel"),
)


def _cap_sector_gap(j, target, n):
    dist=abs(int(j)-int(target))
    return min(dist,n-dist)


def _build_endcap(vertices, faces, ids, side, length, ordinal, rng):
    """Model one sealed broken stone END, not a smooth flat-sawn polygon.

    Outer ring belongs to the original v5 longitudinal surface; only the
    final 0–8 mm of its rim can be chipped/bevelled. New geometry is confined
    to the cap: an irregular inner polygon and locally sunken broad facets.
    The crack is a narrow V-shaped groove in two adjoining cap facets.
    """
    n=len(ids)
    treatment=END_TREATMENTS[ordinal][0 if side==-1 else 1]
    outer=np.asarray([vertices[i] for i in ids],dtype=float)
    yz=outer[:,1:]
    middle=yz.mean(axis=0)
    tip=int(rng.integers(0,n))
    # Separate crack / corner / bevel sectors, at different positions.
    fissure=(tip+int(rng.integers(3,max(4,n-2))))%n
    bevel=(fissure+int(rng.integers(2,max(3,n-2))))%n
    inward=-int(side)
    # Rim damage is subtle and localized. No new teeth along the long sides.
    for j,idx in enumerate(ids):
        d=_cap_sector_gap(j,tip,n)
        b=_cap_sector_gap(j,bevel,n)
        p=np.asarray(vertices[idx],dtype=float)
        if d==0 and treatment in ("large-chip","deep-chip","mixed-chip-crack","chipped-corner"):
            p[0]+=inward*float(rng.uniform(.006,.010))
            p[1:]=middle+(p[1:]-middle)*float(rng.uniform(.94,.975))
        elif b==0 and treatment in ("angled-bevel","slanted-facet","rounded-bevel","softened-edge"):
            p[0]+=inward*float(rng.uniform(.003,.006))
            p[1:]=middle+(p[1:]-middle)*float(rng.uniform(.967,.988))
        elif b==1 and treatment in ("softened-edge","rounded-bevel"):
            p[1:]=middle+(p[1:]-middle)*.988
        vertices[idx]=p.tolist()
    # Large chips on ONE sector and a narrow shallow fracture on another.
    # Other sectors deliberately stay calm: never produce a regular pattern.
    inner=[]
    for j,idx in enumerate(ids):
        p=np.asarray(vertices[idx],dtype=float)
        radius=float(rng.uniform(.48,.65))
        inner_yz=middle+(p[1:]-middle)*radius
        inner_yz+=rng.uniform(-.0035,.0035,size=2)
        d=_cap_sector_gap(j,tip,n)
        gap=_cap_sector_gap(j,fissure,n)
        damage=.013+float(rng.uniform(-.003,.004))
        if treatment in ("large-chip","deep-chip","mixed-chip-crack","chipped-corner","fractured-ridge"):
            if d==0: damage+=.018
            elif d==1: damage+=.008
        if treatment in ("crack-groove","mixed-chip-crack","fractured-ridge"):
            if gap==0: damage+=.015
            elif gap==1: damage+=.003
        if treatment in ("slanted-facet","angled-bevel") and _cap_sector_gap(j,bevel,n)<2:
            damage+=.009
        damage=min(.036,damage)
        inside=np.array([p[0]+inward*damage,inner_yz[0],inner_yz[1]])
        inner.append(len(vertices))
        vertices.append(inside.tolist())
    # Offset core yields large noncoplanar planes rather than a pizza fan.
    core_yz=middle+rng.uniform(-.012,.012,size=2)
    core_depth=float(rng.uniform(.016,.025))
    if treatment in ("crack-groove","mixed-chip-crack","deep-chip"):
        core_depth+=.006
    core=len(vertices)
    vertices.append([float(np.mean(outer[:,0]))+inward*core_depth,
                     float(core_yz[0]),float(core_yz[1])])
    for j in range(n):
        jp=(j+1)%n
        a,b=ids[j],ids[jp]
        c,d=inner[j],inner[jp]
        if side==-1:
            faces.extend(((b,a,c),(b,c,d),(core,d,c)))
        else:
            faces.extend(((a,b,d),(a,d,c),(core,c,d)))
    return treatment



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
    _build_endcap(vertices,faces,list(range(n)),-1,length,ordinal,rng)
    _build_endcap(vertices,faces,list(range((count-1)*n,count*n)),1,length,ordinal,rng)
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
