#!/usr/bin/env python3
"""Decode exact complete readable 17.5.4 packer source from temporary transport."""
import base64,hashlib,lzma,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
payload=(ROOT/'tools/tower/gate-stone-baker-source.lzma.b64').read_text().strip()
source=lzma.decompress(base64.b64decode(payload))
assert hashlib.sha256(source).hexdigest()=='a84c251802a5cbdecfadaa23fee8f88ffaa275515f6165c87eb8bb49ebe7c1c6'
dst=ROOT/'tools/tower/bake-gate-stones-1754.py'
dst.write_bytes(source)
print('RESTORED_COMPLETE_BAKER',len(source),dst,flush=True)
