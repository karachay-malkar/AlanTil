#!/usr/bin/env python3
"""Offline common-100: select original angular gate-v7 rocks, generate only missing shapes.

Never touches the live prefab manifest or historical GLBs. Units: metres.
"""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

import numpy as np
import trimesh
from trimesh.visual.material import PBRMaterial
from trimesh.visual.texture import TextureVisuals

ROOT = Path(__file__).resolve().parents[2]
GATE = ROOT / "assets/tower/prefabs/architectural/gate-18x10x2-v7.glb"
EXPECTED_GATE_SHA256 = "37dc0aee3bead89dba3ed5427af604c09340db0ede15ece139f9016fc920ba51"
OUTPUT = ROOT / "assets/tower/prefabs/common100"
VERSION = "17.7-common100.1"
TARGETS = {"main": 72, "large": 10, "chinking": 12, "lintel": 6}
SEED = 170017
MATERIAL = PBRMaterial(name="ALANTIL_COMMON100_ROCK_PBR", baseColorFactor=[193, 176, 146, 255],
                       metallicFactor=0.0, roughnessFactor=0.97, doubleSided=False)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def normalised_signature(mesh):
    # Rotation/scale-independent edge distribution detects exact source reuse.
    edge = np.sort(np.asarray(mesh.edges_unique_length, dtype=float))
    edge = edge / max(float(edge[-1]) if len(edge) else 1, 1e-9)
    return sha256(np.round(edge, 5).astype(np.float32).tobytes() +
                  str(len(mesh.faces)).encode())


def geom_sha(mesh):
    return sha256(np.asarray(mesh.vertices, dtype="<f4").tobytes() +
                  np.asarray(mesh.faces, dtype="<i4").tobytes())


def angular_score(mesh):
    angles = np.asarray(mesh.face_adjacency_angles)
    sharp = float(np.mean(angles > np.deg2rad(18))) if len(angles) else 0
    dims = np.sort(mesh.extents)
    elongation = float(dims[-1] / max(dims[-2], 1e-6))
    fill = float(abs(mesh.volume) / max(np.prod(mesh.extents), 1e-8))
    return (sharp * 1.5 + min(elongation, 3) * .20 + min(len(mesh.faces), 2500) / 40000
            - max(0, fill - .87) * 4), sharp, elongation, fill


def align_long_axis_x(mesh):
    # Keep gravity vertical whenever the longest dimension is horizontal.
    axis = int(np.argmax(mesh.extents))
    if axis == 2:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
    elif axis == 1:
        mesh.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [0, 0, 1]))
    mesh.apply_translation(-mesh.bounds.mean(axis=0))
    return mesh


def gate_candidates(path):
    if sha256(path.read_bytes()) != EXPECTED_GATE_SHA256:
        raise ValueError("The approved gate GLB SHA-256 does not match")
    scene = trimesh.load(path, force="scene", process=False)
    candidates = {"main": [], "chinking": []}
    diagnostics = {"main": [], "chinking": []}
    for node in sorted(scene.graph.nodes_geometry):
        if "_PIER_" not in node:
            continue
        kind = "main" if "_PIER_STONE_" in node else "chinking" if "_PIER_CHINKING_" in node else None
        if kind is None:
            raise ValueError("Unclassified gate stone: " + node)
        transform, geometry_name = scene.graph.get(node)
        mesh = scene.geometry[geometry_name].copy()
        mesh.apply_transform(transform)
        # Gate-v7 rocks split shared vertices at glTF shading/UV seams. Weld identical
        # *positions* before computing dihedrals or testing water-tightness.
        mesh.merge_vertices(merge_tex=True, merge_norm=True)
        trimesh.repair.fix_normals(mesh)
        if not np.isfinite(mesh.vertices).all() or len(mesh.faces) < 12:
            continue
        align_long_axis_x(mesh)
        score, sharp, elongation, fill = angular_score(mesh)
        diagnostics[kind].append((round(sharp,4),round(elongation,3),round(fill,3),len(mesh.faces),bool(mesh.is_watertight)))
        if min(mesh.extents) < 0.001 or fill < 0.08 or fill > .94:
            continue
        if kind == "main" and (elongation < 1.075 or sharp < .025):
            continue
        if kind == "chinking" and sharp < .012:
            continue
        candidates[kind].append(dict(node=node, mesh=mesh, score=score,
                                     sharp=sharp, elongation=elongation, fill=fill,
                                     signature=normalised_signature(mesh)))
    for kind, rows in diagnostics.items():
        print("GATE_RAW_METRICS",kind,"total",len(rows),"sample",rows[:5],
              "minmax_sharp",(min((r[0] for r in rows),default=0), max((r[0] for r in rows),default=0)),
              "fill",(min((r[2] for r in rows),default=0), max((r[2] for r in rows),default=0)),
              "watertight",sum(r[4] for r in rows))
    print("GATE_INPUT", {kind: len(v) for kind, v in candidates.items()})
    return candidates


def make_surface(mesh, force_uv=False):
    if mesh.volume < 0:
        mesh.invert()
    uv = getattr(mesh.visual, "uv", None)
    if force_uv or uv is None or len(uv) != len(mesh.vertices):
        verts = np.asarray(mesh.vertices)
        uv = np.column_stack((verts[:, 0] * 2.8, verts[:, 2] * 2.8)).astype(np.float32)
    else:
        uv = np.asarray(uv, dtype=np.float32).copy()
    mesh.visual = TextureVisuals(uv=uv, material=MATERIAL)
    return mesh


def fractured_rock(rng, dimensions, lintel=False):
    """Original angular closed mesh, with broken side faces and non-cuboid ends."""
    lx, hy, dz = map(float, dimensions)
    # Irregular decagonal silhouette around the long X axis, in YZ.
    corners = np.array([[-.44, -.46], [-.50, -.12], [-.40, .34],
                        [-.16, .49], [.29, .45], [.50, .22],
                        [.47, -.30], [.21, -.50], [-.13, -.48]], dtype=float)
    count = 17 if lintel else 9
    vertices = []
    xs = np.linspace(-lx / 2, lx / 2, count)
    for i, x in enumerate(xs):
        taper = (.79 + .21 * min(i, count - 1 - i) / max(1, (count - 1) / 2))
        if lintel:
            taper = .88 + .12 * min(i, count - 1 - i) / max(1, (count - 1) / 2)
        for j, (y, z) in enumerate(corners):
            # Chipped, relatively planar bed faces, rough sidewall.
            perturb = rng.uniform(.88, 1.10)
            yy = y * hy * taper * perturb + rng.uniform(-.017, .017) * hy
            zz = z * dz * taper * rng.uniform(.87, 1.12)
            xx = x + (0 if 0 < i < count - 1 else rng.uniform(-.024, .024) * lx)
            vertices.append([xx, yy, zz])
    faces = []
    n = len(corners)
    for i in range(count - 1):
        for j in range(n):
            a, b = i * n + j, i * n + (j + 1) % n
            c, d = (i + 1) * n + j, (i + 1) * n + (j + 1) % n
            if (i + j) % 2:
                faces.extend([(a, c, d), (a, d, b)])
            else:
                faces.extend([(a, c, b), (b, c, d)])
    left = len(vertices)
    vertices.append([xs[0], 0, 0])
    right = len(vertices)
    vertices.append([xs[-1], 0, 0])
    for j in range(n):
        faces.append((left, (j + 1) % n, j))
        faces.append((right, (count - 1) * n + j, (count - 1) * n + (j + 1) % n))
    mesh = trimesh.Trimesh(vertices=vertices, faces=faces, process=True)
    trimesh.repair.fix_normals(mesh)
    # Unit-normalize dimensions exactly, with a nonuniform source *only for generated shapes*.
    mesh.apply_scale(np.asarray(dimensions, dtype=float) / mesh.extents)
    mesh.apply_translation(-mesh.bounds.mean(axis=0))
    if not mesh.is_watertight or not mesh.is_volume:
        raise ValueError("Non-volume or open generated rock")
    return make_surface(mesh, force_uv=True)


def accepted_rock(mesh, source_id, target_long):
    rock = mesh.copy()
    align_long_axis_x(rock)
    length = float(max(rock.extents))
    rock.apply_scale(float(target_long) / length)
    rock.apply_translation(-rock.bounds.mean(axis=0))
    if abs(float(max(rock.extents)) - target_long) > .002:
        raise ValueError("Scaled rock outside target size")
    if np.any(rock.extents <= 0):
        raise ValueError("Degenerate original rock " + source_id)
    return make_surface(rock, force_uv=True)


def select(candidates, how_many, used, rng, kind):
    ordered = sorted(candidates, key=lambda e: (-e["score"], -e["sharp"], e["node"]))
    # Deterministic stratification, avoids a near-identical set of elongated shapes.
    buckets = [[], [], []]
    for item in ordered:
        idx = 0 if item["elongation"] < 1.4 else 1 if item["elongation"] < 2.1 else 2
        buckets[idx].append(item)
    result = []
    while len(result) < how_many and any(buckets):
        for idx in ((1, 0, 2) if kind == "main" else (2, 1, 0)):
            if not buckets[idx]:
                continue
            item = buckets[idx].pop(0)
            if item["signature"] in used:
                continue
            used.add(item["signature"])
            result.append(item)
            if len(result) == how_many:
                break
    return result


def build(source, output):
    rng = np.random.default_rng(SEED)
    options = gate_candidates(source)
    output.mkdir(parents=True, exist_ok=True)
    old_gate_hash = sha256(source.read_bytes())
    seen = set()
    plans = []
    # Large rocks first, then main, so distinctive large forms get preference.
    for category, donor, long_bounds in [
        ("large", "main", (.50, .70)),
        ("main", "main", (.20, .40)),
        ("chinking", "chinking", (.06, .18))]:
        chosen = select(options[donor], TARGETS[category], seen, rng, category)
        for i in range(TARGETS[category]):
            length = round(float(rng.uniform(*long_bounds)), 5)
            if i < len(chosen):
                item = chosen[i]
                mesh = accepted_rock(item["mesh"], item["node"], length)
                provenance = {"source": "gate", "gateNode": item["node"],
                              "gateCategory": donor, "sharpEdgeRatio": round(item["sharp"], 4)}
            else:
                height = length * rng.uniform(.44, .70)
                depth = length * rng.uniform(.55, .88)
                mesh = fractured_rock(rng, (length, height, depth))
                provenance = {"source": "generated"}
            plans.append((category, i + 1, mesh, provenance))
    # Real 1.0-1.5 m lintels absent from the v7 source: generate six solid, broken-edge slabs.
    for i in range(TARGETS["lintel"]):
        length = round(float(np.linspace(1.0, 1.5, TARGETS["lintel"])[i]), 5)
        height = round(float(rng.uniform(.18, .30)), 5)
        depth = round(float(rng.uniform(.20, .35)), 5)
        plans.append(("lintel", i + 1, fractured_rock(rng, (length, height, depth), lintel=True),
                      {"source": "generated"}))

    scene = trimesh.Scene(base_frame="world")
    metadata = []
    geometry_hashes = set()
    for category, serial, mesh, provenance in plans:
        name = f"{category.upper()}_{serial:03d}"
        h = geom_sha(mesh)
        if h in geometry_hashes:
            raise ValueError("Duplicate geometry: " + name)
        geometry_hashes.add(h)
        if not np.isfinite(mesh.vertices).all() or not np.isfinite(mesh.vertex_normals).all():
            raise ValueError("Nonfinite vertices or normals: " + name)
        long = max(mesh.extents)
        lo, hi = {"main": (.20, .40), "large": (.50, .70),
                  "chinking": (.06, .18), "lintel": (1.0, 1.5)}[category]
        if not lo - 1e-4 <= long <= hi + 1e-4:
            raise ValueError("Model outside dimensional range: " + name)
        scene.add_geometry(mesh, geom_name=name, node_name=name)
        metadata.append(dict(name=name, category=category,
                             sizeMeters=[round(float(x), 5) for x in mesh.extents],
                             triangles=int(len(mesh.faces)), geometrySHA256=h,
                             watertight=bool(mesh.is_watertight), **provenance))
    if sha256(source.read_bytes()) != old_gate_hash:
        raise ValueError("Source gate changed during build")
    glb = output / "common-100.glb"
    scene.export(glb)
    check = trimesh.load(glb, force="scene", process=False)
    if len(check.geometry) != 100 or set(check.geometry) != {m["name"] for m in metadata}:
        raise ValueError("GLB export changed library models")
    for model in metadata:
        mesh = check.geometry[model["name"]]
        if mesh.visual.uv is None or not mesh.is_watertight:
            raise ValueError("UVs or manifold missing: " + model["name"])
    info = {"version": VERSION, "count": 100, "counts": TARGETS,
            "sourceGate": str(source.relative_to(ROOT)),
            "sourceGateSHA256": old_gate_hash,
            "originCounts": dict(Counter(m["source"] for m in metadata)),
            "usage": {"main": "face and load-bearing wall", "large": "heavy wall and corners",
                      "chinking": "gaps only, not exposed standalone courses",
                      "lintel": "single-piece bridge over openings"},
            "glbSHA256": sha256(glb.read_bytes()), "models": metadata}
    (output / "common-100.json").write_text(
        json.dumps(info, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    assert sum(info["originCounts"].values()) == 100
    print("COMMON100_VERIFIED", info["originCounts"], glb.stat().st_size)
    return info


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--gate", type=Path, default=GATE)
    parser.add_argument("--out", type=Path, default=OUTPUT)
    args = parser.parse_args()
    build(args.gate, args.out)
