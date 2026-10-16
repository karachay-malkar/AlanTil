#!/usr/bin/env python3
"""Commit ten verified GLB models with GitHub Git Database API; works without a .git checkout.
Runs only in an authenticated GitHub Actions job, after geometric SHA validation.
Does not update application code, user data, or unrelated assets.
"""
import base64
import json
import os
import pathlib
import urllib.request
import urllib.error

ROOT=pathlib.Path(__file__).resolve().parents[2]
REPO=os.environ["GITHUB_REPOSITORY"]
TOKEN=os.environ["GH_TOKEN"]
BRANCH="agent/wild-masonry-5-variants-20261016"
API="https://api.github.com/repos/"+REPO
HEADERS={
    "Authorization":"Bearer "+TOKEN,
    "Accept":"application/vnd.github+json",
    "X-GitHub-Api-Version":"2022-11-28",
    "User-Agent":"AlanTil-approved-wild-3D-baker",
}
def api(method,path,payload=None):
    data=json.dumps(payload).encode("utf-8") if payload is not None else None
    req=urllib.request.Request(API+path,data=data,headers=HEADERS,method=method)
    if data is not None:req.add_header("Content-Type","application/json")
    with urllib.request.urlopen(req,timeout=180) as resp:return json.load(resp)

def main():
    head=api("GET","/git/ref/heads/"+BRANCH)["object"]["sha"]
    original_tree=api("GET","/git/commits/"+head)["tree"]["sha"]
    entries=[]
    for kind in ("2x2x2","4x4x4"):
        for i in range(5):
            path="assets/tower/prefabs/wild-section-"+kind+"-v"+str(i)+"-17_5_3.glb"
            b=(ROOT/path).read_bytes()
            assert b[:4]==b"glTF" and len(b)>100000
            result=api("POST","/git/blobs",{
                "content":base64.b64encode(b).decode("ascii"),"encoding":"base64"})
            entries.append({"path":path,"mode":"100644","type":"blob","sha":result["sha"]})
            print("UPLOADED",path,len(b),flush=True)
    report="docs/tower/wild-pilot-metrics-17_5_3.json"
    b=(ROOT/report).read_bytes()
    metrics=api("POST","/git/blobs",{"content":b.decode("utf-8"),"encoding":"utf-8"})
    entries.append({"path":report,"mode":"100644","type":"blob","sha":metrics["sha"]})
    tree=api("POST","/git/trees",{"base_tree":original_tree,"tree":entries})["sha"]
    if tree==original_tree:
        print("UP_TO_DATE")
        return
    commit=api("POST","/git/commits",{
        "message":"assets(tower): add ten geometry-verified wild masonry GLBs 17.5.3",
        "tree":tree,
        "parents":[head]
    })["sha"]
    api("PATCH","/git/refs/heads/"+BRANCH,{"sha":commit,"force":False})
    print("PUSHED",commit,flush=True)

if __name__=="__main__":main()
