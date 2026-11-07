"""Bake genuine source-colour atlases and simplified GLB casts before runtime.

Blender 4.x: blender -b --python tools/tower/bake-kunlum-lod-atlases.py
Requires Pillow, the official Khronos toktx CLI and the approved source PBR.
Never edits the approved casts, user placement data, or the Common100 library.
"""
import bpy
import json
import math
from pathlib import Path
import subprocess
from PIL import Image, ImageFilter, ImageStat
import numpy as np
from mathutils.bvhtree import BVHTree

ROOT = Path.cwd()
SOURCE = ROOT / 'assets/tower/approved-library/casts'
OUTPUT = ROOT / 'assets/tower/approved-library/lod-baked'
COLOR = ROOT / 'assets/tower/materials/balkaria-stone-v2.1/BalkariaStone_BaseColor_2K.png'
CASTS = ('section-2x2x2-v3', 'section-3x3x3-v2')
LEVELS = ((1, 0.44, 1024, .35), (2, .13, 512, 1.3), (3, .035, 256, 2.2))
MAGIC = bytes.fromhex('ab4b5458203230bb0d0a1a0a')
manifest = {'version': 1, 'material': 'BalkariaStone_BaseColor_2K.png',
            'levels': {}, 'source': 'approved-library/casts',
            'towerSource': 'approved-library/lod-review/models.json', 'files': {}}
assert COLOR.is_file()
OUTPUT.mkdir(parents=True, exist_ok=True)

def bounds(obj):
    return [(min(v.co[i] for v in obj.data.vertices),
             max(v.co[i] for v in obj.data.vertices)) for i in range(3)]

def exact_bounds(obj, original):
    changed = bounds(obj)
    for axis, ((want_lo, want_hi), (got_lo, got_hi)) in enumerate(zip(original, changed)):
        if got_hi - got_lo < 1e-7:
            raise ValueError('Decimation collapsed an axis')
        for vert in obj.data.vertices:
            vert.co[axis] = want_lo + (vert.co[axis] - got_lo) * (
                (want_hi - want_lo) / (got_hi - got_lo))
    obj.data.update()

def barycentric(p, a, b, c):
    u = b - a
    v = c - a
    w = p - a
    uu, uv, vv = u.dot(u), u.dot(v), v.dot(v)
    wu, wv = w.dot(u), w.dot(v)
    den = uu * vv - uv * uv
    if abs(den) < 1e-12:
        return None
    s = (wu * vv - wv * uv) / den
    t = (wv * uu - wu * uv) / den
    return (1 - s - t, s, t)


def rasterize_source_colour(high, low, size, blur, png):
    """Project each low-mesh UV texel onto the actual approved high mesh.

    Blender Cycles selected-to-active silently returned a flat generated colour
    on these tightly overlapping casts. Nearest-surface BVH sampling makes the
    transfer deterministic and checks that genuine source pixels are used.
    """
    high.data.calc_loop_triangles()
    low.data.calc_loop_triangles()
    uvsrc = high.data.uv_layers.active.data
    uvdst = low.data.uv_layers.active.data
    bvh = BVHTree.FromObject(high, bpy.context.evaluated_depsgraph_get())
    original = Image.open(COLOR).convert('RGB')
    source = original.load()
    sw, sh = original.size
    avg = tuple(int(x) for x in ImageStat.Stat(original.resize((16, 16))).mean)
    n = min(size, 512)
    output = Image.new('RGB', (n, n), avg)
    pixels = output.load()
    mask = np.zeros((n, n), dtype=np.bool_)
    hits = 0
    for tri in low.data.loop_triangles:
        corners = [low.data.vertices[i].co for i in tri.vertices]
        uv = [uvdst[i].uv for i in tri.loops]
        xy = [(p.x * n, (1-p.y) * n) for p in uv]
        x0 = max(0, int(min(p[0] for p in xy)))
        x1 = min(n-1, int(max(p[0] for p in xy)+1))
        y0 = max(0, int(min(p[1] for p in xy)))
        y1 = min(n-1, int(max(p[1] for p in xy)+1))
        ax, ay = xy[0]
        bx, by = xy[1]
        cx, cy = xy[2]
        det = (by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
        if abs(det) < 1e-8:
            continue
        for y in range(y0, y1+1):
            for x in range(x0, x1+1):
                px, py = x+.5, y+.5
                w0 = ((by-cy)*(px-cx)+(cx-bx)*(py-cy))/det
                w1 = ((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/det
                w2 = 1-w0-w1
                if min(w0,w1,w2) < -1e-5:
                    continue
                point = corners[0]*w0 + corners[1]*w1 + corners[2]*w2
                nearest, normal, face_id, distance = bvh.find_nearest(point, .65)
                if nearest is None:
                    continue
                poly = high.data.polygons[face_id]
                if len(poly.vertices) != 3:
                    continue
                a,b,c = [high.data.vertices[i].co for i in poly.vertices]
                weights = barycentric(nearest, a,b,c)
                if weights is None:
                    continue
                uv_values=[uvsrc[i].uv for i in poly.loop_indices]
                u=sum(weights[i]*uv_values[i].x for i in range(3))
                v=sum(weights[i]*uv_values[i].y for i in range(3))
                rgb=source[int(u*sw)%sw, int((1-v)*sh)%sh]
                pixels[x,y]=rgb
                mask[y,x]=True
                hits+=1
    if hits < n*n*.08:
        raise RuntimeError(f'No source-colour UV transfer: {png} hits={hits}')
    # Dilate UV-island colours into their safety margin to stop mip bleeding.
    arr=np.array(output)
    for _ in range(8):
        missing=~mask
        if not missing.any():
            break
        for direction,shift in [(0,1),(0,-1),(1,1),(1,-1)]:
            shifted_mask=np.roll(mask,shift,axis=direction)
            found=missing & shifted_mask
            if not found.any():
                continue
            arr[found]=np.roll(arr,shift,axis=direction)[found]
            mask[found]=True
            missing[found]=False
    output=Image.fromarray(arr)
    if n!=size:
        output=output.resize((size,size),Image.Resampling.LANCZOS)
    if blur:
        output=output.filter(ImageFilter.GaussianBlur(blur))
    output.save(png,optimize=True)
    stat=ImageStat.Stat(output)
    deviation=max(stat.stddev)
    unique=len(output.getcolors(maxcolors=1000) or range(1001))
    if deviation<3 or unique<64:
        raise RuntimeError(f'Flat prebaked atlas: {png}: stddev={deviation}, colors={unique}')
    return round(deviation,3),unique


def select(*objects, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[-1]

def load_baked_tower_source():
    """Use the existing approved 3D shell and real doorway/window geometry."""
    file=ROOT/'assets/tower/approved-library/lod-review/models.json'
    raw=json.loads(file.read_text(encoding='utf-8'))['tower']
    verts=[tuple(raw[i:i+3]) for i in range(0,len(raw),3)]
    tris=[(i,i+1,i+2) for i in range(0,len(verts),3)]
    geo=bpy.data.meshes.new('Abay-Kala authored shell')
    geo.from_pydata(verts,[],tris)
    geo.update()
    ob=bpy.data.objects.new('abay-kala',geo)
    bpy.context.collection.objects.link(ob)
    import bmesh
    bm=bmesh.new()
    bm.from_mesh(geo)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5)
    bm.to_mesh(geo)
    bm.free()
    geo.update()
    uv=geo.uv_layers.new(name='BalkariaStone world-scale UV')
    for face in geo.polygons:
        normal=face.normal
        ax=abs(normal.x)
        ay=abs(normal.y)
        az=abs(normal.z)
        axis=0 if ax>=ay and ax>=az else 1 if ay>=az else 2
        for index in face.loop_indices:
            co=geo.vertices[geo.loops[index].vertex_index].co
            uv.data[index].uv=((co.z if axis==0 else co.x)*3.15,
                               (co.z if axis==1 else co.y)*3.15)
    return ob


def validate_tower_openings(mesh, level):
    bvh=BVHTree.FromObject(mesh,bpy.context.evaluated_depsgraph_get())
    from mathutils import Vector
    for y in (1.25,6.0,10.1):
        hit,normal,face,distance=bvh.ray_cast(Vector((0,y,8)),
                                             Vector((0,0,-1)),8.0)
        if hit is not None:
            raise RuntimeError(f'Abay-Kala LOD {level} seals doorway/window at {y}m')


def bake_one(name, level, ratio, size, blur):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if name=='abay-kala':
        load_baked_tower_source()
        ratio={1:.78,2:.53,3:.30}[level]
    else:
        bpy.ops.import_scene.gltf(filepath=str(SOURCE / (name + '.glb')))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if len(meshes) != 1:
        raise RuntimeError(f'{name}: expected one cast mesh, got {len(meshes)}')
    high = meshes[0]
    if not high.data.uv_layers:
        raise RuntimeError(f'{name}: missing authored source UV')
    select(high)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    expected = bounds(high)
    faces = len(high.data.polygons)

    low = high.copy()
    low.data = high.data.copy()
    bpy.context.scene.collection.objects.link(low)
    low.name = f'{name}-lod{level}'
    select(low)
    modifier = low.modifiers.new('Prebaked LOD', 'DECIMATE')
    modifier.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    exact_bounds(low, expected)
    if name=='abay-kala':
        validate_tower_openings(low,level)
    select(low)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=.018)
    bpy.ops.object.mode_set(mode='OBJECT')

    folder = OUTPUT / f'lod{level}'
    folder.mkdir(parents=True, exist_ok=True)
    png = folder / f'{name}.png'
    deviation, unique = rasterize_source_colour(high,low,size,blur,png)
    low.data.materials.clear()

    select(low)
    glb = folder / f'{name}.glb'
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB',
                              export_materials='NONE', use_selection=True,
                              export_texcoords=True, export_normals=True)
    ktx = folder / f'{name}.ktx2'
    subprocess.run(['toktx', '--t2', '--genmipmap', '--encode', 'uastc',
                    '--assign_oetf', 'srgb', str(ktx), str(png)], check=True)
    with ktx.open('rb') as f:
        assert f.read(12) == MAGIC, f'invalid KTX2 file: {ktx}'
    with glb.open('rb') as f:
        assert f.read(4) == b'glTF', f'invalid GLB file: {glb}'
    count = len(low.data.polygons)
    if not (0 < count < faces * (.91 if name=='abay-kala' else .62)):
        raise RuntimeError(f'LOD budget not met: {name} {level}: {count}/{faces}')
    key = f'lod{level}/{name}'
    manifest['files'][key] = {'triangles': sum(len(p.vertices) - 2 for p in low.data.polygons),
                              'sourceFaces': faces, 'sourceBounds': expected,
                              'resolution': size, 'colorStdDev': deviation, 'uniqueColors': unique,
                              'glbBytes': glb.stat().st_size,
                              'ktx2Bytes': ktx.stat().st_size}
    print('BAKED', key, manifest['files'][key], flush=True)

for level, ratio, size, blur in LEVELS:
    manifest['levels'][str(level)] = {'ratio': ratio, 'resolution': size}
    for name in (*CASTS,'abay-kala'):
        bake_one(name, level, ratio, size, blur)

(OUTPUT / 'manifest.json').write_text(
    json.dumps(manifest, indent=2, sort_keys=True) + '\n', encoding='utf-8')
print('BAKE COMPLETE', len(manifest['files']), 'prefab LOD variants', flush=True)
