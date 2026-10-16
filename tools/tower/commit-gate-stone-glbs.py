#!/usr/bin/env python3
"""Publish 25 complete geometry GLBs, library and readable generator to GitHub staging."""
import os,json,base64,pathlib,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
REPO=os.environ['GITHUB_REPOSITORY']; TOKEN=os.environ['GH_TOKEN']
BRANCH='agent/gate-stone-masonry-1754-20261016';BASE='https://api.github.com/repos/'+REPO
HEADERS={'Authorization':'Bearer '+TOKEN,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'AlanTil-gate-stone-baker'}
def call(method,path,payload=None):
    d=json.dumps(payload).encode() if payload is not None else None
    req=urllib.request.Request(BASE+path,data=d,method=method,headers=HEADERS)
    if d is not None:req.add_header('Content-Type','application/json')
    with urllib.request.urlopen(req,timeout=180) as r:return json.load(r)
head=call('GET','/git/ref/heads/'+BRANCH)['object']['sha']
tree=call('GET','/git/commits/'+head)['tree']['sha']
files=sorted((ROOT/'assets/tower/prefabs').glob('gate-stone-section-*-17_5_4.glb'))
assert len(files)==25,len(files)
files.extend([ROOT/'assets/tower/prefabs/gate-stones-library-v1-17_5_4.glb',
              ROOT/'assets/tower/prefabs/gate-stone-17_5_4-metrics.json',
              ROOT/'tools/tower/bake-gate-stones-1754.py'])
entries=[]
for f in files:
    rel=f.relative_to(ROOT).as_posix();b=f.read_bytes()
    assert len(b)>2000
    res=call('POST','/git/blobs',{'content':base64.b64encode(b).decode('ascii'),'encoding':'base64'})
    entries.append({'path':rel,'mode':'100644','type':'blob','sha':res['sha']})
    print('UPLOADED',rel,len(b),flush=True)
newtree=call('POST','/git/trees',{'base_tree':tree,'tree':entries})['sha']
if newtree==tree:print('UNCHANGED');quit()
commit=call('POST','/git/commits',{'message':'assets(tower): bake 25 gate-stone masonry variants from 486 approved meshes','tree':newtree,'parents':[head]})['sha']
call('PATCH','/git/refs/heads/'+BRANCH,{'sha':commit,'force':False})
print('PUBLISHED_STAGING_ASSETS',commit,flush=True)
