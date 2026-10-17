#!/usr/bin/env python3
"""Pack actual glTF geometry + bundled project Three.js into one offline HTML review.

Does not generate pictures. Keeps static WebGL 3D viewer interactive even when
opened as a local file on a phone. Uses esbuild with a pinned version.
"""
from __future__ import annotations
import base64, json, subprocess, tempfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
PILOT=ROOT/'assets/tower/prefabs/common94/reference-2x2x2'
GLB=ROOT/'assets/tower/prefabs/common94/common-94.glb'
TEMPLATE=ROOT/'tools/tower/review-reference-2x2x2.html'

def main():
    html=TEMPLATE.read_text('utf8')
    start='<script type="module">'
    end='</script>'
    if html.count(start)!=1:raise ValueError('reviewer template must have one ES module')
    prefix,rest=html.split(start,1)
    source,suffix=rest.split(end,1)
    patches={
        "from './three/three.module.js'":"from '../../src/vendor/three/three.module.js'",
        "from './three/addons/controls/OrbitControls.js'":"from '../../src/vendor/three/addons/controls/OrbitControls.js'",
        "from './three/addons/loaders/GLTFLoader.js'":"from '../../src/vendor/three/addons/loaders/GLTFLoader.js'",
        "loader.loadAsync('./common-94.glb')":
           "loader.parseAsync(Uint8Array.from(atob(window.__ALANTIL_GLB),x=>x.charCodeAt(0)).buffer,'')",
        "fetch('./reference-2x2x2.json').then(r=>{if(!r.ok)throw Error('JSON not found');return r.json()})":
           "Promise.resolve(window.__ALANTIL_RECIPE)",
        "fetch('./reference-2x2x2-quality.json').then(r=>{if(!r.ok)throw Error('QA not found');return r.json()})":
           "Promise.resolve(window.__ALANTIL_QUALITY)",
        "fetch('./actual-triangle-visibility.json').then(r=>{if(!r.ok)throw Error('Raycast report not found');return r.json()})":
           "Promise.resolve(window.__ALANTIL_RAYCAST)"}
    for old,new in patches.items():
        if source.count(old)!=1:raise ValueError('Missing/duplicated template binding '+old)
        source=source.replace(old,new)
    module_header,body=source.split('const mount=',1)
    source=module_header+'(async()=>{\nconst mount='+body+'\n})();'
    with tempfile.TemporaryDirectory(prefix='tower-reference-') as t:
        folder=Path(t)
        entry=ROOT/'tools/tower/_reference2x2x2_esbuild_temp_entry.mjs'
        try:
            entry.write_text(source,encoding='utf8')
            bundle=folder/'viewer.js'
            subprocess.run(['npx','--yes','esbuild@0.25.12',str(entry),'--bundle',
                 '--format=iife','--platform=browser','--target=es2020',
                 '--outfile='+str(bundle)],check=True,cwd=ROOT,timeout=180)
            runtime=bundle.read_text('utf8')
        finally:
            entry.unlink(missing_ok=True)
    globals_js=[
        'window.__ALANTIL_GLB='+json.dumps(base64.b64encode(GLB.read_bytes()).decode('ascii'))+';',
        'window.__ALANTIL_RECIPE='+json.dumps(json.loads((PILOT/'reference-2x2x2.json').read_text('utf8')),ensure_ascii=False,separators=(',',':'))+';',
        'window.__ALANTIL_QUALITY='+json.dumps(json.loads((PILOT/'reference-2x2x2-quality.json').read_text('utf8')),ensure_ascii=False,separators=(',',':'))+';',
        'window.__ALANTIL_RAYCAST='+json.dumps(json.loads((PILOT/'actual-triangle-visibility.json').read_text('utf8')),ensure_ascii=False,separators=(',',':'))+';'
    ]
    payload='\n'.join(globals_js)+'\n'+runtime
    if '</script' in payload.lower():raise ValueError('HTML script termination in bundled assets')
    final=prefix+'<script>\n'+payload+'\n</script>'+suffix
    target=PILOT/'AlanTil_reference_2x2x2_OFFLINE.html'
    target.write_text(final,encoding='utf8')
    assert target.stat().st_size>4_000_000
    assert final.count('<script>')==1
    print('OFFLINE_3D_SCENE',target,'bytes',target.stat().st_size,
          'source_models=94 glb_bytes='+str(GLB.stat().st_size),flush=True)

if __name__=='__main__':main()
