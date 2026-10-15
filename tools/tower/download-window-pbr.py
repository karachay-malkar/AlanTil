#!/usr/bin/env python3
"""Fetch the approved Poly Haven CC0 1K photographic maps for the authored AlanTil window.

This is a deterministic OFFLINE-build dependency. No CDN calls are made by the game.
The original uploaded source packs: wood_shutter_1k.blend.zip and
rust_coarse_01_1k.blend.zip. End users only download the baked GLB.
"""
import os
from pathlib import Path
import urllib.request
import json
import hashlib
import re

import cv2
import numpy as np
from PIL import Image

os.environ['OPENCV_IO_ENABLE_OPENEXR'] = '1'
ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'cc0_materials'
OUT.mkdir(parents=True, exist_ok=True)
HEADERS = {'User-Agent': 'AlanTil-Offline-Baker/17.6 (contact: https://alantil.ru)'}

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=120) as response:
        return response.read()

def candidates(obj):
    if isinstance(obj, dict):
        url = obj.get('url')
        if isinstance(url, str) and url.startswith('https://'):
            yield url
        for val in obj.values():
            yield from candidates(val)
    elif isinstance(obj, list):
        for val in obj:
            yield from candidates(val)

def asset_map(slug, suffix, formats):
    metadata = json.loads(fetch('https://api.polyhaven.com/files/' + slug))
    all_urls = list(dict.fromkeys(candidates(metadata)))
    for ext in formats:
        end = f'/{slug}_{suffix}_1k.{ext}'
        options = [url for url in all_urls if url.lower().split('?')[0].endswith(end)]
        # Some API versions enumerate maps only by their basename in include lists.
        if not options:
            options = [url for url in all_urls if url.lower().split('?')[0].endswith(f'{slug}_{suffix}_1k.{ext}')]
        if options:
            return fetch(options[0]), ext
    raise RuntimeError(f'Poly Haven CC0 map unavailable: {slug}/{suffix}, candidates={all_urls[:12]}')

def image_map(slug, suffix, normal=False, rough=False):
    raw, ext = asset_map(slug, suffix, ('exr', 'png', 'jpg') if (normal or rough) else ('jpg','png'))
    name = f'{slug}_{suffix}_1k.jpg'
    dest = OUT / name
    if ext == 'exr':
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.exr') as temp:
            temp.write(raw)
            temp.flush()
            arr = cv2.imread(temp.name, cv2.IMREAD_UNCHANGED)
        if arr is None:
            raise RuntimeError('Cannot decode EXR material map '+name)
        if arr.ndim == 3:
            if normal:
                arr = cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
                # Match source author's photographic OpenGL normal map, not sRGB color.
                arr = np.power(np.clip(arr,0,1),1/2.2)
            else:
                arr = arr.mean(axis=2)
        if rough:
            arr = np.clip(arr,0,1)
        result = Image.fromarray(np.uint8(np.clip(arr*255,0,255)), 'RGB' if arr.ndim==3 else 'L')
    else:
        import io
        result = Image.open(io.BytesIO(raw)).convert('RGB' if normal or not rough else 'L')
    result.save(dest, quality=95)
    return dest

def main():
    for slug in ('wood_shutter','rust_coarse_01'):
        for suffix in ('diff','nor_gl','rough'):
            path = image_map(slug, suffix, normal=suffix=='nor_gl', rough=suffix=='rough')
            print('CC0_PBR_OK', path.name, path.stat().st_size, hashlib.sha256(path.read_bytes()).hexdigest()[:16], flush=True)
    (OUT/'LICENSE.txt').write_text('Poly Haven CC0-1.0 materials: wood_shutter and rust_coarse_01. https://polyhaven.com/license\n',encoding='utf-8')

if __name__ == '__main__':
    main()