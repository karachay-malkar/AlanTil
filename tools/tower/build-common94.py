#!/usr/bin/env python3
"""Offline AlanTil 94-rock archive: 63 original wall rocks + 29 unique filling rocks + two stone lintels.

Existing source GLBs and all historic placed sections remain unchanged.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

CHINK_SOURCE_IDS = [1, 2, 3, 4] + list(range(6, 31))
assert len(CHINK_SOURCE_IDS) == 29


def hash_geometry(mesh):
    return hashlib.sha256(np.asarray(mesh.vertices, dtype=np.float32).tobytes()
                          + np.asarray(mesh.faces, dtype=np.int32).tobytes()).hexdigest()


def source_rocks(path):
    src = trimesh.load(path, force='scene', process=False)
    models = {}
    for name, mesh in src.geometry.items():
        if name.startswith('Rock'):
            key = int(name[4:7])
            if key in models:
                raise ValueError('Duplicate original ' + str(key))
            models[key] = mesh
    if len(models) != 36:
        raise ValueError('Expected 36 original rocks, got ' + str(len(models)))
    return models


def matte(mesh):
    verts = np.asarray(mesh.vertices, dtype=np.float32)
    uv = (verts[:, [0, 2]] * 3.15).astype(np.float32)
    mesh.visual = TextureVisuals(uv=uv, material=PBRMaterial(
        name='AlanTil regional stone - matte',
        baseColorFactor=[93, 94, 91, 255],
        metallicFactor=0, roughnessFactor=1))
    return mesh


def sculpt_small(source_mesh, serial, longest):
    """Preserves deterministic geometry from the approved standalone CHINK_001..029 GLB."""
    rng = np.random.default_rng(17700 + 1051 * serial)
    m = source_mesh.convex_hull.copy()
    vertices = m.vertices.astype(np.float64) - m.bounds.mean(axis=0)
    ext = np.ptp(vertices, axis=0)
    if int(np.argmax(ext)) == 1:
        vertices = vertices[:, [1, 0, 2]] * [1, -1, 1]
    elif int(np.argmax(ext)) == 2:
        vertices = vertices[:, [2, 1, 0]] * [1, 1, -1]
    vertices = vertices / np.ptp(vertices, axis=0).max()
    m.vertices = vertices
    while len(m.faces) < 350:
        v, f = trimesh.remesh.subdivide(m.vertices, m.faces)
        m = trimesh.Trimesh(vertices=v, faces=f, process=False)
    p = np.asarray(m.vertices, dtype=np.float64).copy()
    for chip in range(7):
        direction = rng.normal(size=3)
        direction /= np.linalg.norm(direction)
        dot = p @ direction
        level = np.quantile(dot, rng.uniform(.70, .90))
        reduction = np.maximum(dot - level, 0.0)
        amount = rng.uniform(.10, .32)
        p -= (amount * reduction)[:, None] * direction
    for j in range(4):
        anchor = p[int(rng.integers(len(p)))]
        delta = p - anchor
        spread = rng.uniform(.12, .36)
        strength = rng.uniform(-.018, .012)
        weights = np.exp(-np.sum(delta * delta, axis=1) / (2 * spread**2))
        direction = rng.normal(size=3)
        direction /= np.linalg.norm(direction)
        p += (strength * weights)[:, None] * direction
    m.vertices = p
    m.fix_normals()
    if m.volume < 0:
        m.invert()
    m.apply_scale(longest / max(m.extents))
    m.apply_translation(-m.bounds.mean(axis=0))
    return matte(m)


def chinking(models):
    ratios = [(i, min(models[i].extents) / max(models[i].extents)) for i in CHINK_SOURCE_IDS]
    ordered = [i for i, _ in sorted(ratios, key=lambda r: (-r[1], r[0]))]
    lengths = dict(zip(ordered[:5], np.linspace(.071, .094, 5)))
    lengths.update(dict(zip(ordered[5:19], np.linspace(.105, .165, 14))))
    lengths.update(dict(zip(ordered[19:], np.linspace(.178, .244, 10))))
    return {f'CHINK_{idx:03d}': sculpt_small(models[rock_id], idx, float(lengths[rock_id]))
            for idx, rock_id in enumerate(CHINK_SOURCE_IDS, 1)}


def lintel(source, size, door=False):
    """One natural Rock013-derived mesh, exactly one solid per opening."""
    m = source.convex_hull.copy()
    m.apply_translation(-m.bounds.mean(axis=0))
    m.apply_scale(np.asarray(size) / m.extents)
    if door:
        for _ in range(3):
            v, f = trimesh.remesh.subdivide(m.vertices, m.faces)
            m = trimesh.Trimesh(vertices=v, faces=f, process=False)
        p = np.asarray(m.vertices, dtype=float).copy()
        x, y, z = p.T.copy()
        weights = np.clip((np.abs(z) - .05) / (.5 * size[2] - .05), 0, 1)
        notches = [(-.70, .070, .018), (-.46, .051, .014), (-.19, .069, .018),
                   (.10, .070, .012), (.35, .062, .020), (.61, .059, .015)]
        for cx, width, depth in notches:
            face_w = weights * np.maximum(0, 1 - np.abs(x - cx) / width) * np.clip((y + .12) / .24, 0, 1)
            p[:, 2] -= np.sign(z) * depth * face_w
        end = np.clip((np.abs(x) - .59) / .28, 0, 1)
        p[:, 0] -= np.sign(x) * end * (.005 + .007 * np.abs(np.sin(y * 51 + z * 19)))
        m.vertices = p
        m.fix_normals()
    m.apply_translation(-m.bounds.mean(axis=0))
    if m.volume < 0:
        m.invert()
    return matte(m)


def build(wall_source: Path, original_source: Path, out: Path):
    wall = trimesh.load(wall_source, force='scene', process=False)
    if len(wall.geometry) != 63:
        raise ValueError('Expected exactly 63 source wall meshes')
    original = source_rocks(original_source)
    fillers = chinking(original)
    lintels = {'LINTEL_WINDOW': lintel(original[13], (.984, .244, .484)),
               'LINTEL_DOOR': lintel(original[13], (1.738, .245, .489), door=True)}
    geometry, groups = {}, {}
    for group, meshes in [('wall', wall.geometry), ('chinking', fillers), ('lintel', lintels)]:
        for name, mesh in meshes.items():
            if name in geometry or not len(mesh.faces):
                raise ValueError('Duplicate or empty rock ' + name)
            geometry[name] = mesh.copy()
            groups[name] = group
    if len(geometry) != 94:
        raise ValueError('Unexpected number of meshes: ' + str(len(geometry)))
    for name, mesh in fillers.items():
        if not mesh.is_volume or not (.045 <= max(mesh.extents) <= .251):
            raise ValueError('Invalid filling rock ' + name)
    for name, mesh in lintels.items():
        if not mesh.is_volume:
            raise ValueError('Invalid single-piece lintel ' + name)
    scene = trimesh.Scene(base_frame='world')
    for name, mesh in geometry.items():
        scene.add_geometry(mesh, geom_name=name, node_name=name)
    out.mkdir(parents=True, exist_ok=True)
    result = out / 'common-94.glb'
    scene.export(result)
    reloaded = trimesh.load(result, force='scene', process=False)
    if set(reloaded.geometry) != set(geometry):
        raise ValueError('GLB name loss')
    for name in geometry:
        if (not np.allclose(reloaded.geometry[name].vertices, geometry[name].vertices, rtol=1e-5, atol=1e-5)
                or not np.array_equal(reloaded.geometry[name].faces, geometry[name].faces)):
            raise ValueError('GLB changed source geometry for ' + name)
    report = {
        'version': '17.7-common94.1',
        'count': 94,
        'counts': {'wall': 63, 'chinking': 29, 'lintel': 2},
        'sourceWall': wall_source.name,
        'sourceWallSHA256': hashlib.sha256(wall_source.read_bytes()).hexdigest(),
        'sourceRock36': original_source.name,
        'sourceRock36SHA256': hashlib.sha256(original_source.read_bytes()).hexdigest(),
        'glbSHA256': hashlib.sha256(result.read_bytes()).hexdigest(),
        'models': [{'name': name, 'category': groups[name],
                    'sizeMeters': [round(float(x), 5) for x in mesh.extents],
                    'triangles': int(len(mesh.faces)),
                    'geometrySHA256': hash_geometry(mesh)}
                   for name, mesh in geometry.items()]
    }
    (out / 'common-94.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print('COMMON94_OK: meshes=94 groups=63+29+2 bytes=' + str(result.stat().st_size))
    return report


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--wall', default='assets/tower/prefabs/balkar71/library-wall-17_5_5.glb')
    ap.add_argument('--source', default='assets/tower/source-original-36.glb')
    ap.add_argument('--out', default='assets/tower/prefabs/common94')
    args = ap.parse_args()
    build(Path(args.wall), Path(args.source), Path(args.out))
