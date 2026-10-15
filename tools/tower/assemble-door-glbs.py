#!/usr/bin/env python3
"""Reassemble the approved authored 17.6 GLBs byte-for-byte from Git source chunks.

The chunked transport is only for connector-upload limits; we never remesh or
replace natural stones. Every output is verified against the authored SHA-256.
"""
from pathlib import Path
from hashlib import sha256

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'tools/tower/door-176-source/chunks'
TARGET = ROOT / 'assets/tower/prefabs/architectural'
EXPECTED = {
  'door-7x9x2-stone-v1.glb': (3242628, 'c093128731ede5d06d3591b276b8c237179cbe5f2b85905ae27c8bc19ce46b21'),
  'door-wood-v1.glb': (6730324, '5153e62517f5208936705e6b22a293cde233a107a6b670c3b3d30b7e2af330ff'),
}

def main():
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, (size, expected_hash) in EXPECTED.items():
        parts = sorted(SOURCE.glob(f'{name}.part*'))
        if len(parts) < 2:
            raise RuntimeError(f'Missing GLB source chunks: {name}')
        data = b''.join(p.read_bytes() for p in parts)
        actual = sha256(data).hexdigest()
        if len(data) != size or actual != expected_hash:
            raise RuntimeError(f'Integrity failure for {name}: {len(data)} bytes / {actual}')
        if data[:4] != b'glTF':
            raise RuntimeError('Not a GLB: ' + name)
        path = TARGET / name
        if not path.exists() or path.read_bytes() != data:
            path.write_bytes(data)
        print('VERIFIED GLB', name, size, actual)

if __name__ == '__main__':
    main()
