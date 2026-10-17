"""Six monolithic lintels with restored v5 longitudinal sides and carved end faces.

Endcap-only (both X-axis end faces): asymmetric chips, cracks, softened
patches, and bevels. No fine triangular noise is applied to the long flanks.
Native 3D meshes, not an illustration. Units metres; Y up; X along length.
"""
from __future__ import annotations

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

STYLES=("quarry-broken","stratified")
# One deliberately different mixed-damage recipe for each face of six stones.
ENDCAP_DESIGNS=(
    ("chip+bevel","crack+soft"),
    ("crack+bevel","chip+soft"),
    ("chip+soft","bevel+crack"),
    ("crack+asymmetric","chip+bevel"),
    ("large-chip+bevel","crack+soft"),
    ("chip+crack+bevel","soft+asymmetric"),
)


def _sector_distance(a,b,n):
    d=abs(a-b)
    return min(d,n-d)


def apply_endcap_damage(vertices,start,n,length,side,design,rng):
    """Cut corners on the END outline; leave middle-side profile untouched."""
    inward=1 if side=="left" else -1
    chip_index=int(rng.integers(0,n))
    bevel_index=(chip_index+n//3+int(rng.integers(0,3)))%n
    for j in range(n):
        point=np.asarray(vertices[start+j],dtype=float).copy()
        shrink=0.
        shift=0.
        if "chip" in design and _sector_distance(j,chip_index,n)<=1:
            big="large-chip" in design
            shrink=(.15 if big else .095)*(1. if j==chip_index else .53)
            shift=(.019 if big else .012)*(1. if j==chip_index else .5)
        if "bevel" in design and _sector_distance(j,bevel_index,n)<=1:
            shrink=max(shrink,.082 if j==bevel_index else .042)
            shift=max(shift,.010 if j==bevel_index else .004)
        if "soft" in design and _sector_distance(j,bevel_index,n)<=1:
            shrink=max(shrink,.05 if j==bevel_index else .023)
            shift=max(shift,.004)
        if "asymmetric" in design and j==bevel_index:
            shrink=max(shrink,.105)
            shift=max(shift,.013)
        point[1:]*=(1-shrink)
        point[0]+=inward*(shift+float(rng.uniform(0,.002)))
        vertices[start+j]=point.tolist()


def build_endcap_profile(vertices,faces,start,n,length,side,design,rng):
    """Watertight broad faceted cap: boundary -> 2 broken rings -> core.

    A crack is a localized recessed V-shaped channel in the cap, not a dark
    line painted onto a flat polygon. Triangles are restricted to both ends.
    """
    inward=1 if side=="left" else -1
    outer=np.asarray(vertices[start:start+n],dtype=float)
    yz_center=np.mean(outer[:,1:],axis=0)
    # Recess cap 1-3 cm: deep enough to catch light, not cross the next course.
    inset_limit=min(.031,length*.025)
    crack_sector=int(rng.integers(0,n))
    chip_sector=(crack_sector+n//2+int(rng.integers(0,3)))%n
    cap_x=(-float(length)/2 if side=="left" else float(length)/2)
    inner_starts=[]
    for layer,radial in enumerate((.72,.32)):
        inner_starts.append(len(vertices))
        for j in range(n):
            p=outer[j].copy()
            p[1:]=yz_center+(p[1:]-yz_center)*radial
            step=(.34 if layer==0 else .73)*inset_limit
            if "crack" in design and _sector_distance(j,crack_sector,n)<=1:
                step+=(.12 if layer==0 else .27)*inset_limit
            if "chip" in design and _sector_distance(j,chip_sector,n)<=1:
                step+=(.15 if layer==0 else .08)*inset_limit
            if "bevel" in design and _sector_distance(j,chip_sector,n)<=1:
                step+=.07*inset_limit
            step=np.clip(step+rng.uniform(-.002,.002),0.,inset_limit)
            p[0]=cap_x+inward*step
            # Real directional line fracture: the narrow tip of a recessed V.
            if "crack" in design and layer==1 and j==crack_sector:
                p[1:]+=rng.uniform(-.003,.003,size=2)
            vertices.append(p.tolist())
    core_idx=len(vertices)
    vertices.append([
        cap_x+inward*inset_limit*.9,
        float(yz_center[0]+rng.uniform(-.011,.011)),
        float(yz_center[1]+rng.uniform(-.012,.012)),
    ])
    for outer_start,inner_start in zip((start,inner_starts[0]),inner_starts):
        for j in range(n):
            a=outer_start+j
            b=outer_start+(j+1)%n
            c=inner_start+j
            d=inner_start+(j+1)%n
            if side=="left":
                faces.extend(((a,c,d),(a,d,b)))
            else:
                faces.extend(((a,b,d),(a,d,c)))
    for j in range(n):
        a=inner_starts[-1]+j
        b=inner_starts[-1]+(j+1)%n
        faces.append((core_idx,b,a) if side=="left" else (core_idx,a,b))

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
    # Sculpt ONLY these end faces, reusing accepted historical side topology.
    for side,start in (("left",0),("right",(count-1)*n)):
        design=ENDCAP_DESIGNS[ordinal][0 if side=="left" else 1]
        apply_endcap_damage(vertices,start,n,float(length),side,design,rng)
        build_endcap_profile(vertices,faces,start,n,float(length),side,design,rng)
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
