"""Large-facet wild-stone lintels with real chipped edges and rough longitudinal sides.

Mesh authoring, not image synthesis. Y up, X long, Z into masonry.
"""
from __future__ import annotations
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

STYLES = ('hewn-facets', 'broken-strata', 'asymmetric-scar', 'split-slab')
MATERIAL = PBRMaterial(name='ALANTIL_COMMON100_ROCK_PBR', baseColorFactor=[193,176,146,255], metallicFactor=0, roughnessFactor=.97)

BASE_RING = np.array([
    [-.42,-.34],[-.48,-.21],[-.48,.04],[-.46,.30],[-.38,.44],[-.18,.49],
    [.17,.49],[.36,.44],[.46,.31],[.49,.12],[.48,-.17],[.44,-.36],
    [.31,-.47],[.03,-.49],[-.29,-.48],[-.43,-.44],
], dtype=float)


def build_rugged_lintel(rng, length, style, ordinal):
    if style not in STYLES:
        raise ValueError(f'Unsupported lintel style: {style}')
    if float(length) not in (1.0, 1.25, 1.5):
        raise ValueError(f'Unsupported lintel span: {length}')
    count = (17, 19, 21, 23)[STYLES.index(style)] + (ordinal//4)*2
    ring = BASE_RING.copy()
    if style in ('split-slab', 'broken-strata'):
        ring = np.insert(ring, [2, 9], [(.5*ring[1]+.5*ring[2]), (.5*ring[8]+.5*ring[9])], axis=0)
    if style == 'asymmetric-scar':
        ring = np.insert(ring, [4], [(.45*ring[3]+.55*ring[4])], axis=0)
    n = len(ring)
    height = float(rng.uniform(.189, .216))
    depth = float(rng.uniform(.310, .346))
    xaxis = np.linspace(-float(length)/2, float(length)/2, count)

    # Distinct natural fracture swaths on EACH long side, 10-30 cm wide.
    scars = np.zeros((2, count), dtype=float)
    for side in range(2):
        sites = (4, 5, 6, 4)[STYLES.index(style)]
        for k in range(sites):
            center = float(rng.uniform(.09, .91))*(count-1)
            radius = float(rng.uniform(1.0, 2.9))
            strength = float(rng.uniform(.018, .046))
            for i in range(count):
                fade = max(0., 1.-abs(i-center)/radius)
                scars[side, i] += strength*fade

    face_chip = np.zeros((count,n),dtype=float)
    edge_chip = np.zeros((count,n),dtype=float)
    for k in range(16 if style == 'hewn-facets' else 22):
        i0 = int(rng.integers(1,count-1))
        j0 = int(rng.integers(n))
        direction = np.sign(ring[j0,1])
        if abs(ring[j0,1]) < .16:
            continue
        amplitude = float(rng.uniform(.014,.036))
        width = int(rng.integers(1,4))
        for i in range(max(0,i0-width),min(count,i0+width+1)):
            taper = 1.-abs(i-i0)/(width+.35)
            for dj in (-1,0,1):
                j=(j0+dj)%n
                if np.sign(ring[j,1])!=direction:
                    continue
                face_chip[i,j]+=amplitude*taper*(1 if dj==0 else .38)
                if ring[j,0]>.30:
                    edge_chip[i,j]+=amplitude*taper*(.24 if dj==0 else .14)

    vertices = []
    for i,x in enumerate(xaxis):
        for j,(ay,az) in enumerate(ring):
            xx = float(x)
            if i not in (0,count-1):
                xx+=float(rng.uniform(-.005,.005))
            else:
                # Ends are rough non-coplanar faces, not smooth saw cuts.
                xx += (1 if i==0 else -1)*float(rng.uniform(0,.014))
            yy = float(ay*height+rng.uniform(-.0035,.0035))
            zz = float(az*depth+rng.uniform(-.004,.004))
            if az>.12:
                zz-=scars[0,i]*(.62+.38*min(1.,az*2))
                zz-=face_chip[i,j]
            elif az<-.12:
                zz+=scars[1,i]*(.62+.38*min(1.,-az*2))
                zz+=face_chip[i,j]
            if ay>.25:
                yy -= edge_chip[i,j]
                yy += float(rng.uniform(-.009,.008))
            elif ay<-.38:
                # Stable bedding surface underneath despite side cuts.
                yy = -height*.46+float(rng.uniform(-.0025,.0035))
            if style=='broken-strata' and .08<ay<.35:
                yy+=float(rng.uniform(-.006,.005))
            if style=='asymmetric-scar' and az>.1:
                yy+=float(rng.uniform(-.010,.007))
            vertices.append((xx,yy,zz))

    faces=[]
    # Inward chipped facets with TRUE non-coplanar vertices on long sides;
    # not texture bumps and not an extrusion through one smooth side profile.
    for i in range(count-1):
        for j in range(n):
            a=i*n+j; b=i*n+(j+1)%n
            c=(i+1)*n+j; d=(i+1)*n+(j+1)%n
            az=(ring[j,1]+ring[(j+1)%n,1])/2
            ay=(ring[j,0]+ring[(j+1)%n,0])/2
            choose = abs(az)>.25 and -.40<ay<.44 and (i+j+ordinal)%3!=0
            if choose:
                p=(np.array(vertices[a])+np.array(vertices[b])+np.array(vertices[c])+np.array(vertices[d]))/4
                strength=float(rng.uniform(.009,.032))
                if style=='split-slab':
                    strength *= 1.20
                if style=='asymmetric-scar' and az>0:
                    strength *= 1.25
                p[2]-=np.sign(az)*strength
                p[0]+=float(rng.uniform(-.013,.013))
                p[1]+=float(rng.uniform(-.007,.007))
                mid=len(vertices)
                vertices.append(p)
                faces.extend(((a,c,mid),(c,d,mid),(d,b,mid),(b,a,mid)))
            elif (i+j)%2:
                faces.extend(((a,c,d),(a,d,b)))
            else:
                faces.extend(((a,c,b),(b,c,d)))

    # Non-planar rough-hewn endcaps, triangulated with offset interior centers.
    left=len(vertices);vertices.append((xaxis[0]+.012,0,0))
    right=len(vertices);vertices.append((xaxis[-1]-.012,0,0))
    for j in range(n):
        faces.append((left,(j+1)%n,j))
        faces.append((right,(count-1)*n+j,(count-1)*n+(j+1)%n))
    mesh=trimesh.Trimesh(vertices=vertices,faces=faces,process=True)
    trimesh.repair.fix_normals(mesh)
    mesh.apply_scale(np.array([float(length),height,depth])/mesh.extents)
    mesh.apply_translation(-mesh.bounds.mean(axis=0))
    if not mesh.is_volume or not mesh.is_watertight:
        raise ValueError('Generated lintel must be one sealed three-dimensional natural stone')
    uv=(np.asarray(mesh.vertices)[:,[0,2]]*2.8).astype(np.float32)
    mesh.visual=TextureVisuals(uv=uv,material=MATERIAL)
    return mesh
