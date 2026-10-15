# AlanTil 17.6 — дверь + Rock Face 02 (2026-10-15)

## Geometry and material

- Original uploaded Rock Face 02 Blender pack used: diffuse, normal (GL), roughness maps.
- The supplied image is a **photogrammetry UV atlas**, not a repeatable wall texture. Offline script `tools/tower/build-rock-face-material.py` samples only photographic stone patches, eliminates dark atlas seams, quilts source-derived PBR maps. The source photos are NOT used as a naive mirrored tile.
- Every prefab masonry mesh, window stone, door stone, baked joint tile, and historic stone mesh receives the same runtime material via `src/features/tower/rock-surface.js`. Wood, iron, and glass retain their original distinct material.
- Mesh geometry is left untouched (no cubic substitutes); planar UVs are calculated from per-vertex positions and mesh normals for the photographed map. Existing prefabricated GLBs remain identical and old server saves remain readable.
- Door stone prefab: `door-7x9x2-stone-v1.glb` (1.75x2.25x0.5m, 41,042 triangles, 265 irregular authored source stones + natural lintel). Door wood PBR prefab: `door-wood-v1.glb` (5,460 triangles).
- Original model builder: `tools/tower/door-176-source/` (source/reference, no auto-rebuild in web runtime). Wood, iron and timber GLB taken unchanged from approved separate door model.

## Joining

- `doorStoneAtJoint` transforms each contact position into the door's local X/Y coordinates, honoring 0/90/180/270 rotations.
- When local x=2..5 and y=0..8 grid cells, joints are suppressed: **no stone chinking in the 0.75×2.0m opening**.
- For adjacent masonry, reuse the window-prefab's existing pre-baked 25 cm irregular rock joint tiles for x/y/z and corners. Joints receive Rock Face 02 material.
- This provides an architectural prefabricated seam and repeatable chinking; it is NOT a geometry-aware 90–95% re-packing algorithm. Known door pier density remains about 71–73% according to the model's previous voxel checks. Avoid claiming the target density has been met.

## Server

- New section `door-7x9x2`, type `masonry_section`, version `17.6-door.1`, variant 0.
- Additive migration `20261015221000_tower_door_prefab_176.sql` updates SQL whitelist, 90° dimensions, and canonical validations without changing historic records or window 17.6 saves.
- Order for real deployment: **apply both previous window migration and new door migration to Supabase**, then serve the entire updated static application and assets. The source package does not apply a migration automatically.
- No user session, learning session, favorites, analytics or global navigation logic is changed.

## Verification

- `node --check` for changed client modules, `node --test tests/tower-*.test.mjs tests/window-prefab.test.mjs tests/door-prefab.test.mjs` — 31/31 passing locally.
- New tests exercise door dimensions, orientation, stone-only joint masking, x/y/z neighbor joining, and file integrity.
- Standalone local HTML viewer includes the user-supplied Rock Face 02 processed PBR images and actual approved door geometry. Syntax is checked. Automated browser QA was blocked by Chromium administrator policy; visual GPU validation must still be done in a device browser.
- PostgreSQL integration SQL created but was NOT executed locally because `psql`/Postgres are not available in this runtime. Production migration and save/load remain unverified.
- No GitHub push or Supabase deployment completed in this package build.
