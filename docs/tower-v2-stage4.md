# AlanTil Tower 17.1 — Stage 4, versioned server geometry

## Architecture

- Legacy tower: `tower_accounts.elements`, `get_tower_snapshot`, `mutate_tower`, unchanged.
- V2 tower: `private.tower_v2_elements`, independent collection, `public.get_tower_v2_snapshot`, `public.mutate_tower_v2`.
- Economy: the same `tower_accounts.silver`, `gold`, `revision`, `tower_receipts` under `FOR UPDATE` account lock. No double spending; same operation ID cannot be used with different payload or between V1/V2.
- Geometry: seed generated from the **exact 23 packed authored source meshes** by `scripts/qa/generate-tower-v2-shapes.mjs`. PostgreSQL independently transforms vertices for each stone with the same eight rigid orientations as `scene.js`.
- Placement: real triangle surface support screen; convex-hull conservative separation SAT. Reject unknown, invalid, nonfinite, over-precision or out-of-footprint poses; do not trust client-supplied support, receipt, or cost. Due to open meshes, false rejection is preferable to false acceptance.
- Removal: full remaining-tower support screening and atomic original-currency refund. No automatic movement of placed stones.
- Routing: normal tower still uses V1. `tower_v2_preview=1` is read-only, `tower_v2_play=1` is **V2 opt-in**. No silent migration of existing towers.

## Caveats and outstanding work

This is conservative geometry, not proven real rigid-body equilibrium. PostgreSQL SAT is computationally intensive; performance and concurrency need live profiling before broad release. V2 does not store deformable seams or infill yet, and V2 supports authored stones only. Existing V1 wooden/opening items are not mixed into V2. Black surfaces and authentic high-detail GPU materials remain a separate diagnostics task. The V2 endpoint should not be enabled unless the SQL integration suite and live browser verification pass.
