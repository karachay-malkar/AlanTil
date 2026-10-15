#!/usr/bin/env python3
"""Convert supplied CC0 rock_face_02 Blender UV atlas to a non-repeating mobile PBR surface.

The source is a UV atlas of a photogrammetry rock, NOT a repeatable wall texture.
Deterministically quilt small photographed atlas regions with feathered overlaps and
wrap-around. This suppresses entire repeated 'picture' motifs on thousands of stones.
No geometry is generated. Output is color/GL normal/roughness derived from the source.
"""
import os
from pathlib import Path
import numpy as np
from PIL import Image
import cv2
os.environ['OPENCV_IO_ENABLE_OPENEXR']='1'
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(os.environ.get('ALANTIL_ROCK_FACE_SOURCE',str(ROOT/'assets/tower/source-materials/rock_face_02')))
OUT=ROOT/'assets/tower/materials/rock-face-02'
OUT.mkdir(parents=True,exist_ok=True)
D=np.asarray(Image.open(SOURCE/'rock_face_02_diff_1k.jpg').convert('RGB')).astype(np.float32)
N=cv2.imread(str(SOURCE/'rock_face_02_nor_gl_1k.exr'),cv2.IMREAD_UNCHANGED)
R=cv2.imread(str(SOURCE/'rock_face_02_rough_1k.exr'),cv2.IMREAD_UNCHANGED)
if N is None or R is None:raise RuntimeError('Missing Rock Face 02 EXR PBR maps')
N=N[...,::-1].astype(np.float32) # cv2 BGR -> RGB
R=np.clip(R,0,1)
SIZE=768
step=32;tile=64
rng=np.random.default_rng(17602)
grid=np.arange(tile,dtype=np.float32)
window=np.maximum(.00001,np.sin(np.pi*(grid+.5)/tile)**.9)
weight=np.outer(window,window)
acc=np.zeros((SIZE,SIZE,7),np.float32)
w=np.zeros((SIZE,SIZE),np.float32)
# Reject the photogrammetry UV atlas's striped empty triangles and dark holes.
# Work only with uniform rock-face areas. This is source-derived photography;
# no generated stone shapes or synthetic printed symbols are introduced.
valid=[]
for sy in range(0,1024-tile+1,12):
 for sx in range(0,1024-tile+1,12):
  patch=D[sy:sy+tile,sx:sx+tile]
  grey=(np.abs(patch[:,:,0]-patch[:,:,1])<28)&(np.abs(patch[:,:,1]-patch[:,:,2])<40)
  if grey.mean()>.93 and (patch.mean(axis=2)<32).mean()<.001:
   valid.append((sx,sy))
assert len(valid)>200,'Rock Face 02 source lacks enough unbroken photographic patches'
for y in range(0,SIZE,step):
 for x in range(0,SIZE,step):
  x0,y0=valid[int(rng.integers(0,len(valid)))];
  d=D[y0:y0+tile,x0:x0+tile]
  n=N[y0:y0+tile,x0:x0+tile]
  r=R[y0:y0+tile,x0:x0+tile,None]
  # Dark slate colour, retain photographed rock luminance and a little green moss.
  lum=np.dot(d,[.28,.58,.14]);base=np.stack((lum*.63+18,lum*.65+20,lum*.68+25),axis=-1)
  moss=np.clip((d[:,:,1]-d[:,:,0]*.9)/36,0,1)*np.clip((d[:,:,1]-d[:,:,2]*.75)/24,0,1)
  moss=cv2.GaussianBlur(moss.astype(np.float32),(5,5),0)[:,:,None]
  rock=base*(1-moss*.34)+np.array([58,77,38],np.float32)*moss*.34
  rock=np.clip(rock,23,153)
  packed=np.concatenate((rock,n,r),axis=2)
  yy=(np.arange(tile)+y)%SIZE;xx=(np.arange(tile)+x)%SIZE
  acc[np.ix_(yy,xx)]+=packed*weight[:,:,None];w[np.ix_(yy,xx)]+=weight
result=acc/(w[:,:,None]+1e-7)
colour=np.uint8(np.clip(result[:,:,:3],0,255))
normal=result[:,:,3:6];normal=(normal-.5)*.58+.5
normal[:,:,2]=np.maximum(normal[:,:,2],.82)
normal=np.uint8(np.clip(normal*255,0,255))
rough=np.uint8(np.clip(result[:,:,6],.73,.99)*255)
Image.fromarray(colour).save(OUT/'rock-face-02-colour.jpg',quality=88,optimize=True)
Image.fromarray(normal).save(OUT/'rock-face-02-normal.jpg',quality=88,optimize=True)
Image.fromarray(rough).save(OUT/'rock-face-02-roughness.jpg',quality=87,optimize=True)
print('Rock Face 02 atlas quilted:',[(p.name,p.stat().st_size) for p in OUT.iterdir() if p.is_file()])
