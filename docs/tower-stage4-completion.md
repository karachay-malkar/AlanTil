# AlanTil 17.1 — Stage 4 delivery verification

## Source of truth and architecture

- V1 remains the default `practice.tower` experience and stores blocks in `private.tower_accounts.elements`.
- V2 is opt-in from the tower scene via **[ Без сетки ]** (or explicit `tower_v2_play=1`); **[ Классика ]** returns to the preserved V1 tower.
- V2 uses `private.tower_v2_elements` and existing `private.tower_accounts` wallet/revision/receipts. **No conversion, copying or overwrite of V1 towers.**
- Supabase project `alantil-app` contains the existing `tower_v2_authoritative_geometry` and `tower_v2_authored_shapes` migrations, 23 authored shapes, and authenticated-only V2 mutation grants. No new live DDL or user data modification was needed for this UI integration.
- Each V2 placement is independently checked by PostgreSQL against real sourced triangles and a conservative SAT hull plus connected support samples, then charged and inserted in a single transaction. Removal verifies remaining supports and refunds the original currency. This is geometry filtering, not a proof of real rigid-body mechanical stability.
- Existing profile/session/analytics/navigation remains unchanged, except explicit user-initiated reload of the tower route when switching modes. Mode URL preserves unrelated URL parameters and the current tower path.

## Test scope

- Unit tests: mode switching, deep-link/query preservation, authorization guards and all original tower tests.
- CI: PostgreSQL with real source mesh seed, installation/removal/refund/replay/revision/ownership, 25 grid-compatible and 50 fractional ground stones (50 purchases), V1 unchanged.
- CI: headless Chromium WebGL with V2 read-only mode and V2 saved-stone opt-in, desktop and 390px mobile width, no JavaScript page errors.
- Live Supabase introspection is read-only; test fixtures exist exclusively in disposable CI PostgreSQL.

## Remaining work outside Stage 4

- Truly adaptive deformation of contacting stone faces is *not* implemented, and its collision geometry must eventually be revalidated server-side.
- Infill between real V2 stones has not been implemented; V1 has its separate render-only mortar logic. V2 cannot yet mix with V1 wooden constructions and apertures.
- Original meshes are open (not watertight), so placement may conservatively reject valid configurations. Real-device black-face diagnostics, photoreal source materials, 50-stone GPU performance and low-end Android profiling are not certified by CI.
