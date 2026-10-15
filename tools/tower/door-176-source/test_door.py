#!/usr/bin/env python3
"""No image rendering; validate authored GLB, materials and dimensional contracts."""
from pathlib import Path
import json,struct
import numpy as np
import trimesh
root=Path(__file__).resolve().parent
folder=root/'assets'
m=json.loads((folder/'model_manifest.json').read_text())
assert m['footprint_grid']==[7,9,2]
assert m['opening_m']=={'width':.75,'height':2.0}
assert m['section_m']=={'width':1.75,'height':2.25,'depth':.5}
assert m['rocks_used_in_section']>=120
assert m['maximum_source_rock_fullness']==.74
# Reopen the ORIGINAL authored 36 rock meshes: never accept a pseudo-cube.
import importlib.util
wpath=root/'project/tools/tower/build-prefab-library.py'
spec=importlib.util.spec_from_file_location('stone_library',wpath)
lib=importlib.util.module_from_spec(spec);spec.loader.exec_module(lib)
source=lib.normalized_rocks(root/'project/assets/tower/source-original-36.glb')
assert len(source)==36
assert all(source[idx-1]['fullness'] < m['maximum_source_rock_fullness']
           for idx in m['source_rock_ids']), 'Source rock violates non-cuboid geometry rule'
assert 5 not in m['source_rock_ids'], 'Cuboid-looking Rock005 is forbidden'
assert len(m['source_rock_ids'])>=20
assert all(p['upright_primary']==0 for p in m['packing_metrics'])
assert all(p['final_density']>p['primary_density'] for p in m['packing_metrics'])
assert all(p['final_density']>=.70 for p in m['packing_metrics'])
assert sum(p['added_authored_rubble'] for p in m['packing_metrics'])>=190
assert m['hinges']==3
assert m['lintel']['single_original_stone'] is True
assert m['lintel']['sculpted'] is True
assert m['lintel']['source_triangles']==82
assert m['lintel']['triangles']>=5000
assert 6<=m['lintel']['edge_relief_p95_mm']<=40
assert 10<=m['lintel']['edge_relief_max_mm']<=55
assert m['wood_and_iron_parts']>95
assert m['stone_triangles']>10000
assert m['wood_metal_triangles']>5000
assert m['original_rock_count']==36
assets=['AlanTil_door_stone_section_wild_7x9x2.glb','AlanTil_wooden_door_0.75x2m.glb','AlanTil_door_complete_wild_7x9x2.glb']
for name in assets:
    p=folder/name;b=p.read_bytes()
    assert len(b)>900000
    assert b[:4]==b'glTF' and int.from_bytes(b[8:12],'little')==len(b)
    jsonsize,kind=struct.unpack_from('<II',b,12)
    assert kind==0x4e4f534a
    j=json.loads(b[20:20+jsonsize].decode())
    assert j['asset']['version']=='2.0'
    assert len(j['materials'])>=1
    assert len(j['meshes'])>=1
    assert len(j['images'])>=1
    s=trimesh.load(p,force='scene')
    assert len(s.geometry)>0 and len(s.graph.nodes_geometry)>0
    print('CHECKED',name,len(b),'bytes',len(s.geometry),'geometries')
stone=trimesh.load(folder/assets[0],force='scene')
wood=trimesh.load(folder/assets[1],force='scene')
complete=trimesh.load(folder/assets[2],force='scene')
assert len(stone.geometry)==4 and len(wood.geometry)==4 and len(complete.geometry)==8
assert -1.001<=stone.bounds[0,1]<=-0.999
assert 1.24<stone.bounds[1,1]<1.25
assert -0.876<stone.bounds[0,0]<-0.85
assert .85<stone.bounds[1,0]<.876
assert -0.378<wood.bounds[0,0]<-.368
assert .368<wood.bounds[1,0]<.378
assert -1.005<wood.bounds[0,1]<-.99
assert .99<wood.bounds[1,1]<1.005
# No natural-rock vertices in the structural door opening; no rectangle fillers.
for mesh in stone.geometry.values():
    v=np.asarray(mesh.vertices)
    forbidden=(np.abs(v[:,0])<.374)&(v[:,1]<1.001)&(v[:,1]>-1.005)
    assert not forbidden.any(),'Natural stone obstructs the door opening'
assert all('stone' in x for x in stone.geometry)
assert any('iron' in x for x in wood.geometry)
# Metal/wood/stone PBR must contain diffuse+normal+roughness maps.
GLB=(folder/assets[2]).read_bytes();jsonsize=struct.unpack_from('<I',GLB,12)[0]
j=json.loads(GLB[20:20+jsonsize].decode())
materials=j['materials']
assert any('Wood Shutter' in x['name'] for x in materials)
assert any('Rust Coarse 01' in x['name'] for x in materials)
for x in materials:
    if 'Wood Shutter' in x['name'] or 'Rust Coarse' in x['name']:
        assert x.get('normalTexture') is not None
        assert x.get('pbrMetallicRoughness',{}).get('metallicRoughnessTexture') is not None
h=(root/'AlanTil_door_wild_3D_preview.html').read_text(encoding='utf-8')
assert len(h)>8000000 and 'const SOURCE=' in h
assert 'data-view="front"' in h and 'data-layer="stone"' in h
assert 'GLTFLoader' in h and 'interactive software 3D' in h
print('ALL_DOOR_TESTS_PASS',m['stone_triangles']+m['wood_metal_triangles'],'triangles')
