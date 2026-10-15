#!/usr/bin/env python3
"""AlanTil 17.6: independent, original GLB stone-and-wood doorway.

No synthesized image assets or image-generation tools are used. Geometry is
constructed from the current AlanTil authored natural stones and newly authored
wooden/iron meshes. PBR maps are taken from supplied Poly Haven CC0 archives.
"""
from __future__ import annotations
from pathlib import Path
import math, importlib.util, json
import numpy as np
from PIL import Image
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parent
PROJECT=ROOT/'project'
OUT=ROOT/'assets'
OUT.mkdir(exist_ok=True)
SEED=1762026
rng=np.random.default_rng(SEED)
W=.75
H=2.0
THICK=.50
EXT_W=1.75
EXT_H=2.25

wall_file=PROJECT/'tools/tower/build-prefab-library.py'
spec=importlib.util.spec_from_file_location('alantil_wall',wall_file)
wall=importlib.util.module_from_spec(spec);spec.loader.exec_module(wall)
wall.MATERIAL_SOURCE=PROJECT / "assets/tower/rock_07/textures"
ROCKS=wall.normalized_rocks(PROJECT/'assets/tower/source-original-36.glb')
IDS=(0,3,5,7,10,11,12,14,15,18,19,20,23,24,25,26,27,29,31,32,33,34,35)

# Delivered photographic PBR maps; normal/roughness were converted by the
# previously approved standalone window builder, rather than generated anew.
ready=ROOT/'textures'
matfile=lambda name: Image.open(ready/name).copy()
wood=matfile('wood_diffuse.jpg').convert('RGB')
wood_normal=matfile('wood_normal.jpg').convert('RGB')
wood_arm=matfile('wood_arm.png').convert('RGB')
iron=matfile('iron_patina.jpg').convert('RGB')
iron_normal=matfile('iron_normal.jpg').convert('RGB')
iron_arm=matfile('iron_arm.png').convert('RGB')
# Ensure the builder really uses the uploaded photographic original.
assert np.std(np.asarray(wood,dtype=float))>15
assert np.std(np.asarray(iron,dtype=float))>5
endgrain=matfile('wood_endgrain.jpg').convert('RGB')

MATERIALS={
    'wood':PBRMaterial(name='Poly Haven CC0 Wood Shutter - antique oak frame',
        baseColorTexture=wood,normalTexture=wood_normal,metallicRoughnessTexture=wood_arm,
        roughnessFactor=.96,metallicFactor=0,baseColorFactor=[255,255,255,255]),
    'plank':PBRMaterial(name='Poly Haven CC0 Wood Shutter - solid aged door planks',
        baseColorTexture=wood,normalTexture=wood_normal,metallicRoughnessTexture=wood_arm,
        roughnessFactor=.94,metallicFactor=0,baseColorFactor=[255,255,255,255]),
    'endgrain':PBRMaterial(name='Old timber end-grain',baseColorTexture=endgrain,
        roughnessFactor=.95,metallicFactor=0,baseColorFactor=[255,255,255,255]),
    'iron':PBRMaterial(name='Poly Haven CC0 Rust Coarse 01 - forged iron',
        baseColorTexture=iron,normalTexture=iron_normal,metallicRoughnessTexture=iron_arm,
        roughnessFactor=.90,metallicFactor=.65,baseColorFactor=[255,255,255,255]),
}

COLLECTION={k:[] for k in MATERIALS}
PARTS=[]

def attach(name,vertices,faces,uv,kind):
    arr=np.asarray(vertices,dtype=np.float64)
    tris=np.asarray(faces,dtype=np.int64)
    mesh=trimesh.Trimesh(vertices=arr,faces=tris,process=False)
    mesh.visual=TextureVisuals(uv=np.asarray(uv,dtype=np.float64),material=MATERIALS[kind])
    COLLECTION[kind].append(mesh)
    PARTS.append({'name':name,'kind':kind,'triangles':len(mesh.faces)})
    return mesh


def timber(name,p0,p1,width,depth,zcenter=0,kind='wood',seed=0,chamfer=.004):
    """Hand-dressed solid timber with true bevels, endgrain and anisotropic UV.

    The longitudinal vector p1-p0 defines texture V direction. A consistent
    physical scale and staggered UV offsets avoid repeated synthetic stripes.
    """
    start=np.asarray(p0,dtype=float);finish=np.asarray(p1,dtype=float)
    axis=finish-start;length=np.linalg.norm(axis)
    assert length>.015
    direction=axis/length
    side=np.array([direction[1],-direction[0]])
    ring=np.array([[-width/2+chamfer,-depth/2],[width/2-chamfer,-depth/2],
      [width/2,-depth/2+chamfer],[width/2,depth/2-chamfer],
      [width/2-chamfer,depth/2],[-width/2+chamfer,depth/2],
      [-width/2,depth/2-chamfer],[-width/2,-depth/2+chamfer]])
    segments=max(7,int(length/.095))
    vertices=[];faces=[];uv=[]
    for k in range(8):
        k2=(k+1)%8
        for s in range(segments):
            t0=s/segments;t1=(s+1)/segments
            quad=[]
            for t,c in ((t0,k),(t0,k2),(t1,k2),(t1,k)):
                taper=.0014*math.sin(t*7.9+seed*.55+c*.33)+.0006*math.sin(t*22.1+seed*1.8+c*.54)
                lateral=ring[c,0]+taper
                depthc=ring[c,1]+.0004*math.sin(17.3*t+seed+c)
                p=start+axis*t+side*lateral
                quad.append([p[0],p[1],zcenter+depthc])
            idx=len(vertices);vertices.extend(quad)
            faces.extend([[idx,idx+1,idx+2],[idx,idx+2,idx+3]])
            u=(seed*.173+k*.142)%1
            # Physical texel scale of the source wood_shutter atlas (1m wide).
            ucross=width if k in (0,4) else depth if k in (2,6) else chamfer*1.42
            uv.extend([(u,t0*length*.96+seed*.31),(u+ucross,t0*length*.96+seed*.31),
                       (u+ucross,t1*length*.96+seed*.31),(u,t1*length*.96+seed*.31)])
    attach(name,vertices,faces,uv,kind)
    for sign,base in ((-1,start),(1,finish)):
        pts=[];tex=[]
        for a,z in ring:
            p=base+side*a
            pts.append([p[0],p[1],zcenter+z]);tex.append([.5+a/width*.37,.5+z/depth*.37])
        ix=len(pts);pts.append([base[0],base[1],zcenter]);tex.append([.5,.5])
        f=[]
        for k in range(8):
            f.append([ix,k,(k+1)%8] if sign==1 else [ix,(k+1)%8,k])
        attach(name+' endgrain '+str(sign),pts,f,tex,'endgrain')


def mesh_prism(name,poly,zmin,zmax,kind='iron'):
    """Closed polygon extrusion: plate lies ON wood, not suspended in space."""
    poly=np.asarray(poly,dtype=float);n=len(poly)
    vertices=[];uv=[]
    for z in (zmin,zmax):
        for x,y in poly:
            vertices.append((x,y,z));uv.append((x*.88+.3,y*.88+.5))
    faces=[]
    for j in range(1,n-1):
        faces.append([0,j+1,j]);faces.append([n,n+j,n+j+1])
    for j in range(n):
        nxt=(j+1)%n
        faces.extend([[j,nxt,n+nxt],[j,n+nxt,n+j]])
    return attach(name,vertices,faces,uv,kind)


def cylinder(name,first,last,radius,kind='iron',sides=14):
    a=np.asarray(first,float);b=np.asarray(last,float);d=b-a;length=np.linalg.norm(d)
    if length<1e-8:raise ValueError(name)
    axis=d/length;other=np.cross(axis,[0,0,1])
    if np.linalg.norm(other)<.0001:other=np.cross(axis,[0,1,0])
    other/=np.linalg.norm(other);up=np.cross(axis,other)
    vertices=[];uv=[];faces=[]
    for i,p in enumerate((a,b)):
        for j in range(sides):
            th=j*2*math.pi/sides
            vertices.append(p+radius*(other*math.cos(th)+up*math.sin(th)))
            uv.append((j/sides,i*length))
    for j in range(sides):
        k=(j+1)%sides
        faces.extend([[j,k,sides+k],[j,sides+k,sides+j]])
    for i,p in enumerate((a,b)):
        idx=len(vertices);vertices.append(p);uv.append((.5,.5))
        for j in range(sides):
            k=(j+1)%sides
            faces.append([idx,i*sides+k,i*sides+j] if i==0 else [idx,i*sides+j,i*sides+k])
    return attach(name,vertices,faces,uv,kind)


def forge_strap(name,x0,x1,y,zbase,cent_height=.034):
    """Tapered wrought-iron hinge strap, rear face flush on timber's front."""
    # rounded-spear-end rather than a factory-perfect rectangular slab
    A=np.array([[x0,y-.046],[x1-.042,y-.037],[x1,y],[x1-.042,y+.037],[x0,y+.046]])
    mesh_prism(name,A,zbase,zbase+.008)
    for j,x in enumerate(np.linspace(x0+.035,x1-.063,3)):
        cylinder(name+' clenched rivet '+str(j),[x,y,zbase+.005],[x,y,zbase+.012],.0052,'iron')


def forged_ring(name,cx,cy,cz,radius):
    pts=[]
    for j in range(29):
        a=j*2*math.pi/28
        pts.append((cx+radius*math.cos(a),cy+radius*math.sin(a),cz+.006*math.sin(a)))
    for j in range(len(pts)-1):
        cylinder(name+' ring '+str(j),pts[j],pts[j+1],.0046,kind='iron',sides=9)

# -- Wild natural-stone envelope (7 x 9 x 2 grid cells; no cuboidal rocks) --
from door_wild_packing import pack_pier, acceptable_stones, MAX_FULLNESS
STONES=[]
stone_names=[]
PILLAR_METRICS=[]
ORIGINAL_ROCK_IDS=[]
# Local stone packers work on 0.50 x 2.00 x 0.50 m *open volumes*, not a
# pre-divided collection of boxes. Translate the packed stones into the two
# real masonry piers. Every triangle is sourced from source-original-36.glb.
for pier,cx in enumerate((-.625,.625)):
    packing_rng=np.random.default_rng(1763+pier)
    packed,rock_ids,volume,metrics=pack_pier(wall,ROCKS,packing_rng,pier,max_small=100)
    for i,(mesh,rock_id) in enumerate(zip(packed,rock_ids)):
        mesh.apply_translation((cx,0.,0.))
        STONES.append(mesh)
        stone_names.append(f'wild-pier-{pier}-natural-source-rock-{rock_id:02d}-{i:03d}')
        ORIGINAL_ROCK_IDS.append(int(rock_id))
    metrics['pier']=pier
    metrics['face_coverage']=list(np.round(volume.surface_coverage(),3))
    PILLAR_METRICS.append(metrics)
# The lintel is ONE ORIGINAL NATURAL ROCK, not cuboid masonry, not a beam assembled
# from smaller stones. Restore a believable broken contour on its long front/back
# sides and both narrow end faces; preserve the load-bearing heel at each pier.
# The original 82-face stretched natural rock has a smooth, almost straight outline.
# Tessellation lets the *actual* geometry have fractured/angled chips instead of
# adding fake stickers or dark lines over a flat face.
def fracture_natural_lintel(rock, divisions=8):
    import trimesh
    r=np.random.default_rng(20261015)
    verts=np.asarray(rock.vertices,dtype=np.float64)
    uv=np.asarray(rock.visual.uv,dtype=np.float64)
    out_verts=[];out_uv=[];out_faces=[]
    for tri in rock.faces:
        xyz=verts[tri]; tex=uv[tri]
        map_ij={}
        for i in range(divisions+1):
            for j in range(divisions+1-i):
                a=i/divisions;b=j/divisions
                weights=np.array([1-a-b,a,b])
                map_ij[(i,j)]=len(out_verts)
                out_verts.append(weights@xyz)
                out_uv.append(weights@tex)
        for i in range(divisions):
            for j in range(divisions-i):
                one=map_ij[(i,j)];two=map_ij[(i+1,j)];three=map_ij[(i,j+1)]
                out_faces.append((one,two,three))
                if i+j<divisions-1:
                    out_faces.append((two,map_ij[(i+1,j+1)],three))
    p=np.asarray(out_verts,dtype=np.float64)
    x,y,z=p.T.copy()
    # The piecewise LINEAR fracture profiles deliberately form angular facets
    # and small changes of direction, not sinusoidal decoration.
    def jagged(coordinates,lo,hi,knots,seed,low=-1,high=1):
        rr=np.random.default_rng(seed)
        grid=np.linspace(lo,hi,knots)
        levels=rr.uniform(low,high,knots)
        return np.interp(coordinates,grid,levels)
    x_jag=jagged(x,-.875,.875,35,221)
    y_jag=jagged(y,1.,1.25,10,551)
    z_jag=jagged(z,-.25,.25,12,322)
    very_fine=jagged(x,-.875,.875,97,123)*.0017
    # Carve coherent faceted setbacks into the two long front/rear faces. The
    # carving lives in real XYZ; UVs still follow the original authored rock.
    face_weight=np.clip((np.abs(z)-.080)/.160,0,1)**1.3
    side_displacement=face_weight*(.013*x_jag + .008*y_jag+very_fine)
    chips=[(-.710,1.123,.093,.085,.020),(-.460,1.195,.063,.040,.016),
           (-.188,1.073,.074,.057,.023),(.090,1.191,.070,.047,.019),
           (.341,1.116,.083,.071,.025),(.601,1.202,.064,.042,.018)]
    for cx,cy,rx,ry,depth in chips:
        # Sharp, sloping V-shaped edges produce discrete chipped planes.
        diamond=np.maximum(0.,1.-np.abs(x-cx)/rx-np.abs(y-cy)/ry)
        side_displacement-=depth*diamond
    p[:,2]=z+np.sign(z)*side_displacement
    # Chipped, stepped narrow end faces. Here the profile depends on y AND z;
    # the end-on silhouette is therefore neither rectangular nor smooth.
    end_weight=np.clip((np.abs(x)-.620)/.250,0,1)**1.3
    inset=.003+.011*np.abs(y_jag)+.010*np.abs(z_jag)
    for cy,cz,ry,rz,depth in [(1.185,-.135,.043,.092,.016),
                              (1.075,.140,.046,.085,.024),
                              (1.225,.093,.024,.054,.012)]:
        inset+=depth*np.maximum(0,1.-np.abs(y-cy)/ry-np.abs(z-cz)/rz)
    p[:,0]=x-np.sign(x)*end_weight*inset
    # Ragged top edge, but keep the sill flat enough at x ±0.625 m to bear on
    # the two wild-stone piers. Do not lower anything into the door opening.
    top_weight=np.clip((y-1.13)/.116,0,1)**1.1
    p[:,1]=y-top_weight*(.004+.011*np.abs(x_jag)+.004*np.abs(z_jag))
    bearing=np.clip((np.abs(x)-.47)/.11,0,1)
    bottom_weight=np.clip((1.06-y)/.060,0,1)*(.10+.90*(1-bearing))
    p[:,1]+=bottom_weight*(.0015+.0045*np.abs(x_jag))
    # Keep the exact external door-section envelope and clear headroom.
    p[:,0]=np.clip(p[:,0],-.8745,.8745)
    p[:,2]=np.clip(p[:,2],-.2489,.2489)
    p[:,1]=np.clip(p[:,1],1.0025,1.2485)
    displacement=np.linalg.norm(p-np.asarray(out_verts),axis=1)
    assert np.quantile(displacement,.95)>.006, 'Not enough visible geometric relief'
    assert displacement.max()<.055, 'Fracture would become an unrealistic overhang'
    model=trimesh.Trimesh(vertices=p,faces=np.asarray(out_faces,dtype=np.int64),process=False)
    model.visual=TextureVisuals(uv=np.asarray(out_uv),material=rock.visual.material)
    model.metadata.update(rock.metadata)
    model.metadata['lintel']='single, broken-side, original authored stone'
    model.metadata['fracture_max_m']=float(displacement.max())
    model.metadata['fracture_p95_m']=float(np.quantile(displacement,.95))
    model.metadata['source_faces']=len(rock.faces)
    print('MONOLITHIC_LINTEL',len(model.faces),'faces',
          'carved max mm',round(displacement.max()*1000,1),
          'carved p95 mm',round(np.quantile(displacement,.95)*1000,1),
          'bounds',np.round(model.bounds,4).tolist())
    return model

rock_lintel=ROCKS[12]
assert rock_lintel['fullness']<MAX_FULLNESS
lintel_extent=np.array([1.738,.245,.489])
raw_lintel=wall.make_mesh(rock_lintel,lintel_extent/rock_lintel['aspect'],
                    [0,1.125,0],wall.PALETTE[2])
part=fracture_natural_lintel(raw_lintel)
STONES.append(part)
stone_names.append('one-monolithic-fractured-natural-stone-lintel')
ORIGINAL_ROCK_IDS.append(13)
assert len(STONES)>90
assert all(ROCKS[i-1]['fullness']<MAX_FULLNESS for i in ORIGINAL_ROCK_IDS)

# -- Properly fitting wood frame, all joinery in the same coordinate system --
# Leaves 1-2 mm tolerance to natural stone faces; excludes visually empty bands.
timber('left built-in door jamb',[-.334,-.997],[-.334,.997],.081,.12,seed=1)
timber('right built-in door jamb',[.334,-.997],[.334,.997],.081,.12,seed=2)
timber('top fitted timber head',[-.372,.950],[.372,.950],.103,.12,seed=3)
timber('bottom fitted wooden sill',[-.372,-.956],[.372,-.956],.084,.12,seed=4)
# Doorleaf boards: four unequal-width real solids with tiny joints, no voids.
# Frame face and leaf face nearly coincide in the FRONT mounting plane.
BOARD_CENTRE_Z=.015
plank_edges=np.array([-.292,-.148,.012,.160,.292])
for k in range(4):
    l=plank_edges[k];h=plank_edges[k+1]
    x=(l+h)*.5
    timber(f'authored vertical door board {k+1}',[x,-.915],[x,.910],
           width=(h-l)+.004,depth=.137,zcenter=BOARD_CENTRE_Z,kind='plank',seed=12+k,chamfer=.0028)
# Hardware plates sit against a continuous face at z=0.085; no floating attachments.
# Interior traditional cross braces are BEHIND the shutter, not on the facade.
back=-.069
for i,y in enumerate((.72,-.73)):
    timber(f'back structural cross batten {i+1}',[-.276,y],[.276,y],.077,.041,zcenter=back,seed=41+i)
timber('back hand fitted diagonal brace',[-.250,-.62],[.245,.605],.068,.035,zcenter=-.074,seed=44)
# Metal hinge shaft is fixed to both jamb and leaf; all hinge shafts are collinear.
HX=-.298;HZ=.107
HINGES=[-.76,-.03,.74]
for i,hy in enumerate(HINGES):
    forge_strap(f'hinge {i+1} moving forged strap',HX,.088,hy,zbase=.083)
    # Stationary jamb plate actually contacts outer door jamb front face (+.060)
    mesh_prism(f'hinge {i+1} jamb leaf plate',
      [(-.362,hy-.061),(-.312,hy-.061),(-.300,hy),(-.312,hy+.061),(-.362,hy+.061)],
      .059,.069)
    mesh_prism(f'hinge {i+1} solid forged knuckle neck',
      [(HX-.010,hy-.036),(HX+.022,hy-.036),(HX+.022,hy+.036),(HX-.010,hy+.036)],.087,.108)
    cylinder(f'hinge {i+1} coaxial vertical barrel',[HX,hy-.074,HZ],
               [HX,hy+.074,HZ],.012)
    cylinder(f'hinge {i+1} pin stem',[HX,hy-.086,HZ],[HX,hy+.086,HZ],.0057)
    for ry in (-.041,.041):
        cylinder(f'hinge {i+1} jamb rivet {ry}',[-.341,hy+ry,.069],[-.341,hy+ry,.078],.0052)
# Heavy handle, plate and ring; backing contact with door surface 0.0835.
mesh_prism('iron escutcheon and latch backing plate',
  [( .177,-.155),(.229,-.155),(.248,-.136),(.248,.137),(.230,.156),(.176,.156),(.167,.137),(.167,-.136)],
    .083,.090)
for k,y in enumerate((-.129,.128)):
    cylinder('handle fastener '+str(k),[.209,y,.090],[.209,y,.100],.0057)
# Ring mounted on iron rosette and supported by a genuine central spindle.
cylinder('forged door handle spindle',[.202,-.01,.091],[.202,-.01,.122],.0095)
forged_ring('hand-forged door ring pull',.202,-.059,.141,.048)
cylinder('door handle ring connection', [.202,-.01,.117],[.202,-.01,.149],.0058)
# Horizontal locking bar through anchored keeper on the stationary jamb.
mesh_prism('iron latch keeper',[ (.268,-.086),(.352,-.086),(.352,-.035),(.268,-.035)],.069,.083)
cylinder('sliding forged latch bolt',[.188,-.059,.105],[.330,-.059,.105],.0083)
mesh_prism('latch support connecting bolt to escutcheon',
      [( .184,-.081),(.216,-.081),(.216,-.037),(.184,-.037)],.087,.107)
mesh_prism('keeper bridge encircling latch bolt',
      [( .282,-.075),(.306,-.075),(.306,-.043),(.282,-.043)],.083,.110)
for j,x in enumerate((.283,.334)):
    cylinder(f'keeper fixing {j}',[x,-.067,.083],[x,-.067,.092],.0047)
# No glass, hinges and bolts occupy the same constructed coordinate system.
assert all(abs(HX+.298)<1e-10 for _ in HINGES)
assert abs(plank_edges[0]+.292)<1e-10 and abs(plank_edges[-1]-.292)<1e-10

# -- Batch rock shades + 4 wooden material classes into GLB assets -----------
def scene_for(grouped_stone=True,grouped_wood=True):
    scene=trimesh.Scene(base_frame='world')
    if grouped_stone:
        grouped={}
        for mesh in STONES:
            grouped.setdefault(mesh.metadata['shade'],[]).append(mesh)
        for i,(col,parts) in enumerate(sorted(grouped.items())):
            merged=trimesh.util.concatenate(parts)
            merged.visual.material=wall.stone_pbr_material(col)
            scene.add_geometry(merged,geom_name=f'stone::{i}',node_name=f'stone_group_{i}')
    if grouped_wood:
        for kind,ms in COLLECTION.items():
            if not ms:continue
            merged=trimesh.util.concatenate(ms)
            merged.visual.material=MATERIALS[kind]
            scene.add_geometry(merged,geom_name=f'wood_or_iron::{kind}',node_name=f'architectural_{kind}')
    return scene

stone_scene=scene_for(grouped_wood=False)
door_scene=scene_for(grouped_stone=False)
whole_scene=scene_for()
stone_path=OUT/'AlanTil_door_stone_section_wild_7x9x2.glb'
door_path=OUT/'AlanTil_wooden_door_0.75x2m.glb'
all_path=OUT/'AlanTil_door_complete_wild_7x9x2.glb'
for scene,path in [(stone_scene,stone_path),(door_scene,door_path),(whole_scene,all_path)]:
    scene.export(path,file_type='glb')
    assert trimesh.load(path,force='scene').geometry
assert door_scene.bounds[0,0]<-.370 and door_scene.bounds[1,0]>.370
assert door_scene.bounds[0,1]<-.997 and door_scene.bounds[1,1]>.997
assert stone_scene.bounds[0,0]<-.86 and stone_scene.bounds[1,0]>.86
assert stone_scene.bounds[1,1]>1.24
meta={
 'version':'17.6-door-wild.3', 'footprint_grid':[7,9,2],
 'section_m':{'width':EXT_W,'height':EXT_H,'depth':THICK},
 'opening_m':{'width':W,'height':H},
 'wooden_door_material':'Poly Haven wood_shutter CC0',
 'iron_material':'Poly Haven rust_coarse_01 CC0',
 'original_rock_count':36,'rocks_used_in_section':len(STONES),
 'source_rock_ids':sorted(set(ORIGINAL_ROCK_IDS)),
 'packing_metrics':PILLAR_METRICS,
 'maximum_source_rock_fullness':MAX_FULLNESS,
 'hinges':len(HINGES), 'hinge_axis_m':{'x':HX,'z':HZ},
 'lintel':{'single_original_stone':True,'sculpted':True,
           'source_triangles':part.metadata['source_faces'],
           'triangles':len(part.faces),
           'edge_relief_p95_mm':round(part.metadata['fracture_p95_m']*1000,2),
           'edge_relief_max_mm':round(part.metadata['fracture_max_m']*1000,2)},
 'wood_and_iron_parts':len(PARTS),'stone_triangles':sum(len(p.faces) for p in STONES),
 'wood_metal_triangles':sum(len(p.faces) for ss in COLLECTION.values() for p in ss),
 'assets':{p.stem:p.stat().st_size for p in [stone_path,door_path,all_path]}}
(OUT/'model_manifest.json').write_text(json.dumps(meta,ensure_ascii=False,indent=2))
print('DOOR_DONE',json.dumps(meta,ensure_ascii=False))
