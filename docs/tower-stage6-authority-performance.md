# AlanTil Tower 17.1 — Stage 6: certified source geometry and nonpenetrating visual masonry

## Audit and intervention plan

Baseline `ee7211f0ca9f062ae8c1318f69213a2c4ecc433b`.

- **Persistence:** retain `private.tower_v2_elements`, `private.tower_accounts`, public `mutate_tower_v2`, idempotent receipts and V1 elements exactly as they are. Do not write visual infill, fitted coordinates or ephemeral triangles to the database. Server's conservative convex-hull geometry remains authoritative for placement, deletion, support, currency, and revision.
- **Read-only provenance:** `20261012212500_tower_v2_authoritative_geometry_manifest.sql` adds `public.get_tower_v2_geometry(p_user_id)`, which returns every saved body's *original* PostgreSQL-computed vertices and face indices for one revision. Grant to `authenticated` only. The client compares 100% of vertices and faces to its local immutable source mesh (`tower-v2-authority.mjs`); a mismatch/stale revision fails closed and hides the cosmetic mortar/pebbles without interfering with real purchases. This endpoint exposes no wallet or private user data, no client-provided shape data is trusted, and it does not grant new write privileges.
- **Mathematically conservative visual envelope:** `masonry-v2-envelope.mjs` uses only canonical authored source bounds. For each pair, compute the largest **separating world AABB axis gap**. Bound both cosmetic fitted stone displacements by `(gap - 1mm) / 2`, with a maximum of 20mm. This is intentionally more conservative than server SAT. Because the sum of the two independent Euclidean displacements is less than the certified separating distance, neither rendered convex hull can enter the other's server-authorized hull. When AABBs overlap in all axes, the maximum safe warp is zero, even if the full server SAT might allow a larger warp. Ground-plane and inverted-face guards still apply.
- **Shared presentation step in a Web Worker:** `masonry-v2-presentation.mjs` builds the source bodies and 20mm display-only surface fits off the UI thread; `masonry-worker.js` sends fitted position buffers and source-stone infill buffers in one versioned response. The scene uses `rebuild(true)` to apply geometry *without* recursing into another calculation. Generation IDs discard stale worker output.
- **No filler-through-stone visuals:** source-only infill candidate placement is always checked against both the canonical source triangles and any certified fitted face triangles. New cosmetic infill is additionally checked against unrelated fitted stone hulls. A candidate can be **rejected**, but never accepted solely because it fits a non-authoritative visual warp. Only seven original small source meshes are used, and they cannot be selected, purchased or used as supporting blocks.
- **Cache & QA:** tower-only asset cache `17.1.7` in router/index/scene/style. Global app version and all unrelated navigation stay unchanged. `tests/tower-v2-envelope-stage6.test.mjs`, `tower-v2-authoritative-geometry-stage6.test.mjs`, SQL integration in PostgreSQL 17, Chromium desktop WebGL, emulated 390px mobile width with 50 saved rocks.

## Safety / performance gates

1. All 23 authored original meshes and seeded PostgreSQL model data remain unchanged.
2. V1 and V2 monetary RPC signatures and account/receipt data unchanged. Source vertices and faces of each persisted stone are checked against the server manifest for the **exact** revision.
3. The certified two-stone axis gap always exceeds the sum of allowed visual displacements plus the 1mm reserve. Static original server convex hulls remain separated even when the display skins are fitted.
4. GPU source-only infill never appears on a stale/invalid geometry manifest and is never saved. Regression tests check exact source triangle provenance, empty/nonmatching cases, and deterministic reload ordering.
5. Offscreen V2 worker processing is bounded for 50 stones; front-end does not ray-cast hundreds of triangles on the main thread for each tower rebuild. Browser QA logs actual elapsed worker computation and mobile layout. No claim of real Android FPS unless tested on the device.

## Explicit limitations

This **does not** create physically load-bearing rubble, deformable saved stone meshes, or server-authoritative *new* geometry. Open source meshes are not watertight; volume and friction cannot be proven from this data. Cosmetic adjustments and small rocks remain disposable presentation derived from authentic saved poses. The source-model detail is low-poly. The new manifest does not replace `mutate_tower_v2`'s collision or support tests. Actual Android GPU and thermal performance remains to be measured on a physical device.
