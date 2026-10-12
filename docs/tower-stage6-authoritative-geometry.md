# AlanTil `17.1` — stage 6, canonical-geometry attestation and safe display

## Invariants

1. **Production authority:** `private.tower_v2_shapes` and `private.tower_v2_elements` remain the authoritative source. The original `mutate_tower_v2` RPC still verifies collision, support, owner, balance, revision and idempotency. No legacy progress, element or payment column is changed.
2. **Read-only revision-bound physical manifest:** new `private.get_tower_v2_geometry` / `public.get_tower_v2_geometry` returns `{format:2,geometryVersion:1,revision,bodies:[{id,v,f}]}` with world-metre vertex positions and face indices computed in PostgreSQL by the same `private.tower_v2_body` function used in placement validation. Only `authenticated` may execute; RLS on stored tables remains enabled.
3. **Fail closed in the viewer:** `verifyV2GeometryManifest` compares every source vertex (3 µm numerical transport tolerance), triangle index, stable stone ID and save revision against the server. Missing, stale or different input leaves the genuine stored rocks visible but switches off ALL derived fitting/infill until a matching manifest arrives. HTTP failures have the same effect. The manifest is fetched asynchronously after load/save without impacting payments.
4. **Conservative additional clearance:** `certifiedV2StretchBudgets` restricts each cosmetic displacement to half of the original AABB separating gap less a positive reserve. If two source AABBs overlap in every axis, no visual stretch is permitted even if the more precise server SAT separated their convex hulls. This can show larger real gaps, but cannot falsely display penetrating physical hulls. Any visible adjusted surface is still not a saved physical collision shape.
5. **True-source infill only:** cosmetic gap stones retain the exact authored small-rock triangles. They are independently checked against canonical original triangles, fitted visible skins and other fragments; they never become paid, pickable or structural/supporting elements. Classic V1 infill, visual/saved tower data and economics are untouched.
6. **Worker and lifecycle:** adapted vertices, fragment search and triangle checks run in the masonry Web Worker; async result generation is checked before rendering. Each load/save invalidates the prior server proof and ignores late proof responses. A failed V2 attestation cannot re-enable an older Worker response.

## Validation

- Node: `node --test tests/tower-*.test.mjs` (baseline, incl. stage-6 negative manifest tests).
- Isolated PostgreSQL: `tests/sql/tower_v2_fixture.sql`, both existing V2 migrations, new read-only migration, `tests/sql/tower_v2_integration.sql`, then `tests/sql/tower_v2_geometry_stage6.sql`. Verify 50 purchases with fractional coordinates and immutable V1 state before reading the authoritative manifest.
- WebGL Chromium: existing two modes, matched manifest ⇒ real-source infill; simulated forged vertex ⇒ zero fit/fragment and preserved two purchased stones; fresh proof ⇒ recovery; 50 saved stones at 390px viewport; no JavaScript errors.
- Mobile GPU QA: verified through Chromium/SwiftShader only. Hardware Android thermals, GPU FPS and texture quality require separate real-device measurements.

## What this does **not** claim

**Not physically authoritative deformable masonry.** PostgreSQL still validates *undeformed* source hulls, not the small cosmetic filler stones or the fitted outer triangles. The new read-only manifest makes renderer provenance verifiable, and the conservative envelope prevents cosmetic penetration across its certified separating axis. It does not prove watertightness, friction, true stone wedging, actual loads or structural stability. Physical deformable-stone purchases need a future versioned server-side deformation and rigid-body solver, plus real mobile device profiling.
