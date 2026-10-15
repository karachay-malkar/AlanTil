# Window masonry 17.6 — staged changes, NOT deployable yet
This branch includes code, tests and an additive SQL migration, but does NOT
include the binary GLB. Do not merge or apply SQL until the binary has been
added and all local tests plus browser verification pass.

Missing required binary:
`assets/tower/prefabs/architectural/window-4x5x2-v1.glb`
SHA-256: `7aeb7dc93717f1787418b97f8dccf55ca9a41f1244ffb92832147f765a4dfab1`
Size: 5,363,552 bytes.

It can be copied from the separately delivered integration ZIP.
Actual mesh consists of 80 unique authored natural stones and one lintel.
3D orientation Y-up; 1m width, 1.25m height, 0.5m depth;
0.50m x 1.00m clear opening. The lintel is the temporary v1 stone,
NOT the original lintel from historical 11 v3.

Once binary is added:
1. Check `sha256sum` against the SHA above.
2. Run `node --test tests/window-prefab.test.mjs tests/tower-prefab-placement-17-4.test.mjs tests/tower-prefab-joints-17-5.test.mjs`.
3. Apply SQL migration to staging Supabase, verify add/remove and legacy snapshots.
4. Verify actual preview, placement, rotation, reopening after refresh and WebGL mobile loading.
5. Only then consider merge/deployment.
