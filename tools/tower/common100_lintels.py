"""V5 wall-stable lintels with physically clipped blunt stone ends.

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
# Nominal stone module: 25 cm high and 50 cm through the wall.
# The coarse side relief and individual oblique clipped ends are retained.
TARGET_HEIGHT_M=.25
TARGET_DEPTH_M=.50
# The approved corner-cut depths were designed for a 20 x 32.5 cm stone.
# Keep the same broad, readable cuts when widening to the 25 x 50 cm module.
CUT_DEPTH_SCALE=((TARGET_HEIGHT_M/.20)*(TARGET_DEPTH_M/.325))**.5
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
# Each pair defines *real* clipped corners on left and right ends.
# (vertical corner, lateral corner, removed depth in metres,
#  vertical plane slope, lateral plane slope).
# The wide end face itself is NOT inset: there is no sunken center or rim.
END_CUTS=(
    (((1,1,.060,.66,.45),(-1,-1,.036,.58,.46)),
     ((1,-1,.054,.69,.42),(-1,1,.031,.53,.54))),
    (((1,1,.083,.63,.57),(-1,1,.029,.43,.75)),
     ((-1,-1,.074,.67,.49),(1,-1,.033,.55,.50))),
    (((1,-1,.076,.75,.46),(-1,-1,.039,.49,.70)),
     ((1,1,.070,.65,.60),(-1,1,.033,.54,.61))),
    (((1,1,.090,.70,.45),(-1,-1,.030,.47,.61)),
     ((1,-1,.045,.63,.57),(-1,-1,.062,.64,.52))),
    (((1,1,.060,.63,.48),(-1,-1,.046,.50,.52),(1,-1,.031,.52,.68)),
     ((-1,1,.065,.60,.53),(1,-1,.050,.67,.54),(1,1,.026,.49,.61))),
    (((1,-1,.086,.65,.50),(-1,1,.034,.49,.67)),
     ((1,1,.063,.68,.54),(-1,-1,.051,.61,.55))),
)
ENDCAP_DESIGNS=(
    ("two-soft-corner-cuts","offset-soft-corner-cuts"),
    ("large-diagonal-cut","offset-large-cut-and-small-chip"),
    ("paired-lateral-bevels","offset-teardrop-bevels"),
    ("upper-angled-cut","side-chamfer-and-notch"),
    ("three-irregular-corner-cuts","three-staggered-cuts"),
    ("blunt-wide-angled-cut","rounded-wide-end-with-scars"),
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


def _finish_blunt_end(vertices,faces,ids,side,length):
    """Close the wide end with a few outward macro facets, NEVER an inset ring.

    Local raised core is at most 4 mm and will be clipped at specific corners.
    A cup could occur only if the central faces were sunk relative to the rim;
    this operation deliberately makes that impossible.
    """
    yz=np.asarray([vertices[i][1:3] for i in ids],dtype=float)
    triangles=_triangulate_boundary(yz)
    areas=np.array([abs(_area(*yz[list(t)])) for t in triangles])
    big=set(np.argsort(areas)[-3:])
    for index,(a,b,c) in enumerate(triangles):
        if index not in big:
            faces.append((ids[c],ids[b],ids[a]) if side==-1 else
                         (ids[a],ids[b],ids[c]))
            continue
        centroid=yz[[a,b,c]].mean(axis=0)
        level=sum(int(j<index) for j in big)
        outward=(.0035,.004,.002)[level]
        peak=len(vertices)
        vertices.append([side*(length/2+outward),
                         float(centroid[0]),float(centroid[1])])
        for p,q in ((a,b),(b,c),(c,a)):
            faces.append((peak,ids[q],ids[p]) if side==-1 else
                         (ids[p],ids[q],peak))


def _clip_corner_plane(mesh,normal,limit):
    """Physically remove material beyond a 3D plane; seal its macro face.

    A single bevel trims a local corner, not the full perimeter.
    Long sidewalls away from this plane are not remeshed or rescaled.
    """
    normal=np.asarray(normal,dtype=float)
    origin=normal*float(limit)/float(normal@normal)
    cut=mesh.slice_plane(plane_origin=origin,plane_normal=-normal,cap=False)
    cut.merge_vertices(digits_vertex=9)
    # Boundary edges inherit winding from the original surface.
    oriented={}
    for av,bv in np.asarray(cut.edges,dtype=int):
        aa,bb=int(av),int(bv)
        key=(min(aa,bb),max(aa,bb))
        if key in oriented:
            oriented[key]=None
        else:
            oriented[key]=(aa,bb)
    border=[e for e in oriented.values()
            if e is not None and
            all(abs(float(normal@cut.vertices[v]-limit))<1e-6 for v in e)]
    if not border:
        raise ValueError("No intersection with corner for clip plane")
    outgoing={a:b for a,b in border}
    if len(outgoing)!=len(border):
        raise ValueError("Clip created a branched boundary")
    verts=list(np.asarray(cut.vertices,dtype=float))
    faces=list(np.asarray(cut.faces,dtype=int))
    open_starts=set(outgoing)
    while open_starts:
        first=next(iter(open_starts));current=first;loop=[]
        while current in open_starts:
            open_starts.remove(current)
            loop.append(current)
            current=outgoing[current]
        if current!=first or len(loop)<3:
            raise ValueError("Open loop on clipped face")
        # This planar face has no recessed outline or secondary inset ring.
        center=np.mean(np.asarray([verts[k] for k in loop]),axis=0)
        center+=normal*(limit-float(normal@center))/float(normal@normal)
        middle=len(verts);verts.append(center)
        for x,y in zip(loop,loop[1:]+loop[:1]):
            faces.append((y,x,middle))
    result=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    result.remove_unreferenced_vertices()
    if not result.is_watertight:
        raise ValueError("Clipped face is not watertight")
    trimesh.repair.fix_normals(result)
    if not result.is_volume:
        raise ValueError("Clipped end is not a solid volume")
    return result


def _cut_marked_corners(mesh,ordinal):
    for side in (-1,1):
        end=END_CUTS[ordinal][0 if side==-1 else 1]
        for vertical,lateral,depth,slope_y,slope_z in end:
            normal=np.array([side,vertical*slope_y,lateral*slope_z])
            # Support of CURRENT solid rather than imaginary box extrema,
            # so each clipping plane actually removes one coarse corner.
            plane=float(np.max(mesh.vertices@normal))-depth*CUT_DEPTH_SCALE
            mesh=_clip_corner_plane(mesh,normal,plane)
    return mesh


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
    # Preserve all interior longitudinal geometry while remodelling tips.
    long_wall=np.asarray(vertices[n:(count-1)*n],dtype=float).copy()
    _finish_blunt_end(vertices,faces,list(range(n)),-1,length)
    _finish_blunt_end(vertices,faces,list(range((count-1)*n,count*n)),1,length)
    if not np.array_equal(np.asarray(vertices[n:(count-1)*n],dtype=float),long_wall):
        raise ValueError("Lintel central sidewall geometry was modified")
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=True)
    trimesh.repair.fix_normals(mesh)
    # Fit the real 25 x 50 cm wall course while preserving the previous
    # irregular side silhouette and the six independently clipped end types.
    # Scale before the corner cuts: do not stretch the completed beveled tips.
    mesh.apply_scale(np.array([float(length),TARGET_HEIGHT_M,TARGET_DEPTH_M])/mesh.extents)
    mesh.apply_translation(-mesh.bounds.mean(axis=0))
    safe=float(length)*.37
    central_before={
        tuple(np.round(v,7)) for v in mesh.vertices if abs(v[0])<safe
    }
    mesh=_cut_marked_corners(mesh,ordinal)
    central_after={
        tuple(np.round(v,7)) for v in mesh.vertices if abs(v[0])<safe
    }
    if central_before!=central_after:
        raise ValueError("Central flank regression after corner cuts")
    if not mesh.is_watertight or not mesh.is_volume:
        raise ValueError("Lintel is not a single watertight stone")
    uv=(np.asarray(mesh.vertices,dtype=float)[:,[0,2]]*2.8).astype(np.float32)
    mesh.visual=TextureVisuals(uv=uv,material=MATERIAL)
    return mesh
