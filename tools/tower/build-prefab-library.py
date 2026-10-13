#!/usr/bin/env python3
"""AlanTil OFFLINE prefab baker. Never imported or evaluated inside the game.

Every visible triangle belongs to an authored source rock.  Coarse course seeds
are only an initialization: final locations are selected by mesh occupancy,
then uncovered *real* 3-D pockets are filled with real small authored rocks.
Outputs are deterministic, immutable GLBs (20 sections and 3 joint assets).
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
import scipy.ndimage as ndi
from scipy.spatial import ConvexHull
import trimesh

SIZES = [(1, 1, 1), (2, 2, 2), (2, 2, 3), (2, 3, 4), (4, 4, 4)]
CELL = 0.25
# One voxel is 12.5 mm; this is an offline measurement grid, NOT a visual block.
VOXEL = 0.0125
VERSION = '17.4.1'
# Warm natural shades distinguish the individual real rocks in deep joints.
PALETTE = np.array([[161, 151, 132, 255], [172, 158, 141, 255],
                    [145, 142, 130, 255], [178, 166, 147, 255],
                    [155, 148, 137, 255], [169, 155, 133, 255]], dtype=np.uint8)


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
        verts = (verts - center) / extents
        faces = mesh.faces[:, [0, 2, 1]].copy()
        hull = ConvexHull(verts)
        fullness = float(hull.volume)
        models.append({'vertices': verts, 'faces': faces,
                       'planes': hull.equations.astype(np.float32),
                       'fullness': fullness})
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
    result = trimesh.Trimesh(vertices=verts, faces=model['faces'], process=False)
    result.visual.vertex_colors = np.broadcast_to(np.asarray(colour, dtype=np.uint8),
                                                    (len(verts), 4)).copy()
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
        extents = np.abs(matrix) @ (np.asarray(size) / 2)
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
    layers = max(1, int(np.ceil(size[1] / .21)))
    heights = rng.uniform(.82, 1.18, layers)
    heights = heights / heights.sum() * size[1]
    ycuts = np.concatenate(([0], heights.cumsum()))
    for row in range(layers):
        ymin, ymax = ycuts[row:row + 2]
        # Offsets break all linearly aligned vertical joints.
        num_x = max(1, int(np.ceil(size[0] / (.27 if row % 2 else .34))))
        num_z = max(1, int(np.ceil(size[2] / (.27 if row % 2 else .32))))
        xweights = rng.uniform(.74, 1.26, num_x)
        zweights = rng.uniform(.74, 1.26, num_z)
        xcuts = np.concatenate(([0], (xweights / xweights.sum() * size[0]).cumsum()))
        zcuts = np.concatenate(([0], (zweights / zweights.sum() * size[2]).cumsum()))
        for x0, x1 in zip(xcuts[:-1], xcuts[1:]):
            for z0, z1 in zip(zcuts[:-1], zcuts[1:]):
                origin = np.array([(x0 + x1) / 2, (ymin + ymax) / 2, (z0 + z1) / 2]) - size / 2
                yield origin, np.array([x1 - x0, ymax - ymin, z1 - z0])


def add_primary_stones(models, volume, rng, stones, ids):
    base = list(coarse_positions(volume.count / 20, rng))  # box dimensions in cells
    for center, nominal in base:
        if len(base) == 1:
            model_ids = [34, 20, 18, 11, 4]
        else:
            # Prefer actual volume filling, not bounding boxes of thin/sparse forms.
            dense = [i for i, m in enumerate(models) if m['fullness'] >= .54]
            model_ids = rng.choice(dense, size=min(4, len(dense)), replace=False)
        candidates = []
        for model_id in model_ids:
            model = models[int(model_id)]
            for orientation in range(2):
                angles = (0., orientation * np.pi / 2, 0.)
                matrix = rotation_matrix(angles)
                # Stones extend into a neighbour's nominal allocation.  Contacts
                # are checked by the actual model volume, never by a fixed cube.
                size = (np.minimum(nominal * rng.uniform(.96, 1.05, size=3),
                                   volume.box * .985) if len(base) == 1 else
                        nominal * rng.uniform(1.07, 1.14, size=3))
                # Respect the prefab bounding box (including rotation).
                rotated_half_size = np.abs(matrix) @ (size / 2)
                if np.any(rotated_half_size > volume.box / 2 - .002):
                    continue
                center_try = np.clip(center + rng.uniform(-.013, .013, 3),
                                     -volume.box / 2 + rotated_half_size + .001,
                                     volume.box / 2 - rotated_half_size - .001)
                if np.any(size > volume.box + .0001):
                    continue
                exam = volume.evaluate(model, size, center_try, angles)
                if exam is None:
                    continue
                area, conflicts, *_ = exam
                # Put pressure on overlap without rejecting the locally fitted
                # contacts entirely.  Later pebbles occupy actual free pockets.
                excess = conflicts / area
                if excess > .30:
                    continue
                score = (area - conflicts * 2.7) + rng.uniform(-1.0, 1.0) * 2
                candidates.append((score, int(model_id), size, center_try, angles, exam))
        if not candidates:
            continue
        _, model_id, chosen_size, chosen_center, angles, exam = max(candidates, key=lambda c: c[0])
        volume.add(exam)
        stones.append(make_mesh(models[model_id], chosen_size, chosen_center,
                                PALETTE[int(rng.integers(len(PALETTE)))], angles))
        ids.append(model_id + 1)


def insert_authored_rubble(models, volume, rng, stones, ids, max_pieces=400):
    """Fill residual *measured* voids; no preset seam co-ordinates or cubes.

    Largest-free-sphere search gives candidate centres; actual authored hulls
    are tested for overlap. Small pieces have their natural irregular surfaces.
    """
    small_ids = [20, 24, 25, 27, 28, 29, 18, 11, 15]
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
        if max_radius < .021:
            break
        # Candidate: among biggest void pockets, randomize the location so
        # variants do not have an artificial lattice of identical rubble.
        radius_vox = max_radius / float(volume.step.min())
        peak_voxels = np.argwhere(distance >= radius_vox * .975)
        selected = peak_voxels[int(rng.integers(len(peak_voxels)))]
        center = (selected + .5) * volume.step - volume.box / 2
        # Very large open pockets can accept more substantial authored stones.
        diameter = min(.16, max_radius * 1.7)
        best = None
        for model_id in rng.choice(small_ids, size=5, replace=False):
            model = models[int(model_id)]
            for angle in (0, 1, 2, 3):
                angles = (float(rng.uniform(-.17, .17)),
                          float(angle * np.pi / 2 + rng.uniform(-.4, .4)),
                          float(rng.uniform(-.17, .17)))
                size = diameter * rng.uniform(.77, 1.08, size=3)
                margin = np.minimum(center + volume.box / 2, volume.box / 2 - center) - .001
                if np.any(margin <= .014):
                    continue
                rotated_halfsize = np.abs(rotation_matrix(angles)) @ (size / 2)
                fit = min(1., float(np.min(margin / np.maximum(rotated_halfsize, 1e-8))))
                size *= fit
                if np.any(size < .027):
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


def make_section(models, size, variant):
    seed = int(hashlib.sha256(f'AlanTil-prefab-v2:{size}:{variant}'.encode()).hexdigest()[:12], 16)
    rng = np.random.default_rng(seed)
    volume = Occupancy(size)
    parts, source_ids = [], []
    add_primary_stones(models, volume, rng, parts, source_ids)
    base_count = len(parts)
    fill_iterations = insert_authored_rubble(models, volume, rng, parts, source_ids,
                                            max_pieces=max(20, round(np.prod(size) * 4)))
    result = trimesh.util.concatenate(parts)
    result.metadata['name'] = f'{size[0]}x{size[1]}x{size[2]}-v{variant}'
    quality = {'density': round(volume.density, 4),
               'surfaceCoverage': [round(s, 4) for s in volume.surface_coverage()],
               'mainRocks': base_count, 'rubbleRocks': len(parts) - base_count,
               'fillIterations': fill_iterations}
    return result, source_ids, len(parts), quality


def make_seam(models, axis):
    """Preserve the previously approved prebuilt joining concept."""
    seed = {'x': 1283, 'y': 3371, 'z': 2999}[axis]
    rng = np.random.default_rng(seed)
    rocks = []
    for j in range(8):
        u = ((j % 4) + .5) / 4 - .5
        v = ((j // 4) + .5) / 2 - .5
        if axis == 'x':
            p = [0, u, v]
        elif axis == 'y':
            p = [u, 0, v]
        else:
            p = [u, v, 0]
        dims = [.085, .24, .30] if axis == 'x' else ([.23, .07, .27] if axis == 'y' else [.24, .28, .075])
        rocks.append(make_mesh(models[20 + int(rng.integers(0, 10))], dims, p,
                               PALETTE[int(rng.integers(len(PALETTE)))], (0, 0, 0)))
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
                'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'authoredModels': len(models), 'qualityGridMeters': VOXEL,
                'types': [], 'connectors': {}}
    for dims in SIZES:
        key = 'x'.join(map(str, dims))
        if options.only and options.only != key:
            continue
        variants = []
        for variant in ([options.variant] if options.variant is not None else range(4)):
            mesh, ids, count, quality = make_section(models, dims, variant)
            filename = f'section-{key}-v{variant}.glb'
            mesh.export(output / filename, file_type='glb')
            variants.append({'file': '/assets/tower/prefabs/' + filename, 'rocks': count,
                             'sourceModels': sorted(set(ids)), 'faces': len(mesh.faces), 'quality': quality})
            print(key, variant, quality, flush=True)
        manifest['types'].append({'id': key, 'size': list(dims), 'variants': variants, 'priceSilver': None})
    if not options.only:
        for axis in 'xyz':
            filename = f'joint-{axis}.glb'
            seam = make_seam(models, axis)
            seam.export(output / filename, file_type='glb')
            manifest['connectors'][axis] = {'file': '/assets/tower/prefabs/' + filename,
                                            'faces': len(seam.faces)}
        (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Completed pre-baked authored-rock construction assets.', flush=True)


if __name__ == '__main__':
    main()