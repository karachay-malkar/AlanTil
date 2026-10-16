# AlanTil 17.5.4 — new 3D masonry using EXACT 486 approved Balkar gate v7 stones

- Five section types, five complete GLB variants each: 1x1x1, 2x2x2, 2x2x3, 2x3x4, 4x4x4.
- Source is approved gate v7 GLB (SHA256 37dc0aee3bead89dba3ed5427af604c09340db0ede15ece139f9016fc920ba51).
- Preserves gate-stone mesh topology, UV, natural shapes: ONLY rigid rotations, uniform scaling and translation.
- assets/tower/prefabs/gate-stones-library-v1-17_5_4.glb holds all 486 original stones (189 large, 297 small).
- Each section renders 1–2 merged meshes for low mobile draw calls, using shared Rock Face 02.
- Historic 17.5.0,17.5.1,17.5.2,17.5.3 versions stay available and saved builds remain visually unchanged.
- Existing placement grid, joints, rotation, window, door and gate remain unchanged. No session, favorites, analytics mutations.
- Density (convex hull estimate) ranges about 48–69%, not yet 90–95%; no unsupported claims.
- Offline legacy-prefab rebuild must keep gateStoneVersions in asset manifest.
- SQL migration and full CI must pass before client release.
- Complete readable source: tools/tower/bake-gate-stones-1754.py. The temporary compressed transport file was used only to transfer the source and is not executed by the game.
