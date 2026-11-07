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
from PIL import Image, ImageFilter

ROOT = Path.cwd()
SOURCE = ROOT / 'assets/tower/approved-library/casts'
OUTPUT = ROOT / 'assets/tower/approved-library/lod-baked'
COLOR = ROOT / 'assets/tower/materials/balkaria-stone-v2.1/BalkariaStone_BaseColor_2K.png'
CASTS = ('section-2x2x2-v3', 'section-3x3x3-v2')
LEVELS = ((1, 0.44, 1024, .35), (2, .13, 512, 1.3), (3, .035, 256, 2.2))
MAGIC = bytes.fromhex('ab4b5458203230bb0d0a1a0a')
manifest = {'version': 1, 'material': 'BalkariaStone_BaseColor_2K.png',
            'levels': {}, 'source': 'approved-library/casts', 'files': {}}
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

def shader_material(name, image, bake_target=False):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    tex = nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.extension = 'REPEAT' if not bake_target else 'CLIP'
    nodes.active = tex
    if not bake_target:
        bsdf = nodes.get('Principled BSDF')
        material.node_tree.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return material

def select(*objects, active=None):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = active or objects[-1]

def bake_one(name, level, ratio, size, blur):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.engine = 'CYCLES'
    bpy.context.scene.cycles.samples = 1
    bpy.context.scene.render.bake.margin = 12
    bpy.context.scene.render.bake.use_selected_to_active = True
    bpy.context.scene.render.bake.max_ray_distance = .23
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
    source_image = bpy.data.images.load(str(COLOR), check_existing=True)
    high.data.materials.clear()
    high.data.materials.append(shader_material('Approved stone source', source_image))

    low = high.copy()
    low.data = high.data.copy()
    bpy.context.scene.collection.objects.link(low)
    low.name = f'{name}-lod{level}'
    select(low)
    modifier = low.modifiers.new('Prebaked LOD', 'DECIMATE')
    modifier.ratio = ratio
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    exact_bounds(low, expected)
    select(low)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=.018)
    bpy.ops.object.mode_set(mode='OBJECT')

    atlas = bpy.data.images.new('Colour atlas', width=size, height=size,
                                alpha=False, float_buffer=False)
    atlas.generated_color = (0.67, 0.62, 0.53, 1)
    low.data.materials.clear()
    low.data.materials.append(shader_material('Baked atlas destination', atlas, True))
    select(high, low, active=low)
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'})
    folder = OUTPUT / f'lod{level}'
    folder.mkdir(parents=True, exist_ok=True)
    png = folder / f'{name}.png'
    atlas.filepath_raw = str(png)
    atlas.file_format = 'PNG'
    atlas.save()
    if blur:
        with Image.open(png) as img:
            img.convert('RGB').filter(ImageFilter.GaussianBlur(blur)).save(png, optimize=True)

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
    if not (0 < count < faces * .62):
        raise RuntimeError(f'LOD budget not met: {name} {level}: {count}/{faces}')
    key = f'lod{level}/{name}'
    manifest['files'][key] = {'triangles': sum(len(p.vertices) - 2 for p in low.data.polygons),
                              'sourceFaces': faces, 'sourceBounds': expected,
                              'resolution': size, 'glbBytes': glb.stat().st_size,
                              'ktx2Bytes': ktx.stat().st_size}
    print('BAKED', key, manifest['files'][key], flush=True)

for level, ratio, size, blur in LEVELS:
    manifest['levels'][str(level)] = {'ratio': ratio, 'resolution': size}
    for name in CASTS:
        bake_one(name, level, ratio, size, blur)

(OUTPUT / 'manifest.json').write_text(
    json.dumps(manifest, indent=2, sort_keys=True) + '\n', encoding='utf-8')
print('BAKE COMPLETE', len(manifest['files']), 'prefab LOD variants', flush=True)
