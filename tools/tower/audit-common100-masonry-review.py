#!/usr/bin/env python3
"""Independent acceptance gates for the staged, NEVER production masonry library."""
from __future__ import annotations
import hashlib,json
from pathlib import Path
import numpy as np
import trimesh

ROOT=Path(__file__).resolve().parents[2]
P=ROOT/"assets/tower/prefabs/common100"
PACK=P/"masonry-review-v1.json"
SOURCE=P/"common-100.glb"
SECTIONS={"1x1x1":(1,1,1),"2x2x2":(2,2,2),"2x2x3":(2,2,3),
          "2x3x4":(2,3,4),"4x4x4":(4,4,4)}
ARCH={"window":(4,5,2),"door":(7,9,2),"gate":(18,10,2)}
JOINT={"joint-x":(2,1,1),"joint-y":(1,1,2),
       "joint-z":(1,2,1),"joint-corner":(1,1,1)}
def main():
    j=json.loads(PACK.read_text("utf8"))
    meta=json.loads((P/"common-100.json").read_text("utf8"))
    s=trimesh.load(SOURCE,force="scene",process=False)
    assert j["previewOnly"] and not j["productionIntegrated"]
    assert j["sourceVersion"]==meta["version"]=="17.7-common100.10"
    assert j["sourceSHA256"]==hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    assert len(s.geometry)==100 and len(j["cases"])==32
    id_pairs=[(c["id"],c["variant"]) for c in j["cases"]]
    assert len(set(id_pairs))==32
    allowed={**SECTIONS,**ARCH,**JOINT}
    for typ in SECTIONS:
        assert {v for n,v in id_pairs if n==typ}==set(range(5))
    for typ in {**ARCH,**JOINT}:
        assert {v for n,v in id_pairs if n==typ}=={0}
    used=set()
    reports=[]
    for case in j["cases"]:
        name=case["id"];size=np.asarray(allowed[name],dtype=float)*.25
        assert case["cells"]==list(allowed[name]),name
        quality=case["quality"]
        assert quality["rocks"]==len(case["placement"])>0,name
        assert len(case["placement"])<=512,name
        assert quality["overlapVoxels"]<=len(case["placement"])*4,(name,quality)
        assert 0.<quality["estimatedEnvelopeFill"]<=1,(name,quality)
        assert len(quality["faceCoverage"])==6,name
        assert all(0<=v<=1 for v in quality["faceCoverage"]),name
        for row in case["placement"]:
            assert len(row)==13,(name,"bad transform")
            model=row[0]; assert model in s.geometry,(name,model)
            used.add(model)
            M=np.array([[*row[1:5]],[*row[5:9]],[*row[9:13]],[0,0,0,1]])
            A=M[:3,:3];t=M[:3,3]
            singular=np.linalg.svd(A,compute_uv=False)
            assert singular[0]/singular[-1]<1.0001,(name,model,"anisotropic scaling")
            bbox=np.asarray(s.geometry[model].bounds)
            points=np.array([[bbox[i,0],bbox[j,1],bbox[k,2]] for i in (0,1) for j in (0,1) for k in (0,1)])
            v=(points@A.T+t)
            assert np.all(v.min(axis=0)>=-size*.5-.003),(name,model,"outside min")
            assert np.all(v.max(axis=0)<=size*.5+.003),(name,model,"outside max")
        if name in ("window","door"):
            assert any(row[0].startswith("LINTEL_") for row in case["placement"]),name
        reports.append({"name":name,"variant":case["variant"],
                        "rocks":quality["rocks"],"envelopeFill":quality["estimatedEnvelopeFill"],
                        "minFace":min(quality["faceCoverage"])})
    # Every X-adjacent pair has its own OFFLINE chinking bridge recipe.
    assert len(j.get("seams",[]))==25,"Missing seam recipes"
    for seam in j["seams"]:
        name=seam["id"];v=seam["variant"]
        assert name in SECTIONS and 0<=v<5 and seam["nextVariant"]==(v+1)%5
        q=seam["quality"]
        assert q["supportedBridgingStones"]==len(seam["placement"])
        assert 0<=q["afterOpenInterfaceVoxels"]<=q["beforeOpenInterfaceVoxels"]
        size=np.asarray(SECTIONS[name],dtype=float)*.25
        size[0]*=2
        for row in seam["placement"]:
            assert len(row)==13 and row[0] in s.geometry
            M=np.asarray([[*row[1:5]],[*row[5:9]],[*row[9:13]]])
            A=M[:,:3];t=M[:,3]
            bounds=s.geometry[row[0]].bounds
            pts=np.array([[bounds[i,0],bounds[k,1],bounds[m,2]] for i in (0,1) for k in (0,1) for m in (0,1)])
            out=pts@A.T+t
            assert np.all(out.min(axis=0)>=-size/2-.004),(name,v,"seam out of bounds")
            assert np.all(out.max(axis=0)<=size/2+.004),(name,v,"seam out of bounds")
    print("MASONRY_X_SEAMS_QA",len(j["seams"]),"bridges",
          sum(len(x["placement"]) for x in j["seams"]))
    # Stone libraries and all original prefab assets remain untouched:
    # This preview does not write into manifest.json, SQL or runtime source.
    print("MASONRY_REVIEW_ISOLATED_PREVIEW_QA_PASS",
          "cases",len(reports),"unique_stones",len(used),"min_fill",
          min(x["envelopeFill"] for x in reports),"max_fill",
          max(x["envelopeFill"] for x in reports),flush=True)
    print(json.dumps(reports,separators=(",",":")),flush=True)
    print("GATE_LIMITATION: Gate piers only; retaining original spanning header requires a separate architectural review")
if __name__=="__main__":main()
