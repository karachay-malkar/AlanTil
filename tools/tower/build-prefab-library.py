#!/usr/bin/env python3
"""Offline asset compiler for AlanTil tower. Never imported by browser/runtime.

Input: the 36 original user-provided authored meshes in fbx.glb.
Output: 20 fixed, reproducible GLB section meshes and three pre-authored seam meshes.
There is no procedural primitive generation: every triangle is from an original
rock mesh; transforms and pre-baked rubble are chosen only at build time.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import trimesh

SIZES = [(1, 1, 1), (2, 2, 2), (2, 2, 3), (2, 3, 4), (4, 4, 4)]
CELL = .25
PALETTE = np.array([[133, 129, 113, 255], [145, 136, 123, 255], [121, 125, 119, 255],
                    [155, 146, 129, 255], [126, 129, 122, 255], [150, 139, 119, 255]], dtype=np.uint8)


def normalized_rocks(source):
    scene = trimesh.load(source, force='scene', process=False)
    # trimesh scene.geometry is already in original Rock001..Rock036 order.
    meshes = list(scene.geometry.values())
    if len(meshes) != 36:
        raise ValueError(f'Expected 36 original authored meshes, got {len(meshes)}')
    models = []
    for m in meshes:
        mesh = m.copy()
        mesh.merge_vertices(merge_tex=True, merge_norm=True, digits_vertex=4)
        if not mesh.is_watertight:
            raise ValueError('Authored rock failed watertight verification after vertex weld')
        verts = mesh.vertices.copy()
        # Source files are Z-up, and each stone was stored in a separated gallery.
        verts = verts[:, [0, 2, 1]]
        center = (verts.max(axis=0) + verts.min(axis=0)) / 2
        dimensions = np.maximum(verts.max(axis=0) - verts.min(axis=0), 1e-4)
        verts = (verts - center) / dimensions
        # Axis swap flips winding. Material side and normal must agree.
        faces = mesh.faces[:, [0, 2, 1]].copy()
        models.append((verts, faces))
    return models


def partition(length, pieces, rng):
    if pieces == 1:
        return [0., length]
    weights = np.array([rng.uniform(.85, 1.15) for _ in range(pieces)])
    weights = length * weights / weights.sum()
    return [0., *np.cumsum(weights).tolist()[:-1], length]


def make_mesh(model, size, center, colour, scale=1.0):
    verts, faces = model
    result = trimesh.Trimesh(vertices=verts * np.array(size) * scale + np.array(center), faces=faces, process=False)
    result.visual.vertex_colors = np.repeat(np.asarray(colour, dtype=np.uint8)[None, :], len(result.vertices), axis=0)
    return result


def make_section(models, size, variant):
    seed = int(hashlib.sha256(f'AlanTil-prefab-v1:{size}:{variant}'.encode()).hexdigest()[:12], 16)
    rng = np.random.default_rng(seed)
    box = np.array(size) * CELL
    parts, source_ids = [], []
    # The free-form authored rocks, not cuboids, are the entire final mesh.
    layers = max(1, size[1] // 1)
    ycuts = partition(box[1], layers, rng)
    for row in range(layers):
        ymin, ymax = ycuts[row], ycuts[row + 1]
        # Stagger every course without generating geometry at runtime.
        xc = max(1, int(round(box[0] / (0.24 if row % 2 else .32))))
        zc = max(1, int(round(box[2] / (0.27 if row % 2 else .33))))
        xcuts = partition(box[0], xc, rng)
        zcuts = partition(box[2], zc, rng)
        for ix in range(xc):
            for iz in range(zc):
                x0,x1=xcuts[ix:ix+2];z0,z1=zcuts[iz:iz+2]
                dims=np.array([x1-x0,ymax-ymin,z1-z0])
                ratio=max(dims)/min(dims)
                if max(size)<=1: model_id=20+int(rng.integers(0,10))
                elif max(dims)>.30 and ratio<2.0: model_id=30+int(rng.integers(0,6))
                elif ratio>2.0: model_id=int(rng.integers(0,20))
                else: model_id=int(rng.integers(0,36))
                center=np.array([(x0+x1)/2,(ymin+ymax)/2,(z0+z1)/2])-box/2
                # Keep source jagged surfaces; very slight overlaps bridge open gaps.
                dims=dims * 1.034
                col=PALETTE[int(rng.integers(0,len(PALETTE)))].copy()
                parts.append(make_mesh(models[model_id], dims, center, col))
                source_ids.append(model_id+1)
        # Pre-bake actual small natural stones in the visible residual seams.
        if xc>1 and box[2]>.26:
            for x in xcuts[1:-1]:
                for side in [-1,1]:
                    for p in range(max(1,int(box[2]/.18))):
                        z=(p+.5)*box[2]/max(1,int(box[2]/.18))
                        sy=max(.07,min(.12,(ymax-ymin)*.49))
                        pos=np.array([x,(ymin+ymax)/2+(rng.random()-.5)*.05,box[2]/2+side*.005+(z-box[2]/2)])
                        # Seam pebbles stay just inside the exterior skin.
                        pos[2]=(.025 if side<0 else box[2]-.025)
                        model_id=20+int(rng.integers(0,10))
                        parts.append(make_mesh(models[model_id],[.09,sy,.065],pos-box/2,
                                               PALETTE[int(rng.integers(0,len(PALETTE)))],.99))
                        source_ids.append(model_id+1)
    result=trimesh.util.concatenate(parts)
    result.metadata['name']=f'{size[0]}x{size[1]}x{size[2]}-v{variant}'
    return result,source_ids,len(parts)


def make_seam(models, axis):
    """Unit-length prepared join; runtime may position/scale as one static object."""
    seed={'x':1283,'y':3371,'z':2999}[axis]
    rng=np.random.default_rng(seed)
    rocks=[]
    for j in range(8):
        u=((j%4)+.5)/4-.5;v=((j//4)+.5)/2-.5
        # Connections are sparse natural chinking: no structural artificial fillers.
        if axis=='x':p=[0,u,v]
        elif axis=='y':p=[u,0,v]
        else:p=[u,v,0]
        dims=[.085,.24,.30] if axis=='x' else ([.23,.07,.27] if axis=='y' else [.24,.28,.075])
        rocks.append(make_mesh(models[20+int(rng.integers(0,10))],dims,p,PALETTE[int(rng.integers(0,len(PALETTE)))],.96))
    return trimesh.util.concatenate(rocks)


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--source',default='assets/tower/source-original-36.glb')
    p.add_argument('--output',default='assets/tower/prefabs')
    a=p.parse_args()
    src=Path(a.source);out=Path(a.output);out.mkdir(parents=True,exist_ok=True)
    models=normalized_rocks(src)
    manifest={'version':'17.4.0','cellMeters':CELL,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),
              'authoredModels':len(models),'types':[],'connectors':{}}
    for dims in SIZES:
        key='x'.join(map(str,dims));variants=[]
        for variant in range(4):
            geometry,ids,count=make_section(models,dims,variant)
            filename=f'section-{key}-v{variant}.glb'
            geometry.export(out/filename,file_type='glb')
            variants.append({'file':'/assets/tower/prefabs/'+filename,'rocks':count,
                             'sourceModels':sorted(set(ids)),
                             'faces':len(geometry.faces)})
        manifest['types'].append({'id':key,'size':list(dims),'variants':variants,'priceSilver':None})
    for axis in 'xyz':
        filename=f'joint-{axis}.glb';seam=make_seam(models,axis);seam.export(out/filename,file_type='glb')
        manifest['connectors'][axis]={'file':'/assets/tower/prefabs/'+filename,'faces':len(seam.faces)}
    (out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Built {sum(len(x["variants"]) for x in manifest["types"])} fixed section meshes and 3 connectors; all from {len(models)} original authored models.')
    print('Total geometry bytes:',sum(p.stat().st_size for p in out.glob('*.glb')))


if __name__=='__main__':main()
