"""Run with Blender in background mode from the repository root."""
from pathlib import Path
import bpy
import bmesh

source = Path('assets/tower/approved-library/casts').resolve()
output = source.parent / 'fence-lod'
output.mkdir(exist_ok=True)
for name in ('section-2x2x2-v3', 'section-3x3x3-v2'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(source / (name + '.glb')))
    obj = bpy.context.object
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    def bounds():
        return [(min(v.co[i] for v in obj.data.vertices),
                 max(v.co[i] for v in obj.data.vertices)) for i in range(3)]
    original_bounds = bounds()
    original_faces = len(obj.data.polygons)
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-6)
    mesh.to_mesh(obj.data)
    mesh.free()
    modifier = obj.modifiers.new('Fence LOD', 'DECIMATE')
    modifier.ratio = .52
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    for i, ((lo, hi), (from_lo, from_hi)) in enumerate(zip(original_bounds, bounds())):
        for vertex in obj.data.vertices:
            vertex.co[i] = lo + (vertex.co[i] - from_lo) * (hi - lo) / (from_hi - from_lo)
    obj.data.update()
    for layer in list(obj.data.uv_layers):
        obj.data.uv_layers.remove(layer)
    primary = obj.data.uv_layers.new(name='Stone UV')
    for face in obj.data.polygons:
        face.use_smooth = True
        n = face.normal
        axes = (abs(n.x), abs(n.z), abs(n.y))
        axis = max(range(3), key=lambda i: axes[i])
        for index in face.loop_indices:
            co = obj.data.vertices[obj.data.loops[index].vertex_index].co
            x, y, z = co.x, co.z, -co.y
            primary.data[index].uv = ((z if axis == 0 else x) * 3.15,
                                      1 - (z if axis == 1 else y) * 3.15)
    obj.data.uv_layers.new(name='Stone UV duplicate', do_init=True)
    assert len(obj.data.polygons) < original_faces * .6
    bpy.ops.export_scene.gltf(filepath=str(output / (name + '.glb')),
                              export_format='GLB', export_materials='NONE')
