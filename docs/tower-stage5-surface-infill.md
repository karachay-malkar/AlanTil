# AlanTil 17.1 — Stage 5: real-triangle surface contact and source-only V2 infill

## Technical specification and intervention points

Current branch baseline: `0bde79e2a713ff6e5a645ebed79fb540ccefd29b`.
This release implements **derived presentation** from already server-authorized V2 stones, without changing the server's conserved geometry, wallet or saved coordinates.

* `rock-display-winding.mjs` inspects **actual face normals** of all 23 authored meshes. Three original long variants `long[1..3]` are consistently inward-facing. Only the renderer's index order is reversed for these variants. `assets/tower/processed-rocks.mjs`, `originalRockMesh()` and V2 PostgreSQL geometry remain byte-for-byte unchanged.
* `masonry-v2-fit.mjs` computes display-only vertex stretches toward the **other stone's ray-intersected real surface**, with a hard 20 mm maximum. At most 40% of the measured gap is taken from each side. Only source vertices near the corresponding exterior face move. Winding and triangle-area guards shrink deformations if necessary. Existing stones' saved transforms and server collision proxies never move.
* `masonry-v2-joints.mjs` searches three physical axis directions and samples ray intersections with original triangles. Candidate voids must be **36–160 mm** wide, overlap source surfaces, and contain no intervening stone.
* `masonry-v2-authored.mjs` compresses/rotates **seven genuine small `ROCK_PACK.small` meshes**, keeps all their original triangles and authored colors, places at most 36 mobile / 72 desktop unpickable infill pebbles. For each accepted pebble, every tested vertex, triangle centre and edge midpoint lies between two source surfaces; two-sided triangle intersection checks reject piercing through the source skins. Other source rocks and previous pebbles receive conservative SAT collision checks. No generated cubes, boxes, hidden procedural rock meshes, cuboid mortar or stone-currency operations are included.
* `src/features/tower/masonry-worker.js` dispatches `classic` to the unchanged original V1 voxel/mortar code, and `v2` to the separate source-only solver. `scene.js` enables the worker in V2 and scales output in metres rather than cells. A zero/one stone tower displays no infill.
* `src/app/router.js`, `src/features/tower/index.js`, `src/features/tower/scene.js`, `src/shared/styles/lazy/tower.css` update the isolated tower asset cache to `17.1.6`. Global app version and unrelated features stay unchanged.

## Precise guarantees

- 23/23 input models retain exact original **vertex positions, triangle counts, source bytes**. Display-only triangles for three variants have corrected winding.
- V2 mesh adaptation: source vertex count and triangle topology preserved, displacement ≤20 mm, no face orientation inversion in tests.
- V2 infill is derived deterministically, cannot be purchased, removed, targeted, counted as support or saved as a block. Stones appear only after two actual source surfaces form an eligible narrow gap.
- V1 game placement, existing visual masonry, Supabase tables/RPC, payment/revision/idempotency and old towers are unmodified.
- All source elements remain independent. The camera is never re-snapped to the grid in V2.

## Limitations requiring later work

**This is not server-authoritative deformable masonry.** PostgreSQL continues validating each undeformed source mesh's conservative convex hull. Display surfaces are fitted deterministically after loading and may differ by up to 20 mm from the authoritative hull. The small gap fillers are cosmetic and not load-bearing. Source meshes are open/non-watertight: even sampled triangle collision is not a watertight-solid proof of friction, gravity or structural stability. Gaps larger than 160 mm are intentionally *not* stuffed with unsupported fake rocks. Source mesh detail is low-poly; we did not invent vertices or download unspecified substitute models.

Before production-grade physical masonry: version and store authoritative deformation parameters, validate neighbor updates in SQL/server solver, rebuild rigid-body contact and support, and profile real low-end Android GPU. The above local tests and CI WebGL smoke test cannot replace this.
