# AlanTil 17.6 — bonded window masonry prefab

## Asset

- File: `assets/tower/prefabs/architectural/window-4x5x2-v1.glb`
- SHA-256: `7aeb7dc93717f1787418b97f8dccf55ca9a41f1244ffb92832147f765a4dfab1`
- Size: 5,363,552 bytes (original checked in GitHub Actions)
- Mesh: 80 authored natural-stone pieces and one monolithic stone lintel
- Three.js coordinate system: Y up; overall X × Y × Z = 1.00 × 1.25 × 0.50 metres
- Clear opening: 0.50 × 1.00 metres. Prefab occupies 4 × 5 × 2 grid cells of 0.25 metres.

The lintel is **temporary**, inherited from the earlier v1 asset. It has not
been substituted with the original lintel from historic window 11 v3.

## Integration

- Client prefab ID `window-4x5x2`, version `17.6-window.1`, only variant 0.
- `packages/tower-game/prefab-layout.mjs` defines footprint and rotated bounds.
- `src/features/tower/index.js` exposes the prefab in the existing catalogue.
- `src/features/tower/prefab-scene.js` uses the prebuilt GLB with no generated
  cuboids or runtime stone packing.
- Prepared historical section GLBs, historic purchase data, wallet, authentication,
  and current navigation remain untouched.
- Ordinary seam connectors are not drawn against the window section because
  they could fill the aperture; matched architectural joints are future work.
- SQL migration `20261015140000_tower_window_prefab_176.sql` adds exactly this
  section type/version while retaining earlier V3 variants.
- Old V3 sections are not migrated or rewritten.

## Verification and limitations

GitHub Actions 'Restore authored window GLB' run 38715778426:
exact SHA-256 check and four Node test suites passed. The migration was applied
to the linked alantil-app Supabase project on 2026-10-15. Direct read-only SQL
checks confirmed both orientations, canonical acceptance and preservation of
21 existing saved sections. End-to-end authenticated browser WebGL placement
and mobile performance are **not** covered by those checks.

**Performance**: Game GLB has 268,000 triangles; test real mobile devices
with multiple placed window sections before wider release.
**Geometry**: Cuboid placement envelope represents wall width including empty
window opening; validation does not simulate load, friction, or arch stability.
