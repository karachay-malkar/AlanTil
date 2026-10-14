#!/usr/bin/env python3
"""AlanTil OFFLINE prefab baker. Never imported or evaluated inside the game.

Every visible triangle belongs to an authored source rock.  Coarse course seeds
are only an initialization: final locations are selected by mesh occupancy,
then uncovered *real* 3-D pockets are filled with real small authored rocks.
Outputs are deterministic, immutable GLBs (40 sections and offline joint tiles).
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import scipy.ndimage as ndi
from scipy.spatial import ConvexHull
import trimesh
from PIL import Image, ImageEnhance

SIZES = [(1, 1, 1), (2, 2, 2), (2, 2, 3), (2, 3, 4), (4, 4, 4)]
CELL = 0.25
# One voxel is 12.5 mm; this is an offline measurement grid, NOT a visual block.
VOXEL = 0.0125
VERSION = '17.5.1'
ASSET_GENERATION = '17_5_1'
VARIANTS = 8
# Warm natural shades distinguish the individual real rocks in deep joints.
STONE_MATERIAL = None
MATERIAL_SOURCE = Path('assets/tower/rock_07/textures')
PALETTE = np.array([[161, 151, 132, 255], [172, 158, 141, 255],
                    [145, 142, 130, 255], [178, 166, 147, 255],
                    [155, 148, 137, 255], [169, 155, 133, 255]], dtype=np.uint8)


def stone_pbr_material():
    """Embed genuine project-authored rock diffuse/normal/ARM maps in GLBs.

    Source assets already ship with AlanTil (rock_07). Cropping avoids using
    that model's UV atlas layout on unrelated FBX rock meshes. Mirrored tiling
    makes the extracted photographic mineral patch repeat without cut seams.
    """
    global STONE_MATERIAL
    if STONE_MATERIAL is not None:
        return STONE_MATERIAL
    def tile(source):
        crop = Image.open(MATERIAL_SOURCE / source).convert('RGB').crop((350, 560, 570, 780))
        a=np.asarray(crop)
        a=np.concatenate([a,a[:,::-1,:]],axis=1)
        a=np.concatenate([a,a[::-1,:,:]],axis=0)
        return Image.fromarray(a.astype(np.uint8),'RGB').resize((256,256),Image.Resampling.LANCZOS)
    diffuse = tile('rock_07_diff_1k.jpg')
    # Avoid the orange-brown tint of the source atlas and match Caucasus stone.
    diffuse = ImageEnhance.Color(diffuse).enhance(.38)
    diffuse = ImageEnhance.Brightness(diffuse).enhance(1.22)
    normal = tile('rock_07_nor_gl_1k.jpg')
    arm = np.asarray(tile('rock_07_arm_1k.jpg')).copy()
    pbr = np.zeros_like(arm)
    pbr[:,:,0]=arm[:,:,0]
    pbr[:,:,1]=np.clip(.60*arm[:,:,1]+98,165,248).astype(np.uint8)
    pbr[:,:,2]=0
    STONE_MATERIAL=trimesh.visual.material.PBRMaterial(
        name='AlanTil authored natural stone PBR',
        baseColorFactor=[238,235,228,255],baseColorTexture=diffuse,
        normalTexture=normal,metallicFactor=0.0,roughnessFactor=.96,
        metallicRoughnessTexture=Image.fromarray(pbr,'RGB'))
    return STONE_MATERIAL


def normalized_rocks(source):
    scene = trimesh.load(source, force='scene', process=False)
    geometries = list(scene.geometry.values())
    if len(geometries) != 36:
        raise ValueError(f'Expected 36 authored original rocks, got {len(geometries)}')
    models = []
    for index, original in enumerate(geometries):
        mesh = original.copy()
        mesh.merge_vertices(merge_tex=True, merge_norm=True, digits_vertex=4)
        if not mesh.is_watertight:
            raise ValueError(f'Original authored Rock{index + 1:03} is not closed')
        verts = mesh.vertices[:, [0, 2, 1]].copy()
        center = (verts.max(axis=0) + verts.min(axis=0)) / 2
        extents = np.maximum(verts.max(axis=0) - verts.min(axis=0), 1e-5)
        # Uniform source normalization PRESERVES the authored natural proportions.
        # Independent per-axis normalization in v17.4.1 made many rocks cubical.
        verts = (verts - center) / extents.max()
        aspect = extents / extents.max()
        faces = mesh.faces[:, [0, 2, 1]].copy()
        hull = ConvexHull(verts)
        fullness = float(hull.volume / aspect.prod())
        models.append({'vertices': verts, 'faces': faces,
                       'planes': hull.equations.astype(np.float32),
                       'aspect': aspect, 'fullness': fullness})
    return models


def rotation_matrix(angles):
    """Rigid 3-D orientations keep authored triangle identity and natural facets."""
    pitch, yaw, roll = angles
    cx, sx = np.cos(pitch), np.sin(pitch)
    cy, sy = np.cos(yaw), np.sin(yaw)
    cz, sz = np.cos(roll), np.sin(roll)
    return (np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]) @
            np.array([[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]) @
            np.array([[1, 0, 0], [0, cx, -sx], [0, sx, cx]]))


def make_mesh(model, size, center, colour, angles=(0, 0, 0)):
    matrix = rotation_matrix(angles)
    verts = (model['vertices'] * np.asarray(size)) @ matrix.T + np.asarray(center)
    # Duplicate corner indices for UV seams without changing any authored
    # triangles: geometry is unchanged, only texture coordinates are split.
    vertices=verts[model['faces']].reshape(-1,3)
    faces=np.arange(len(vertices)).reshape(-1,3)
    result = trimesh.Trimesh(vertices=vertices, faces=faces, process=False)
    normals=result.face_normals
    uv=np.zeros((len(result.vertices),2),dtype=float)
    seed=float(np.dot(center,[17.13,31.71,11.07]))
    offset=np.array([np.sin(seed*7.7)*3.2,np.cos(seed*11.3)*2.1])
    for face_idx, face in enumerate(result.faces):
        axis=int(np.argmax(np.abs(normals[face_idx])))
        axes=((1,2),(0,2),(0,1))[axis]
        uv[face]=result.vertices[face][:,axes]*3.6+offset
    result.visual=trimesh.visual.texture.TextureVisuals(uv=uv,material=stone_pbr_material())
    return result


class Occupancy:
    """Conservative convex-envelope occupancy for the supplied almost-convex meshes.

    The hull is used only as a *candidate collision proxy*. The exported mesh is
    exactly the original authored triangle surface under rigid/axis scaling.
    """
    def __init__(self, dimensions):
        self.box = np.array(dimensions, dtype=float) * CELL
        self.count = np.maximum(1, np.round(self.box / VOXEL).astype(int))
        self.step = self.box / self.count
        self.solid = np.zeros(tuple(self.count), dtype=bool)
        self.slices = None

    def sample(self, model, size, center, angles=(0, 0, 0)):
        matrix = rotation_matrix(angles)
        extents = np.abs(matrix) @ (np.asarray(size) * model['aspect'] / 2)
        bounds_min = np.asarray(center) - extents
        bounds_max = np.asarray(center) + extents
        start = np.maximum(0, np.floor((bounds_min + self.box / 2) / self.step).astype(int))
        stop = np.minimum(self.count, np.ceil((bounds_max + self.box / 2) / self.step).astype(int))
        if np.any(stop <= start):
            return None
        xs = (np.arange(start[0], stop[0]) + .5) * self.step[0] - self.box[0] / 2
        ys = (np.arange(start[1], stop[1]) + .5) * self.step[1] - self.box[1] / 2
        zs = (np.arange(start[2], stop[2]) + .5) * self.step[2] - self.box[2] / 2
        xyz = np.stack(np.meshgrid(xs, ys, zs, indexing='ij'), axis=-1).reshape(-1, 3)
        relative = ((xyz - center) @ matrix) / np.asarray(size)
        equations = model['planes']
        inside = np.all(relative @ equations[:, :3].T + equations[:, 3] <= 1e-5, axis=1)
        mask = inside.reshape(len(xs), len(ys), len(zs))
        return (slice(start[0], stop[0]), slice(start[1], stop[1]), slice(start[2], stop[2])), mask

    def evaluate(self, model, size, center, angles=(0, 0, 0)):
        result = self.sample(model, size, center, angles)
        if result is None:
            return None
        slices, mask = result
        footprint = int(mask.sum())
        if not footprint:
            return None
        occupied = self.solid[slices]
        conflict = int(np.count_nonzero(occupied & mask))
        return footprint, conflict, slices, mask

    def add(self, assessment):
        footprint, conflict, region, mask = assessment
        self.solid[region] |= mask

    @property
    def density(self):
        return float(self.solid.mean())

    def surface_coverage(self, depth=.050):
        # How much of the outside-facing 5-cm layer is filled by real stones.
        depth_voxels = np.maximum(1, np.ceil(depth / self.step).astype(int))
        values = []
        for axis in range(3):
            front = np.take(self.solid, np.arange(depth_voxels[axis]), axis=axis)
            back = np.take(self.solid, np.arange(self.count[axis] - depth_voxels[axis], self.count[axis]), axis=axis)
            values.extend([float(np.any(front, axis=axis).mean()), float(np.any(back, axis=axis).mean())])
        return values


def coarse_positions(dimensions, rng):
    """Only coarse seeds, not the final stone shape or location.

    Offset each successive course and modulate cell sizes; subsequent fitting
    uses actual occupied polyhedra and searches translations/orientations.
    """
    size = np.asarray(dimensions) * CELL
    if max(dimensions) == 1:
        yield size / 2 - size / 2, size * .96
        return
    dense_pattern = max(dimensions) >= 4
    layers = max(1, int(np.ceil(size[1] / (.18 if dense_pattern else .21))))
    heights = rng.uniform(.82, 1.18, layers)
    heights = heights / heights.sum() * size[1]
    ycuts = np.concatenate(([0], heights.cumsum()))
    for row in range(layers):
        ymin, ymax = ycuts[row:row + 2]
        # Offsets break all linearly aligned vertical joints.
        dx = (.245 if row % 2 else .275) if dense_pattern else (.27 if row % 2 else .34)
        dz = (.25 if row % 2 else .28) if dense_pattern else (.27 if row % 2 else .32)
        num_x = max(1, int(np.ceil(size[0] / dx)))
        num_z = max(1, int(np.ceil(size[2] / dz)))
        xweights = rng.uniform(.74, 1.26, num_x)
        zweights = rng.uniform(.74, 1.26, num_z)
        xcuts = np.concatenate(([0], (xweights / xweights.sum() * size[0]).cumsum()))
        zcuts = np.concatenate(([0], (zweights / zweights.sum() * size[2]).cumsum()))
        for x0, x1 in zip(xcuts[:-1], xcuts[1:]):
            for z0, z1 in zip(zcuts[:-1], zcuts[1:]):
                origin = np.array([(x0 + x1) / 2, (ymin + ymax) / 2, (z0 + z1) / 2]) - size / 2
                yield origin, np.array([x1 - x0, ymax - ymin, z1 - z0])


def add_primary_stones(models, volume, rng, stones, ids):
    """Select pre-authored irregular rocks using *real hulls*, not rectangular fillers.

    Each candidate retains source proportions (<=7% axial variation). Coarse
    layout supplies suggestions only; actual hull density and overlap select the
    final rock. No stone is modified inside the game.
    """
    base = list(coarse_positions(volume.count / 20, rng))
    eligible = [i for i, m in enumerate(models) if .24 <= m['fullness'] <= .75]
    for center, nominal in base:
        candidates = []
        model_ids = (eligible if len(base) == 1 else
                     rng.choice(eligible, size=min(7, len(eligible)), replace=False))
        for model_id in model_ids:
            model = models[int(model_id)]
            for orientation in range(2):
                angles = (0., orientation * np.pi / 2, 0.)
                matrix = rotation_matrix(angles)
                oriented = np.abs(matrix) @ model['aspect']
                # A SINGLE scale preserves source character. Tiny anisotropy only
                # compensates for local fitting, not source shape.
                scale = float(np.quantile(nominal / np.maximum(oriented, .07), .55))
                scale *= float(rng.uniform(1.04, 1.22))
                size = scale * rng.uniform(.95, 1.05, size=3)
                rotated_half_size = np.abs(matrix) @ (size * model['aspect'] / 2)
                if np.any(rotated_half_size > volume.box / 2 - .002):
                    fit = float(np.min((volume.box / 2 - .002) /
                                       np.maximum(rotated_half_size, 1e-8)))
                    size *= min(1., fit)
                    rotated_half_size *= min(1., fit)
                if np.any(size <= 0) or np.any(rotated_half_size < .008):
                    continue
                center_try = np.clip(center + rng.uniform(-.022, .022, 3),
                                     -volume.box / 2 + rotated_half_size + .001,
                                     volume.box / 2 - rotated_half_size - .001)
                exam = volume.evaluate(model, size, center_try, angles)
                if exam is None:
                    continue
                cells, overlap, *_ = exam
                if overlap / cells > .26:
                    continue
                # Penalise cuboid-like silhouettes and excessive contacts.
                naturalness = 1. - model['fullness']
                score = cells * (1. + .95 * naturalness) - overlap * 3.5
                score += float(rng.uniform(-.3, .3))
                candidates.append((score, int(model_id), size, center_try, angles, exam))
        if not candidates:
            continue
        _, model_id, chosen_size, chosen_center, angles, exam = max(candidates, key=lambda c:c[0])
        volume.add(exam)
        stones.append(make_mesh(models[model_id], chosen_size, chosen_center,
                                PALETTE[int(rng.integers(len(PALETTE)))], angles))
        ids.append(model_id+1)


def insert_authored_rubble(models, volume, rng, stones, ids, max_pieces=400,
                           model_ids=None, max_diameter=.24, min_void=.034):
    """Fill residual *measured* voids; no preset seam co-ordinates or cubes.

    Largest-free-sphere search gives candidate centres; actual authored hulls
    are tested for overlap. Small pieces have their natural irregular surfaces.
    """
    small_ids = model_ids or [20, 24, 25, 27, 28, 29, 18, 11, 15]
    stagnant = 0
    rejected = np.zeros_like(volume.solid)
    for i in range(max_pieces):
        free = ~(volume.solid | rejected)
        if not free.any():
            break
        # The finite envelope is solid from outside. This also discovers voids
        # on section faces instead of seeking only hidden interior bubbles.
        distance = ndi.distance_transform_edt(np.pad(free, 1, constant_values=False))[1:-1, 1:-1, 1:-1]
        max_radius = float(distance.max()) * float(volume.step.min())
        if max_radius < min_void:
            break
        # Candidate: among biggest void pockets, randomize the location so
        # variants do not have an artificial lattice of identical rubble.
        radius_vox = max_radius / float(volume.step.min())
        peak_voxels = np.argwhere(distance >= radius_vox * .975)
        selected = peak_voxels[int(rng.integers(len(peak_voxels)))]
        center = (selected + .5) * volume.step - volume.box / 2
        # Very large open pockets can accept more substantial authored stones.
        diameter = min(max_diameter, max_radius * 2.3)
        if diameter < .105:
            break
        best = None
        for model_id in rng.choice(small_ids, size=5, replace=False):
            model = models[int(model_id)]
            for angle in (0, 1, 2, 3):
                angles = (float(rng.uniform(-.17, .17)),
                          float(angle * np.pi / 2 + rng.uniform(-.4, .4)),
                          float(rng.uniform(-.17, .17)))
                size = diameter * rng.uniform(.92, 1.06, size=3)
                margin = np.minimum(center + volume.box / 2, volume.box / 2 - center) - .001
                if np.any(margin <= .014):
                    continue
                rotated_halfsize = np.abs(rotation_matrix(angles)) @ (size * model['aspect'] / 2)
                fit = min(1., float(np.min(margin / np.maximum(rotated_halfsize, 1e-8))))
                size *= fit
                if np.max(size*model['aspect']) < .10 or np.max(size*model['aspect']) > .255:
                    continue
                exam = volume.evaluate(model, size, center, angles)
                if exam is None:
                    continue
                cells, collisions, *_ = exam
                if collisions / cells > .055:
                    continue
                score = cells - collisions * 7
                if best is None or score > best[0]:
                    best = (score, int(model_id), size, angles, exam)
        if not best:
            # Mark this failed voxel in a strictly local, non-visual exclusion
            # map to avoid retrying forever; no geometry is added for failures.
            rejected[tuple(selected)] = True
            stagnant += 1
            if stagnant > 20:
                break
            continue
        _, model_id, size, angles, exam = best
        volume.add(exam)
        stones.append(make_mesh(models[model_id], size, center,
                                PALETTE[int(rng.integers(len(PALETTE)))], angles))
        ids.append(model_id + 1)
        stagnant = 0
    return i + 1


def insert_surface_chinking(models, volume, rng, stones, ids, max_pieces=100):
    """Fill measured gaps on exposed faces, not a preset lattice of little cubes.

    All objects are transformed authored 3D rocks. Surface candidates are
    accepted using the same volume intersection test as the core filler.
    """
    chosen_models = [11, 15, 18, 20, 23, 24, 25, 27, 28, 29]
    occupied_shell = 0
    for it in range(max_pieces):
        face_candidates = []
        for axis in range(3):
            for end in (0, -1):
                depth = min(4, volume.count[axis])
                indices = range(depth) if end == 0 else range(volume.count[axis]-depth,volume.count[axis])
                face = np.any(np.take(volume.solid,list(indices),axis=axis),axis=axis)
                free = np.argwhere(~face)
                if len(free) < 5:
                    continue
                # Select coherent exterior voids, not arbitrary empty edge voxels.
                clear=ndi.distance_transform_edt(np.pad(~face,1,constant_values=False))[1:-1,1:-1]
                maxima=np.argwhere((clear>=1.3)&(clear<=7.5))
                if len(maxima):face_candidates.append((float(clear.max())**2,axis,end,maxima))
        if not face_candidates:
            break
        weights = np.array([f[0] for f in face_candidates], dtype=float)
        weights /= weights.sum()
        _, axis, end, available = face_candidates[int(rng.choice(len(face_candidates),p=weights))]
        other_axes=[k for k in range(3) if k!=axis]
        found=False
        for attempt in range(12):
            uv=available[int(rng.integers(len(available)))]
            model_id=int(rng.choice(chosen_models));model=models[model_id]
            angles=(float(rng.uniform(-.14,.14)),float(rng.choice([0, np.pi/2,np.pi,3*np.pi/2])),float(rng.uniform(-.14,.14)))
            scale=float(rng.uniform(.115,.225))
            size=scale*rng.uniform(.96,1.04,size=3)
            half=np.abs(rotation_matrix(angles)) @ (size*model['aspect']/2)
            center=np.zeros(3)
            for i,k in enumerate(other_axes):center[k]=(uv[i]+.5)*volume.step[k]-volume.box[k]/2
            center[axis]=(volume.box[axis]/2-half[axis]-.014)*(1 if end==-1 else -1)
            center=np.clip(center,-volume.box/2+half+.001,volume.box/2-half-.001)
            exam=volume.evaluate(model,size,center,angles)
            if exam is None:continue
            voxels,collision,*_=exam
            if collision/voxels>.13:continue
            # A chinking stone must be seated in a real pocket, not glued to a facade.
            region, mask = exam[2], exam[3]
            existing = volume.solid[region]
            contact = ndi.binary_dilation(mask,iterations=2) & existing & ~mask
            if int(contact.sum()) < max(2,int(voxels*.012)):continue
            volume.add(exam)
            stones.append(make_mesh(model,size,center,PALETTE[int(rng.integers(len(PALETTE)))],angles))
            ids.append(model_id+1);occupied_shell+=1;found=True;break
        if not found:
            # Skip a difficult face and try another one; do not fabricate fill.
            continue
    return occupied_shell


def make_section(models, size, variant):
    seed = int(hashlib.sha256(f'AlanTil-prefab-v3:{size}:{variant}'.encode()).hexdigest()[:12], 16)
    rng = np.random.default_rng(seed)
    volume = Occupancy(size)
    parts, source_ids = [], []
    add_primary_stones(models, volume, rng, parts, source_ids)
    base_count = len(parts)
    primary_solid = volume.solid.copy()
    fill_iterations = insert_authored_rubble(models, volume, rng, parts, source_ids,
                                            max_pieces=min(150, max(50, round(np.prod(size) * 4))))
    shell_added=insert_surface_chinking(models,volume,rng,parts,source_ids,
            max_pieces=min(92, max(12, round(np.prod(size)*2))))
    result = trimesh.util.concatenate(parts)
    result.metadata['name'] = f'{size[0]}x{size[1]}x{size[2]}-v{variant}'
    # Visual fraction from actual outside-looking rays. A pebble recessed
    # behind a front-face hole is visible, even when it misses the first voxel.
    facing_total=facing_rubble=0
    for axis in range(3):
        for reverse in (False,True):
            f=np.moveaxis(volume.solid,axis,0)
            p=np.moveaxis(primary_solid,axis,0)
            if reverse:f=f[::-1];p=p[::-1]
            visible=f.any(axis=0)
            first=f.argmax(axis=0)
            primary_first=np.take_along_axis(p,first[None,...],axis=0)[0]
            facing_total+=int(visible.sum())
            facing_rubble+=int((visible & ~primary_first).sum())
    quality = {'density': round(volume.density, 4),
               'visibleRubbleShare': round(facing_rubble / max(1, facing_total), 4),
               'surfaceCoverage': [round(s, 4) for s in volume.surface_coverage()],
               'mainRocks': base_count, 'rubbleRocks': len(parts) - base_count,
               'fillIterations': fill_iterations, 'faceChinkingRocks': shell_added}
    return result, source_ids, len(parts), quality


def make_seam(models, axis):
    """One immutable 25-cm joint tile, assembled offline from authored pebbles.

    Every section shares the same edge interface. The tile overlays the seam
    itself; the browser may only translate it to compatible 25-cm grid cells.
    """
    seed = {'x': 1283, 'y': 3371, 'z': 2999, 'corner': 5941}[axis]
    rng = np.random.default_rng(seed)
    rocks = []
    for j in range(6):
        u = ((j % 3) + .5) / 3 * CELL - CELL / 2
        v = ((j // 3) + .5) / 2 * CELL - CELL / 2
        if axis == 'x':p = [0, u, v]
        elif axis == 'y':p = [u, 0, v]
        elif axis == 'corner':p = [u * .34, v, u * .34]
        else:p = [u, v, 0]
        model_id = [20, 23, 25, 27, 28, 29][j]
        model = models[model_id]
        # Preserve natural proportions and limit the joint to a narrow strip.
        scale = .105 + (j % 3) * .014
        dims = np.full(3, scale)
        rocks.append(make_mesh(model, dims, p, PALETTE[int(rng.integers(0, len(PALETTE)))]))
    return trimesh.util.concatenate(rocks)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='assets/tower/source-original-36.glb')
    parser.add_argument('--output', default='assets/tower/prefabs')
    parser.add_argument('--only', default=None, help='Single size, e.g. 4x4x4 (development only)')
    parser.add_argument('--variant', type=int, default=None, help='Single variant (development only)')
    options = parser.parse_args()
    source, output = Path(options.source), Path(options.output)
    output.mkdir(parents=True, exist_ok=True)
    models = normalized_rocks(source)
    manifest = {'version': VERSION, 'cellMeters': CELL,
                'legacyVersion': '17.4.1',
                'previousVersion': '17.5.0',
                'previousVariants': {('x'.join(map(str,d))): [
                    '/assets/tower/prefabs/section-' + 'x'.join(map(str,d)) + f'-v{i}-17_5.glb'
                    for i in range(VARIANTS)] for d in SIZES},
                'materialSource': 'assets/tower/rock_07/textures',
                'legacyConnectors': {axis: '/assets/tower/prefabs/joint-' + axis + '.glb'
                                     for axis in 'xyz'},
                'legacyVariants': {('x'.join(map(str,d))): [
                    '/assets/tower/prefabs/section-' + 'x'.join(map(str,d)) + f'-v{i}.glb'
                    for i in range(4)] for d in SIZES},
                'jointInterface': 'shared-recessed-25cm-v1',
                'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'authoredModels': len(models), 'qualityGridMeters': VOXEL,
                'types': [], 'connectors': {}}
    for dims in SIZES:
        key = 'x'.join(map(str, dims))
        if options.only and options.only != key:
            continue
        variants = []
        for variant in ([options.variant] if options.variant is not None else range(VARIANTS)):
            mesh, ids, count, quality = make_section(models, dims, variant)
            filename = f'section-{key}-v{variant}-{ASSET_GENERATION}.glb'
            mesh.export(output / filename, file_type='glb')
            variants.append({'file': '/assets/tower/prefabs/' + filename, 'rocks': count,
                             'sourceModels': sorted(set(ids)), 'faces': len(mesh.faces), 'quality': quality})
            print(key, variant, quality, flush=True)
        manifest['types'].append({'id': key, 'size': list(dims), 'variants': variants,
                                  'jointInterface': 'shared-recessed-25cm-v1', 'priceSilver': None})
    if not options.only:
        for axis in ['x','y','z','corner']:
            filename = f'joint-{axis}-{ASSET_GENERATION}.glb'
            seam = make_seam(models, axis)
            seam.export(output / filename, file_type='glb')
            manifest['connectors'][axis] = {'file': '/assets/tower/prefabs/' + filename,
                                            'faces': len(seam.faces),
                                            'interface': 'shared-recessed-25cm-v1'}
        (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Completed pre-baked authored-rock construction assets.', flush=True)


if __name__ == '__main__':
    main()