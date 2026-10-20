#!/usr/bin/env python3
"""Rebuild approved v7 gate into separate v9 test GLB, preserving all PBR assets.

- Exact rock boundaries of tower section (4.5 x 2.5 x 0.5 m).
- Wooden and forged components identical to current v8 game rendering.
- Edge chinking uses existing wild-rock meshes, never geometric cubes.
- Game prefab, 17.6-gate.1 and all saved tower blocks remain unchanged.
"""
import copy, json, math, struct
from collections import defaultdict
from pathlib import Path
import numpy as np

SRC=Path('assets/tower/prefabs/architectural/gate-18x10x2-v7.glb')
BASE=Path('gate-fit-review')
DST=BASE/'gate-18x10x2-v9-candidate.glb'
METRICS=BASE/'candidate-v9-metrics.json'
audit=json.loads((BASE/'audit-v8.json').read_text())
data=SRC.read_bytes()
assert data[:4]==b'glTF' and struct.unpack_from('<I',data,8)[0]==len(data)
chunks=[];offset=12
while offset<len(data):
 length,ctype=struct.unpack_from('<I4s',data,offset);offset+=8
 chunks.append([ctype,data[offset:offset+length]]);offset+=length
assert chunks[0][0]==b'JSON' and chunks[1][0]==b'BIN\x00'
doc=json.loads(chunks[0][1]);original_nodes=copy.deepcopy(doc['nodes'])
nodes=doc['nodes'];meshes=doc['meshes'];item_list=audit['allMeshes']
assert len(item_list)==594 and sum(item['kind']=='rock' for item in item_list)==486
assert len({item['node'] for item in item_list})==len(item_list),'Expected independent primitive nodes'
def local_matrix(n):
 if 'matrix' in n:return np.array(n['matrix'],dtype=float).reshape(4,4,order='F')
 t=n.get('translation',[0,0,0]);x,y,z,w=n.get('rotation',[0,0,0,1]);s=n.get('scale',[1,1,1])
 q=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
  [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
  [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 out=np.eye(4);out[:3,:3]=q@np.diag(s);out[:3,3]=t
 return out
parents={}
def children(parent):
 for child in original_nodes[parent].get('children',[]):
  assert child not in parents
  parents[child]=parent;children(child)
for root in doc['scenes'][doc.get('scene',0)]['nodes']:children(root)
world_cache={}
def world(idx):
 if idx not in world_cache:
  mat=local_matrix(original_nodes[idx])
  world_cache[idx]=world(parents[idx])@mat if idx in parents else mat
 return world_cache[idx]
def affine(sx=1,sy=1,sz=1,tx=0,ty=0,tz=0):
 m=np.eye(4);m[0,0]=sx;m[1,1]=sy;m[2,2]=sz
 m[:3,3]=[tx,ty,tz];return m
def set_world(idx,m):
 local=np.linalg.inv(world(parents[idx]))@m if idx in parents else m
 node=nodes[idx]
 for name in ['translation','rotation','scale']:node.pop(name,None)
 node['matrix']=[round(float(x),10) for x in local.flatten(order='F')]
def shift_item(item):
 x=np.array(item['gameMin']);y=np.array(item['gameMax'])
 return (x[0]/1.011,x[1]-audit['rawBottomShift'],x[2]),(y[0]/1.011,y[1]-audit['rawBottomShift'],y[2])
rock=[item for item in item_list if item['kind']=='rock']
xmin=min(shift_item(p)[0][0] for p in rock);xmax=max(shift_item(p)[1][0] for p in rock)
ymin=min(shift_item(p)[0][1] for p in rock);ymax=max(shift_item(p)[1][1] for p in rock)
zmin=min(shift_item(p)[0][2] for p in rock);zmax=max(shift_item(p)[1][2] for p in rock)
alphaL=1.25/(-xmin-1)
alphaR=1.25/(xmax-1)
beta=2.5/(ymax-ymin);zscale=.5/(zmax-zmin)
zshift=-.25-zscale*zmin
current_game_scale=1.011
# Local stone X=+/-1.0 interface is fixed: never stretch the clear 2 m aperture.
left=affine(sx=alphaL,sy=beta,sz=zscale,tx=alphaL-1,ty=ymin*(1-beta),tz=zshift)
right=affine(sx=alphaR,sy=beta,sz=zscale,tx=1-alphaR,ty=ymin*(1-beta),tz=zshift)
wood_current=affine(sx=current_game_scale)
assert alphaL>1 and alphaR>1 and beta>1 and zscale>1
for item in item_list:
 idx=item['node'];cur=world(idx)
 if item['kind']=='rock':
  middle=(item['gameMin'][0]+item['gameMax'][0])/2
  F=left if middle<0 else right
 elif item['kind'] in ('wood','iron'):
  F=wood_current
 else:
  F=np.eye(4)
 # Editor item #101 additionally scaled in local X in the previous approved v8.
 part_local_scale=affine(sx=1.011) if item['meshOrder']==101 else np.eye(4)
 set_world(idx,F@cur@part_local_scale)

def projected(item):
 a,b=shift_item(item)
 F=left if (a[0]+b[0])<0 else right
 lo=np.array(a);hi=np.array(b)
 # Affine is axis-monotonic positive. AABB endpoints are exact here.
 return tuple((F[:3,:3]@lo+F[:3,3]).tolist()),tuple((F[:3,:3]@hi+F[:3,3]).tolist())
bboxes=[{"node":item['node'],"meshOrder":item['meshOrder'],"name":item['name'],
  "lo":projected(item)[0],"hi":projected(item)[1]} for item in rock]
xlo=min(b['lo'][0] for b in bboxes);xhi=max(b['hi'][0] for b in bboxes)
ylo=min(b['lo'][1] for b in bboxes);yhi=max(b['hi'][1] for b in bboxes)
zlo=min(b['lo'][2] for b in bboxes);zhi=max(b['hi'][2] for b in bboxes)
assert abs(xlo+2.25)<.0001 and abs(xhi-2.25)<.0001,(xlo,xhi)
assert abs(ylo-ymin)<.0001 and abs(yhi-(ymin+2.5))<.0001,(ylo,yhi)
assert abs(zlo+.25)<.0001 and abs(zhi-.25)<.0001,(zlo,zhi)
assert all((b['hi'][0]<-1.0 or b['lo'][0]>1.0) for b in bboxes), 'Rock enters gate aperture'

# Fill edge recesses using original high-poly CHINKING source meshes from the
# gate. Each new stone is a real irregular stone with retained source PBR.
# A tile is filled only if an original supporting rock bbox overlaps its Y/Z footprint.
chinking=[item for item in rock if 'CHINKING' in item['name'] and item['vertices']>=100]
assert len(chinking)>70
NY,NZ=14,4
ysize=2.5/NY;zsize=.5/NZ
rubble=[];segments=0;covered_original=0;covered_after=0;unbacked=0
def fit_face(plus,cell_y,cell_z):
 boundary=2.25
 active=[b for b in bboxes if b['lo'][1]-.01<=cell_y<=b['hi'][1]+.01 and
         b['lo'][2]-.01<=cell_z<=b['hi'][2]+.01 and
         ((b['lo'][0]+b['hi'][0]>0) == plus)]
 if not active:return None
 return max(b['hi'][0] for b in active) if plus else min(b['lo'][0] for b in active)
for side in [-1,1]:
 for iy in range(NY):
  y0=ymin+iy*ysize;y1=ymin+(iy+1)*ysize
  yy=(y0+y1)/2
  for iz in range(NZ):
   z0=-.25+iz*zsize;z1=z0+zsize;zz=(z0+z1)/2
   contact=fit_face(side>0,yy,zz)
   if contact is None:unbacked+=1;continue
   gap=2.25-side*contact
   if gap<=.029:
    covered_original+=1;covered_after+=1;continue
   # The largest exposed recess may need multiple touching irregular stones.
   count=max(1,int(math.ceil((gap+.025)/.165)))
   # All rubble roots share world scene space; the original source mesh is
   # referenced rather than duplicated with procedural/cuboid geometry.
   inner=side*(2.25-gap-.020)
   outer=side*(2.25-.002)
   for k in range(count):
    f0=k/count;f1=(k+1)/count
    xa=inner+(outer-inner)*f0;xb=inner+(outer-inner)*f1
    xx0,xx1=sorted((xa,xb))
    xx0-=.011;xx1+=.011
    if side<0:xx0=max(-2.25,xx0)
    else:xx1=min(2.25,xx1)
    sy0=max(ymin,y0-.011);sy1=min(ymin+2.5,y1+.011)
    sz0=max(-.25,z0-.012);sz1=min(.25,z1+.012)
    selector=(iy*7919+iz*1543+(side+1)*119+k*1049)%len(chinking)
    source=chinking[selector]
    sa,sb=shift_item(source)
    # Small natural stones keep all vertices, UVs and original texture channels.
    # AABB fitting is just a local scale/translate on the source glTF mesh node.
    source_low=np.array(sa);source_high=np.array(sb)
    source_size=source_high-source_low
    assert np.all(source_size>.0001),source['name']
    target_lo=np.array([xx0,sy0,sz0]);target_hi=np.array([xx1,sy1,sz1])
    stretch=(target_hi-target_lo)/source_size
    # Avoid impossible paper-thin rock replicas.
    assert all(stretch>0)
    trans=target_lo-stretch*source_low
    F=affine(sx=stretch[0],sy=stretch[1],sz=stretch[2],
             tx=trans[0],ty=trans[1],tz=trans[2])
    source_node=original_nodes[source['node']]
    newworld=F@world(source['node'])
    obj={'name':f'V9_EDGE_{("RIGHT" if side>0 else "LEFT")}_Y{iy:02}_Z{iz:02}_{k}',
         'mesh':source_node['mesh'],
         'matrix':[round(float(v),10) for v in newworld.flatten(order='F')],
         'extras':{'alantil':'gate-v9-wild-chinking','side':side,'course':iy,'depth':iz}}
    doc['nodes'].append(obj)
    doc['scenes'][doc.get('scene',0)]['nodes'].append(len(doc['nodes'])-1)
    rubble.append({'name':obj['name'],'min':[round(x,6) for x in target_lo],
       'max':[round(x,6) for x in target_hi], 'source':source['name']})
    segments+=1
   covered_after+=1
# All original geometry, normals, UVs, glTF buffer and images are unchanged.
# Only mesh-node transforms are edited and the source chinking meshes are instanced.
meta=doc.setdefault('asset',{}).setdefault('extras',{})
meta['alantilGateCandidate']='v9-rock-boundary-fit-preview-only'
meta['logicalCells']=[18,10,2]
meta['sourceGLB']='gate-18x10x2-v7.glb'
meta['gameIntegration']=False
js=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode('utf-8')
js+=b' ' * ((4-len(js)%4)%4)
binary=chunks[1][1]
chunk_2=b''.join([struct.pack('<I4s',len(js),b'JSON'),js,
                   struct.pack('<I4s',len(binary),b'BIN\x00'),binary])
out=b'glTF'+struct.pack('<II',2,12+len(chunk_2))+chunk_2
assert out[:4]==b'glTF' and len(out)==struct.unpack_from('<I',out,8)[0]
DST.write_bytes(out)
total=NY*NZ*2
metrics={
 'variant':'gate-18x10x2-v9-candidate',
 'status':'preview-only; not integrated in tower game',
 'sourceGLB':str(SRC),
 'renderGLB':str(DST),
 'dimensionsMeters':[4.5,2.5,.5],
 'stoneBoundsSourceLocal':{'min':[round(xlo,6),round(ylo,6),round(zlo,6)],
  'max':[round(xhi,6),round(yhi,6),round(zhi,6)]},
 'gameBottomShift':round(-1.25-ymin,6),
 'rockTargetGameBounds':{'min':[-2.25,-1.25,-.25],'max':[2.25,1.25,.25]},
 'fit':{'leftPierScale':round(alphaL,6),'rightPierScale':round(alphaR,6),
  'verticalScale':round(beta,6),'depthScale':round(zscale,6),
  'openingWidthMeters':2,'existingWoodIronExactlyAsV8':True},
 'stones':{'originalRockMeshes':len(rock),'edgeRubbleInstances':len(rubble),
  'totalRockMeshes':len(rock)+len(rubble),'sourceStoneKind':'source GLB wild CHINKING'},
 'edgeProxy':{'tiles':total,'originalTilesWithin29mm':covered_original,
  'filledTiles':covered_after-covered_original,'unbackedTiles':unbacked,
  'coveredFraction':round(covered_after/total,6)},
 'outputBytes':len(out)
}
METRICS.write_text(json.dumps(metrics,ensure_ascii=False,indent=2)+'\n')
assert len(out)>5000000
assert metrics['edgeProxy']['coveredFraction']>.96,metrics['edgeProxy']
assert len(rubble)<1000
print(json.dumps(metrics,ensure_ascii=False,indent=2))
print('CANDIDATE_GATE_MODEL_CREATED',DST)
