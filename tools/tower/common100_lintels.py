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



# Each of the six lintels has a coarse, non-pointed, asymmetric tip profile.
# Exactly 5-8 broad silhouette controls; the existing 12/14-vertex flange
# is retained for manifold joining to the long sides.
PROFILE_NAMES=(
    "rounded-angular",
    "massive-blunt-triangle",
    "blunt-teardrop-wedge",
    "asymmetric-chamfer",
    "natural-irregular-pentagon",
    "mixed-soft-blunt-wedge",
)
PROFILE_RADII=(
    (.95,.96,.91,.98,.94,.97,.93),
    (.96,.90,.88,.95,.98,.96),
    (.96,.98,.92,.89,.91,.97,.96),
    (.98,.97,.86,.89,.95,.98),
    (.96,.87,.98,.90,.95),
    (.95,.93,.89,.96,.99,.94,.90),
)
ENDCAP_DESIGNS=(
    ("rounded-corner-chip","rounded-asymmetric-bevel"),
    ("offset-blunt-triangle","blunt-triangle-broken-corner"),
    ("blunt-teardrop","blunt-wedge-soft-side"),
    ("upper-chamfer","lateral-chamfer-chip"),
    ("irregular-pentagon","offset-pentagon-break"),
    ("broad-soft-point","mixed-rounded-and-chipped"),
)


def _area(a,b,c):
    return float(np.cross(b-a,c-a))


def _triangulate_boundary(points):
    """Ear-clipping creates coarse convex/concave facets without an inset plug."""
    points=np.asarray(points,dtype=float)
    count=len(points)
    signed=sum(np.cross(points[i],points[(i+1)%count]) for i in range(count))
    sign=1 if signed>0 else -1
    remaining=list(range(count))
    triangles=[]
    while len(remaining)>3:
        found=False
        for k in range(len(remaining)):
            a,b,c=remaining[k-1],remaining[k],remaining[(k+1)%len(remaining)]
            area=_area(points[a],points[b],points[c])*sign
            if area<1e-9:
                continue
            def is_inside(p):
                return (sign*_area(points[a],points[b],p)>1e-10 and
                        sign*_area(points[b],points[c],p)>1e-10 and
                        sign*_area(points[c],points[a],p)>1e-10)
            if any(is_inside(points[j]) for j in remaining if j not in (a,b,c)):
                continue
            triangles.append((a,b,c))
            remaining.pop(k)
            found=True
            break
        if not found:
            raise ValueError("Non-simple end silhouette cannot be triangulated")
    triangles.append(tuple(remaining))
    return triangles


def _build_endcap(vertices,faces,ids,side,length,ordinal,rng):
    """Shape one short convex stone end; no crater, sharp needle or flat cut.

    A 19-27 mm local bevel terminates the sidewall and is joined by 16-18
    large cap facets. Three spatially distributed junctions form a broad,
    shallow, blunt face; none is a narrow terminal spike. Interior long-side
    stations and their triangulation are never touched.
    """
    n=len(ids)
    yz=np.asarray([vertices[i][1:3] for i in ids],dtype=float)
    center=yz.mean(axis=0)
    controls=np.asarray(PROFILE_RADII[ordinal],dtype=float)
    if side==1:
        controls=np.roll(controls[::-1],2)
    u=np.arange(n)/n*len(controls)
    fractions=np.interp(u,np.arange(len(controls)+1),np.r_[controls,controls[0]])
    for j,idx in enumerate(ids):
        shape=fractions[j]
        p=np.asarray(vertices[idx],dtype=float)
        p[1:]=center+(p[1:]-center)*shape
        inset=.020+.005*(1-shape)/.14+float(rng.uniform(-.001,.001))
        p[0]-=side*inset
        vertices[idx]=p.tolist()
    yz=np.asarray([vertices[i][1:3] for i in ids],dtype=float)
    triangles=_triangulate_boundary(yz)
    sizes=np.array([abs(_area(*yz[list(t)]))/2 for t in triangles])
    selected=np.argsort(sizes)[-3:]
    extra=[]
    for index,tri in enumerate(triangles):
        if index not in selected:
            extra.append(tri)
            continue
        corners=yz[list(tri)]
        target=corners.mean(axis=0)
        new_id=len(vertices)
        junction= list(selected).index(index)
        gap=(0.,.004,.006)[junction]
        vertices.append([float(side*(length/2-gap)),float(target[0]),float(target[1])])
        a,b,c=tri
        extra.extend(((a,b,new_id),(b,c,new_id),(c,a,new_id)))
    for a,b,c in extra:
        A=ids[a] if a<n else a
        B=ids[b] if b<n else b
        C=ids[c] if c<n else c
        faces.append((C,B,A) if side==-1 else (A,B,C))
    return PROFILE_NAMES[ordinal]


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
    # Strictly preserve all interior longitudinal geometry when modelling tips.
    long_wall=np.asarray(vertices[n:(count-1)*n],dtype=float).copy()
    _build_endcap(vertices,faces,list(range(n)),-1,length,ordinal,rng)
    _build_endcap(vertices,faces,list(range((count-1)*n,count*n)),1,length,ordinal,rng)
    if not np.array_equal(np.asarray(vertices[n:(count-1)*n],dtype=float),long_wall):
        raise ValueError("Lintel central sidewall geometry was modified")
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
