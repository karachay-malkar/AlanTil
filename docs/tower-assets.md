# Tower downloaded assets

Downloaded on 2026-10-11 from Poly Haven. All assets are CC0-1.0; official license: https://polyhaven.com/license. Asset licensing is separate from the API service terms. Runtime uses local files, not the live Poly Haven API.

| Source | Author | Browser asset | Geometry | Textures |
|---|---|---|---:|---|
| https://polyhaven.com/a/rock_07 | Jenelle van Heerden | `assets/tower/rock_07/rock_07-lod.glb` | 370 triangles | Embedded 1024px base color, OpenGL normal, AO/roughness/metalness |
| https://polyhaven.com/a/rock_09 | Jenelle van Heerden | `assets/tower/rock_09/rock_09-lod.glb` | 310 triangles | Embedded 1024px PBR maps |
| https://polyhaven.com/a/modular_wooden_pier | Rico Cilliers | `assets/tower/modular_wooden_pier/timber-parts.glb` | 1992 triangles | Embedded 512px PBR maps |

## Provenance and limits

Rock 07 and Rock 09 are natural scan assets with rugged angular surfaces. Their original coloration includes rust-brown minerals and dark gray faces. They are NOT scans from Upper Balkaria, and must not be presented as archaeological reconstruction. They provide realistic surface geometry; color adjustment and fit to masonry are artistic adaptation. Strong LOD keeps detailed normal maps while making repeated stone instances affordable. Full original glTF+BIN+1K textures are retained for alternative processing.

Timber parts are extracted from the downloaded modular pier asset. Only named loose poles and planks are retained in the derivative; complete maritime pier assemblies are excluded. This is a source of wood geometry/materials, not a claim about historical tower construction. The runtime may reuse its PBR maps on fitted beam, plank, door, and ladder geometries.

Rejected after inspection: Stone 01 (reddish quartz pebble), Wooden Ladder / Wooden Ladder 02 (modern folding A-frame ladders), Large Castle Door (European medieval double gate). These were not retained in production assets. No downloaded historically verified tower door or notched-log ladder was found. Such items must be explicitly described as adapted geometry, not downloaded historical replicas.

## Reproducibility and verification

`assets/tower/sources.json` records exact download URLs, published MD5, independently calculated SHA-256 and byte sizes. Every original file was verified against the Poly Haven API MD5. All glTF image and buffer dependencies are present locally. `derived.json` records SHA-256, byte sizes and triangle counts of browser GLBs.

Derivatives were created with glTF Transform: weld, MeshoptSimplifier, dedup, prune. Stone simplification ratio 0.025, max error 0.05; timber ratio 0.25, max error 0.01. Timber GLB PBR maps resized to 512px JPEG quality 86. GLBs use standard geometry buffers without Draco/Meshopt compression decoder requirements.

Runtime download total of the three GLBs is approximately 3.88 MB; originals are not intended to be eagerly loaded. Shader normals/PBR maps require browser scene validation; triangle counts alone do not establish frame rate on physical phones.
