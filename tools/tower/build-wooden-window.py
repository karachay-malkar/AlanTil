#!/usr/bin/env python3
"""Independent, license-clean, authored 3D window preview.
The Sketchfab window is reference only; none of its vertices/textures are extracted.
Produces production-candidate GLB and data for completely offline native WebGL viewer.
"""
from pathlib import Path
import math, json, base64, io, zlib
import numpy as np
from PIL import Image, ImageFilter
from scipy.ndimage import gaussian_filter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial
R=Path(__file__).resolve().parent
rng=np.random.default_rng(20261015)
W=.500; H=1.000

# Create a detailed age-worn wood PBR surface, with ring curvature, pores and knots.
N=1024
x=np.linspace(0,1,N,dtype=np.float32)[None,:]
y=np.linspace(0,1,N,dtype=np.float32)[:,None]
noise=rng.normal(0,1,(N,N)).astype('float32')
macro=gaussian_filter(noise, (28,17)); macro/=max(macro.std(),1e-5)
meso=gaussian_filter(noise,(4,14)); meso/=max(meso.std(),1e-5)
fine=gaussian_filter(noise,(1.8,3)); fine/=max(fine.std(),1e-5)
slender=gaussian_filter(noise,(36,1.3)); slender/=max(slender.std(),1e-5)
warp=(np.sin(y*19+macro*.5)*.010 + np.sin(y*47+meso*.35)*.004 +macro*.011)
# Knot embedded in wavy fibers; anisotropic streamlines swirl around knot.
knots=[(.34,.25,.035,.048),(.77,.65,.027,.046),(.14,.83,.018,.032)]
for kx,ky,rx,ry in knots:
 dx=(x-kx)/rx;dy=(y-ky)/ry
 rr=np.exp(-(dx*dx+dy*dy)*.75)
 warp += .042*(x-kx)/(rx+.001)*rr
u=x+warp
rings=(.53*np.sin(u*104+np.sin(y*24)*1.2)+.22*np.sin(u*180+y*2.3)+.12*np.sin(u*318+meso*.7))
undercut=np.clip(rings*.53, -.8,.8)
for kx,ky,rx,ry in knots:
 rxn=(x-kx)/rx; ryn=(y-ky)/ry
 r2=rxn*rxn+ryn*ryn
 undercut += -.38*np.exp(-r2*.85)+.16*np.cos(6*r2)*np.exp(-r2*.55)
# woody aged tan-dark brown; physically separate per-pixel fine grain/noise
light= .30*undercut + .34*meso + .18*slender + .28*macro + .16*fine
base=np.array([84.,65.,48.],dtype='float32')
col=np.clip(base[None,None,:]+light[...,None]*np.array([19.5,17,15])+np.array([2.,1.,-1.]),0,255).astype('uint8')
rough=np.clip(213 - 7*undercut + 14*np.abs(fine) + 8*meso + 5*macro,174,247).astype('uint8')
# Convert a subtle procedural elevation into tangent-space normal, not exaggerated.
height=(.23*undercut+.16*meso+.055*fine)
grad_y,grad_x=np.gradient(gaussian_filter(height,.9))
norm=np.stack([np.clip(-grad_x*3.8,-1,1),np.clip(-grad_y*3.8,-1,1),np.ones((N,N),dtype='float32')],axis=-1)
norm/=np.linalg.norm(norm,axis=2,keepdims=True)
normrgb=np.clip((norm*.5+.5)*255,0,255).astype('uint8')
Image.fromarray(col,'RGB').save(R/'wood_diffuse.jpg',quality=91,subsampling=0,optimize=True)
Image.fromarray(normrgb,'RGB').save(R/'wood_normal.jpg',quality=89,optimize=True)
Image.fromarray(rough,'L').save(R/'wood_roughness.png',optimize=True)
# Endgrain with real rings around an offset heart, visually distinct from length grain.
rr=np.sqrt(((x-.47)/.88)**2+((y-.52)/1.22)**2)
endnoise=gaussian_filter(noise,(4,4));endnoise/=endnoise.std()
radial=np.sin((rr + .006*endnoise)*75 + np.sin(rr*25)*.8)
endcolor=np.clip(np.array([102,81,61])[None,None,:] + radial[...,None]*np.array([14,11,10])+endnoise[...,None]*3,0,255).astype('uint8')
Image.fromarray(endcolor,'RGB').save(R/'wood_endgrain.jpg',quality=90)
# Iron metal with dark patina, hammered pits and small warm oxidized flecks.
metalnoise=gaussian_filter(noise,(2.4,2.4));metalnoise/=metalnoise.std()
metalbase=np.clip(np.array([37,39,39])[None,None,:]+metalnoise[...,None]*np.array([12,13,13])+np.maximum(noise-1.8,0)[...,None]*np.array([10,5,0]),0,255).astype('uint8')
Image.fromarray(metalbase,'RGB').save(R/'iron_patina.jpg',quality=88)
# Pitted black iron PBR: metalness, hammered normal and nonuniform roughness.
iron_height=gaussian_filter(metalnoise,.65)*.22 + gaussian_filter(noise,.9)*.075
iron_gy,iron_gx=np.gradient(iron_height)
iron_n=np.stack([-iron_gx*3.6,-iron_gy*3.6,np.ones((N,N),dtype=np.float32)],axis=-1)
iron_n/=np.maximum(np.linalg.norm(iron_n,axis=-1,keepdims=True),1e-8)
Image.fromarray(np.uint8(np.clip((iron_n*.5+.5)*255,0,255)),'RGB').save(R/'iron_normal.jpg',quality=91)
iron_rough=np.uint8(np.clip(190+metalnoise*9+fine*7,155,226))
wood_arm=np.stack([np.uint8(np.clip(255-5*np.abs(meso),225,255)),rough,np.zeros_like(rough)],axis=-1)
iron_arm=np.stack([np.uint8(np.clip(249-5*np.abs(metalnoise),210,255)),iron_rough,np.full_like(iron_rough,224)],axis=-1)
Image.fromarray(wood_arm,'RGB').save(R/'wood_arm.png',optimize=True)
Image.fromarray(iron_arm,'RGB').save(R/'iron_arm.png',optimize=True)

# Prefer genuine licensed CC0 scans when installed beside this generator.
# Never fake a successful download: without them the local authored PBR is used.
photographic=R/'cc0_materials'
photo_names=['wood_shutter_diff_1k.jpg','wood_shutter_nor_gl_1k.jpg','wood_shutter_rough_1k.jpg',
             'rust_coarse_01_diff_1k.jpg','rust_coarse_01_nor_gl_1k.jpg','rust_coarse_01_rough_1k.jpg']
if all((photographic/n).is_file() for n in photo_names):
    wood_rgb=np.array(Image.open(photographic/photo_names[0]).convert('RGB').resize((N,N)),dtype=np.float32)
    wood_rgb=np.clip(wood_rgb*np.array([.86,.81,.76])[None,None,:],0,255).astype('uint8')
    Image.fromarray(wood_rgb,'RGB').save(R/'wood_diffuse.jpg',quality=93)
    Image.open(photographic/photo_names[1]).convert('RGB').resize((N,N)).save(R/'wood_normal.jpg',quality=92)
    wood_rough=np.asarray(Image.open(photographic/photo_names[2]).convert('L').resize((N,N)),dtype='uint8')
    wood_rough=np.clip(wood_rough.astype('int16')+12,0,255).astype('uint8')
    wood_ao=np.full_like(wood_rough,255,dtype='uint8')
    Image.fromarray(wood_rough,'L').save(R/'wood_roughness.png')
    Image.fromarray(np.stack([wood_ao,wood_rough,np.zeros_like(wood_rough)],axis=-1),'RGB').save(R/'wood_arm.png')
    iron_rgb=np.array(Image.open(photographic/photo_names[3]).convert('RGB').resize((N,N)),dtype=np.float32)
    iron_rgb=np.clip(iron_rgb*.30+np.array([18,20,21]),0,255).astype('uint8')
    Image.fromarray(iron_rgb,'RGB').save(R/'iron_patina.jpg',quality=92)
    Image.open(photographic/photo_names[4]).convert('RGB').resize((N,N)).save(R/'iron_normal.jpg',quality=92)
    iron_rough=np.asarray(Image.open(photographic/photo_names[5]).convert('L').resize((N,N)),dtype='uint8')
    Image.fromarray(np.stack([np.full_like(iron_rough,249),iron_rough,np.full_like(iron_rough,221)],axis=-1),'RGB').save(R/'iron_arm.png')
    print('MATERIAL_SOURCE Poly Haven CC0: wood_shutter + rust_coarse_01',flush=True)
else:
    print('MATERIAL_SOURCE authored offline fallback (CC0 files not available)',flush=True)



def material(name,img,roughness,metallic=0.0,alpha=255,normal=None,arm=None):
 return PBRMaterial(name=name,baseColorFactor=[255,255,255,alpha],
    baseColorTexture=Image.open(R/img).convert('RGB') if img else None,
    normalTexture=Image.open(R/normal).convert('RGB') if normal else None,
    metallicRoughnessTexture=Image.open(R/arm).convert('RGB') if arm else None,
    metallicFactor=metallic,roughnessFactor=roughness,
    alphaMode='BLEND' if alpha<255 else 'OPAQUE',doubleSided=True)
materials={
 0:material('Weathered hand-worked timber', 'wood_diffuse.jpg',.89,normal='wood_normal.jpg',arm='wood_arm.png'),
 1:material('Exposed end grain','wood_endgrain.jpg',.94,arm='wood_arm.png'),
 2:material('Blackened hand-forged iron','iron_patina.jpg',.83,metallic=.78,normal='iron_normal.jpg',arm='iron_arm.png'),
 3:material('Oxidized fasteners','iron_patina.jpg',.85,metallic=.78,normal='iron_normal.jpg',arm='iron_arm.png'),
 4:PBRMaterial(name='Uneven old glazing',baseColorFactor=[159,187,185,55],roughnessFactor=.16,metallicFactor=.0,alphaMode='BLEND',doubleSided=True),
 5:material('Dark timber cracks','wood_diffuse.jpg',1.0)
}
parts={i:[] for i in materials};named=[]

def attach(vertices,faces,uv,matid,label):
    m=trimesh.Trimesh(vertices=np.asarray(vertices,dtype='float32'),faces=np.asarray(faces,dtype='int32'),process=False)
    m.visual=TextureVisuals(uv=np.asarray(uv,dtype='float32'),material=materials[matid])
    parts[matid].append(m);named.append((label,len(m.faces)))
    return m

def rotate_axis(q,axis):
 if axis=='Y':return q
 if axis=='X':return np.array([q[1],-q[0],q[2]])
 if axis=='Z':return np.array([q[0],q[2],-q[1]])
 raise ValueError(axis)

def wood_beam(label,center,L,w,d,axis='Y',seed=0,matid=0,chamfer=.004):
  """Shaped continuous solid timber, 8-edge chamfers, irregular hand-dressed taper."""
  local_rng=np.random.default_rng(101+seed*53)
  b=min(chamfer,w*.17,d*.17)
  # Cross section clockwise, 8 corners: reveals genuine beveled edges at all sides.
  ring=np.array([
   [-w/2+b,-d/2], [w/2-b,-d/2], [w/2,-d/2+b], [w/2,d/2-b],
   [w/2-b,d/2],[-w/2+b,d/2],[-w/2,d/2-b],[-w/2,-d/2+b]
  ],dtype=float)
  ncuts=7
  verts=[];faces=[];UV=[]
  uv_shift=(seed*0.223)%0.72
  # Duplicate vertices for hard face normal, and separate physical UV seams.
  for side in range(8):
   for j in range(ncuts-1):
    poly=[]
    for ll,k in ((j,side),(j,(side+1)%8),(j+1,(side+1)%8),(j+1,side)):
     t=ll/(ncuts-1)
     u=ring[k,0];z=ring[k,1]
     knot=.0006*np.sin(t*9+seed*2.3+k*.75)
     # millimeter-scale uneven bevel, avoids industrial-perfect straightness
     u += knot + local_rng.uniform(-.00028,.00028)
     z += knot*.5 + local_rng.uniform(-.00025,.00025)
     v=(t-.5)*L
     point=rotate_axis(np.array([u,v,z]),axis)+np.asarray(center)
     poly.append(point)
    start=len(verts);verts.extend(poly)
    faces.extend([[start,start+1,start+2],[start,start+2,start+3]])
    # Source wood grain runs along texture V. Each beam uses its own lengthwise UV offset.
    # The two lateral vertices span realistic ~5cm on the source atlas rather than
    # compressing the entire side into a 16-pixel striped band.
    tex_width=.24 + (side%2)*.065
    ubase=(seed*.137+side*.173)%1.
    lv0=j/(ncuts-1)*L/.78 + seed*.193
    lv1=(j+1)/(ncuts-1)*L/.78 + seed*.193
    UV.extend([(ubase,lv0),(ubase+tex_width,lv0),(ubase+tex_width,lv1),(ubase,lv1)])
  attach(verts,faces,UV,matid,label)
  # Wooden exposed ends have distinct radial ring UV orientation.
  for end in [-1,1]:
   pts=[rotate_axis(np.array([u,end*L/2,z]),axis)+np.asarray(center) for u,z in ring]
   vertices=np.vstack([pts,rotate_axis(np.array([0,end*L/2,0]),axis)+np.asarray(center)])
   fi=[]
   for k in range(8):fi.append([8,k,(k+1)%8] if end==1 else [8,(k+1)%8,k])
   uvs=[(.5+u/(max(w,d)*2),.5+z/(max(w,d)*2)) for u,z in ring]+[(.5,.5)]
   attach(vertices,fi,uvs,1,label+'_end')

def panel(label,c,size,matid,shade=0):
 # Single very thin panel as a real solid, gentle depth for inner reflections.
 sx,sy,sz=size; x,y,z=c
 verts=np.array([[x+dx*sx/2,y+dy*sy/2,z+dz*sz/2] for dz in [-1,1] for dy in [-1,1] for dx in [-1,1]])
 faces=np.array([[4,5,7],[4,7,6],[0,2,3],[0,3,1],[0,1,5],[0,5,4],[2,6,7],[2,7,3],[0,4,6],[0,6,2],[1,3,7],[1,7,5]])
 uv=[]
 for vertex in verts:uv.append((vertex[0]*5+shade*.173,vertex[1]*1.3+shade*.221))
 return attach(verts,faces,uv,matid,label)

def cylinder(label,start,end,radius,matid=2,sides=12):
 a=np.asarray(start,dtype=float);b=np.asarray(end,dtype=float)
 direction=b-a;length=np.linalg.norm(direction)
 if length<1e-7:return
 axis=direction/length; side=np.cross(axis,[0,0,1])
 if np.linalg.norm(side)<.01:side=np.cross(axis,[0,1,0])
 side/=np.linalg.norm(side);up=np.cross(side,axis)
 verts=[];uv=[];faces=[]
 for step in range(2):
  for n in range(sides+1):
   t=2*np.pi*n/sides
   point=a+direction*step+radius*(side*np.cos(t)+up*np.sin(t))
   verts.append(point);uv.append((n/sides,step))
 for k in range(sides):
  i=k;j=k+sides+1
  faces.extend([[i,i+1,j+1],[i,j+1,j]])
 # little end circles
 for endarr in [a,b]:
  ci=len(verts);verts.append(endarr);uv.append((.5,.5))
  for k in range(sides):
   v0=(0 if ci==2*(sides+1) else sides+1)+k
   faces.append([ci,v0,v0+1])
 attach(verts,faces,uv,matid,label)

def tube_curve(label,pts,radius,matid=2,sides=9):
 verts=[];uv=[];faces=[]
 for i,P in enumerate(pts):
  c=np.asarray(P,dtype=float)
  front=np.asarray(pts[min(len(pts)-1,i+1)],float)-np.asarray(pts[max(0,i-1)],float)
  front/=max(1e-6,np.linalg.norm(front))
  sid=np.cross(front,[0,0,1]);sid/=max(np.linalg.norm(sid),1e-6)
  up=np.cross(sid,front)
  for j in range(sides):
   a=2*math.pi*j/sides
   verts.append(c+radius*(sid*np.cos(a)+up*np.sin(a)))
   uv.append((j/sides,i/max(1,len(pts)-1)))
 for i in range(len(pts)-1):
  for j in range(sides):
   aa=i*sides+j;bb=i*sides+(j+1)%sides;cc=(i+1)*sides+j;dd=(i+1)*sides+(j+1)%sides
   faces.extend([[aa,bb,dd],[aa,dd,cc]])
 attach(verts,faces,uv,matid,label)

def metal_plate(label,c,width,height,depth,seed=0):
 # softened/chipped rectangle: 8 perimeter corners with little hammered imbalance
 cx,cy,cz=c;w=width/2;h=height/2;z=cz+depth/2
 path=[(-w+.005,-h),(w-.004,-h),(w,-h+.004),(w,h-.006),(w-.004,h),(-w+.005,h),(-w,h-.004),(-w,-h+.004)]
 v=[[cx+x,cy+y,z] for x,y in path]+[[cx,cy,z]]
 f=[[8,i,(i+1)%8] for i in range(8)]
 uv=[(.5+x*6,.5+y*4) for x,y in path]+[(.5,.5)]
 attach(v,f,uv,2,label)
 # width/height also given substantial cast thickness
 for i in range(8):
  x0,y0=path[i];x1,y1=path[(i+1)%8];s=len(v)
  v.extend([[cx+x0,cy+y0,z],[cx+x1,cy+y1,z],[cx+x1,cy+y1,cz-depth/2],[cx+x0,cy+y0,cz-depth/2]])
  uv.extend([(0,0),(1,0),(1,1),(0,1)]);f.extend([[s,s+1,s+2],[s,s+2,s+3]])
 # geometry already attached above; side shell in own attach to avoid in-place arrays mismatch
 vv=[];ff=[];uu=[]
 for i in range(8):
  x0,y0=path[i];x1,y1=path[(i+1)%8];s=len(vv)
  vv.extend([[cx+x0,cy+y0,z],[cx+x1,cy+y1,z],[cx+x1,cy+y1,cz-depth/2],[cx+x0,cy+y0,cz-depth/2]])
  uu.extend([(0,0),(1,0),(1,1),(0,1)]);ff.extend([[s,s+1,s+2],[s,s+2,s+3]])
 attach(vv,ff,uu,2,label+'_rim')

def bolt(label,x,y,z,rad=.0053,slotted=True):
 cylinder(label,[x,y,z-.004],[x,y,z+.003],rad,3,sides=16)
 if slotted:
  # little dark groove in screwhead
  panel(label+'_slot',[x,y,z+.0038],[rad*1.33,.0012,.0005],2)

# Complete 500 x 1000 mm construction. Face +Z; all hinge plates sit on the
# SAME z-plane and both steel hinge barrels share the same X,Z shaft coordinates.
# All dimensions are METERS, no artificial enlargement during installation.
FRAME_HALF_X=.25; FRAME_HALF_Y=.5
FRAME_FRONT=.055
HINGE_AXIS_X=.199
HINGE_AXIS_Z=.066
HINGE_HEIGHTS=(.324,-.320)
HINGE_SHAFTS=[]

# Actual outer frame exactly fills the slot. Cross members genuinely overlap
# the jambs at hidden shoulder tenons: no light leak at corners/top/bottom.
wood_beam('01 outer left jamb',[-.221,0,-.005],.972,.058,.120,'Y',1,chamfer=.0040)
wood_beam('02 outer right jamb',[.221,0,-.005],.972,.058,.120,'Y',2,chamfer=.0042)
wood_beam('03 continuous head',[0,.470,-.005],.500,.060,.120,'X',3,chamfer=.004)
wood_beam('04 full-width weathered sill',[0,-.464,-.005],.500,.072,.120,'X',4,chamfer=.005)

# Sightline of opening: x=[-.192,.192], y=[-.428,.440]. Sash fitted into
# a real stepped frame. Front of BOTH box and sash is +0.055m.
SASH_STILE_X=.168
SASH_Y=.006
SASH_FRONT=.055
wood_beam('05 sash left stile',[-SASH_STILE_X,SASH_Y,.023],.846,.048,.064,'Y',5,chamfer=.0030)
wood_beam('06 sash right stile',[SASH_STILE_X,SASH_Y,.023],.846,.048,.064,'Y',6,chamfer=.0030)
wood_beam('07 sash head',[0,.416,.023],.386,.048,.064,'X',7,chamfer=.0030)
wood_beam('08 sash foot',[0,-.402,.023],.386,.054,.064,'X',8,chamfer=.0030)

# Continuous true muntins and retaining strips; the window has FOUR real
# separate small antique glass panels, seated 12-24mm behind their glazing lip.
wood_beam('09 vertical muntin',[0,.003,.026],.785,.020,.041,'Y',9,chamfer=.0017)
wood_beam('10 horizontal muntin',[0,.002,.026],.346,.025,.040,'X',10,chamfer=.0017)
for side in (-1,1):
 for level in (-1,1):
  px=side*.082
  py=level*.197+.004
  panel(f'11 glass pane x{side} y{level}',[px,py,.003],[.141,.370,.0026],4,side*level)
  # Front and back rebates: these actively overlap the pane by 3 mm.
  for front in (.040,-.015):
   for xedge in (side*.0105,side*.1535):
    wood_beam(f'12 beaded vertical rebate {side} {level}',[xedge,py,front],.375,.008,.006,'Y',40+side+level+int(front*1000),chamfer=.001)
   for yedge in (py-.184,py+.184):
    wood_beam(f'13 horizontal glazing bead {side} {level}',[px,yedge,front],.150,.008,.006,'X',70+side+level+int(front*1000),chamfer=.001)

# Visible tenon pegs at carpentry joints: penetrate BOTH visible timber faces.
for xi in (-.222,.222):
 for yi in (-.469,.468):
  cylinder('14 dowel end',[xi,yi,.054],[xi,yi,.056],.0044,1,sides=12)
for xi in (-.168,.168):
 for yi in (-.411,.414):
  cylinder('15 mortise peg',[xi,yi,.054],[xi,yi,.056],.0033,1,sides=11)

# Two functional hinges. Leaf A is fixed to sash x=.156..191, leaf B to
# frame x=.208..244; all metal base plates contact FRONT_Z=.055m, never float.
# Alternating hinge knuckles are attached with overlapping forged steel straps.
for k,hy in enumerate(HINGE_HEIGHTS):
    metal_plate(f'16 hinge moving sash leaf {k}',[.170,hy,.059],.036,.106,.008,k)
    metal_plate(f'17 hinge fixed jamb leaf {k}',[.223,hy,.059],.040,.106,.008,k)
    # Hinge pin shaft continues through all three sleeve segments.
    lo=hy-.061; hi=hy+.061
    cylinder(f'18 single forged hinge pin {k}',[HINGE_AXIS_X,lo,HINGE_AXIS_Z],
             [HINGE_AXIS_X,hi,HINGE_AXIS_Z],.004,2,14)
    for z0,z1,leafx,which in [(-.052,-.018,.214,'fixed lower'),
                              (-.018,.018,.182,'moving middle'),
                              (.018,.052,.214,'fixed upper')]:
        cy=hy+(z0+z1)*.5
        cylinder(f'19 hinge knuckle {k} {which}',[HINGE_AXIS_X,hy+z0,HINGE_AXIS_Z],
                 [HINGE_AXIS_X,hy+z1,HINGE_AXIS_Z],.0073,2,18)
        # Continuous forged throat connecting the knuckle with its plate.
        cylinder(f'20 forge neck {k} {which}',[leafx,cy,.062],[HINGE_AXIS_X,cy,HINGE_AXIS_Z],.0039,2,10)
    for yy in (-.032,.032):
        bolt(f'21 moving leaf rivet {k}',.168,hy+yy,.0638,.0048)
        bolt(f'22 fixed leaf rivet {k}',.230,hy+yy,.0638,.0048)
    HINGE_SHAFTS.append((HINGE_AXIS_X,HINGE_AXIS_Z,lo,hi))

# Handle is attached to the sash face. A shallow escutcheon and both ends of
# the grip have direct metal-to-metal and metal-to-wood contact.
HANDLE_X=-.169
for y in (-.078,.078):
 metal_plate(f'23 handle escutcheon {y:.3f}',[HANDLE_X,y,.059],.022,.043,.008)
 bolt(f'24 handle rivet {y:.3f}',HANDLE_X,y,.064,.0045)
 cylinder('25 handle end collar',[HANDLE_X,y,.064],[HANDLE_X,y,.080],.008,2,14)
handle=[]
for i in range(27):
 t=i/26;y=-.078+t*.156
 z=.079+.031*math.sin(math.pi*t)
 x=HANDLE_X-.013*math.sin(math.pi*t)
 handle.append((x,y,z))
tube_curve('26 swept old wrought iron pull',handle,.0067,2,13)
# Subtle pressed-steel latch seated in the timber, not floating beside frame.
metal_plate('27 latch catch',[.168,-.052,.059],.018,.046,.008)
bolt('28 latch rivet',.168,-.052,.0639,.0043)

# Fine age cracks are recessed visually and follow the grain of the timber.
# Avoid random chunky split tubes that previously appeared detached from wood.
cracks=[(-.231,-.280,.055,.041),(-.224,.235,.055,.043),(.223,.151,.055,.041),(.114,.468,.055,.030),(-.095,-.463,.055,.035)]
for i,(bx,by,bz,long) in enumerate(cracks):
 points=[]
 for j in range(15):
  t=j/14-.5
  points.append((bx+.0003*np.sin(17*t+i),by+t*long,bz+.00025*np.sin(9*t)))
 tube_curve(f'29 hairline fissure {i}',points,.00024,5,5)

# Unit invariants: real seams and hardware alignment, not just good appearance.
assert all(abs(x[0]-HINGE_SHAFTS[0][0])<1e-9 and abs(x[1]-HINGE_SHAFTS[0][1])<1e-9 for x in HINGE_SHAFTS)
assert len(HINGE_SHAFTS)==2
assert abs((.470+.060/2)-.500)<1e-9
assert abs((-.464-.072/2)+.500)<1e-9
assert abs((.221+.058/2)-.250)<1e-9
assert abs((-.221-.058/2)+.250)<1e-9

# Group into compact material meshes. Triangles come from actual 3D geometry.
scene=trimesh.Scene(base_frame='world')
for matid,submeshes in parts.items():
 if not submeshes:continue
 merged=trimesh.util.concatenate(submeshes)
 merged.visual.material=materials[matid]
 scene.add_geometry(merged,geom_name=f'{matid}_{materials[matid].name.replace(" ","_")}',node_name=f'material_group_{matid}')
GLB=R/'AlanTil-wooden-window-preview-v2.glb';scene.export(GLB)
assert abs(scene.bounds[0][0]+.25)<.001, scene.bounds
assert abs(scene.bounds[1][0]-.25)<.001, scene.bounds
assert abs(scene.bounds[0][1]+.5)<.001, scene.bounds
assert abs(scene.bounds[1][1]-.5)<.001, scene.bounds
# Build browser-native triangle arrays with explicit per material tangents estimated in JS shader.
groups=[]
for matid,meshes in parts.items():
 if not meshes:continue
 # vertex layout xyz, normals xyz, uv, custom rgb variation in diffuse offset
 pos=[];norm=[];uv=[]
 for mesh in meshes:
  vv=mesh.vertices.astype('float32');uvs=mesh.visual.uv.astype('float32')
  idx=mesh.faces.reshape(-1); pp=vv[idx];tx=uvs[idx];
  # calculate per-face cross normal for correctly sharp modeling (bevel faces)
  q=pp.reshape(-1,3,3)
  nn=np.cross(q[:,1,:]-q[:,0,:],q[:,2,:]-q[:,0,:])
  nn/=np.maximum(np.linalg.norm(nn,axis=1,keepdims=True),1e-7)
  normal=np.repeat(nn,3,axis=0)
  pos.append(pp);norm.append(normal);uv.append(tx)
 p=np.concatenate(pos);n=np.concatenate(norm);t=np.concatenate(uv)
 arr=np.hstack([p,n,t]).astype('float32')
 packed=zlib.compress(arr.tobytes(),9)
 # Do not use compression in HTML to avoid relying on DecompressionStream from file://.
 groups.append(dict(mat=matid,count=len(p),stride=8,buffer=base64.b64encode(arr.tobytes()).decode('ascii')))
print('WINDOW_MODEL_OK',GLB.stat().st_size,scene.bounds,'named components',len(named),'triangles',sum(n for _,n in named))
print('MATERIAL_TRI_COUNTS',[(i,sum(len(m.faces) for m in ms)) for i,ms in parts.items()]);print('UNCOMPRESSED_PAYLOAD_MIB',round(sum(g['count']*32 for g in groups)/2**20,2))
(R/'scene.json').write_text(json.dumps({'groups':groups,'meshes':named,'width_m':W,'height_m':H},separators=(',',':')))