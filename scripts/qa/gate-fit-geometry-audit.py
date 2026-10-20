#!/usr/bin/env python3
"""Audit original 4.5×2.5×0.5 m gate GLB using real vertices and hierarchy.

Print+write compact JSON for section-border design; never modifies input GLB.
"""
from pathlib import Path
from collections import defaultdict
import json, struct, sys
import numpy as np

GLB=Path("assets/tower/prefabs/architectural/gate-18x10x2-v7.glb")
OUT=Path("gate-fit-review/audit-v8.json")
data=GLB.read_bytes()
assert data[:4]==b"glTF" and struct.unpack_from("<I",data,8)[0]==len(data)
p=12;chunks={}
while p<len(data):
 size,typ=struct.unpack_from("<I4s",data,p);p+=8
 chunks[typ]=data[p:p+size];p+=size
doc=json.loads(chunks[b"JSON"]);raw=chunks[b"BIN\x00"]
accessors=doc["accessors"];views=doc["bufferViews"];nodes=doc["nodes"];meshes=doc["meshes"];materials=doc.get("materials",[])
comps={5120:("b",1),5121:("B",1),5122:("h",2),5123:("H",2),5125:("I",4),5126:("f",4)}
dims={"VEC3":3,"VEC2":2,"VEC4":4,"SCALAR":1}
def positions(idx):
 a=accessors[idx];v=views[a["bufferView"]];fmt,byte=comps[a["componentType"]];length=dims[a["type"]]
 offset=v.get("byteOffset",0)+a.get("byteOffset",0);stride=v.get("byteStride",byte*length)
 # glTF supports interleaved attributes
 if fmt=="f" and stride==12:
  return np.frombuffer(raw,dtype="<f4",count=a["count"]*3,offset=offset).reshape(-1,3).astype(np.float64)
 dtype=np.dtype("<"+fmt.lower()) if fmt!="f" else np.dtype("<f4")
 return np.stack([np.frombuffer(raw,dtype=dtype,count=1,offset=offset+i*stride+j*byte)[0]
   for i in range(a["count"]) for j in range(length)]).reshape(-1,length).astype(np.float64)
def matrix(n):
 if "matrix" in n:return np.array(n["matrix"],dtype=np.float64).reshape(4,4,order="F")
 t=n.get("translation",[0,0,0]);sx,sy,sz=n.get("scale",[1,1,1]);x,y,z,w=n.get("rotation",[0,0,0,1])
 q=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
  [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
  [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]],dtype=np.float64)
 m=np.eye(4);m[:3,:3]=q@np.diag([sx,sy,sz]);m[:3,3]=t
 return m
items=[]
def visit(nodeid,parent):
 node=nodes[nodeid];world=parent@matrix(node)
 if "mesh" in node:
  mesh=meshes[node["mesh"]]
  for primitive in mesh["primitives"]:
   if "POSITION" not in primitive["attributes"]:continue
   midx=primitive.get("material",-1)
   name=materials[midx].get("name","") if 0<=midx<len(materials) else ""
   nname=node.get("name","")
   pts=positions(primitive["attributes"]["POSITION"])
   pts=pts@world[:3,:3].T+world[:3,3]
   classification="rock" if "ROCK" in (name+" "+nname).upper() else "wood" if "WOOD" in (name+" "+nname).upper() else "iron" if "IRON" in (name+" "+nname).upper() else "other"
   items.append({"meshOrder":len(items),"node":nodeid,"name":nname,"material":name,"kind":classification,
     "vertices":len(pts),"min":pts.min(axis=0).tolist(),"max":pts.max(axis=0).tolist()})
 for child in node.get("children",[]):visit(child,world)
for node in doc["scenes"][doc.get("scene",0)]["nodes"]:visit(node,np.eye(4))
def bounds(parts):
 if not parts:return None
 return {"min":np.min([p["min"] for p in parts],axis=0).round(6).tolist(),
 "max":np.max([p["max"] for p in parts],axis=0).round(6).tolist()}
groups=defaultdict(list)
for item in items:groups[item["kind"]].append(item)
raw_bounds=bounds(items);bottom=raw_bounds["min"][1];shift=-1.25-bottom
sx=1.011
for item in items:
 lo=np.array(item["min"]);hi=np.array(item["max"])
 # For audit of overall X scale, apply gate scale at root. Per-part mesh 101
 # is a distinct correction and will be measured in the final baked artifact.
 item["gameMin"]=np.round([lo[0]*sx,lo[1]+shift,lo[2]],6).tolist()
 item["gameMax"]=np.round([hi[0]*sx,hi[1]+shift,hi[2]],6).tolist()
def group_game_bounds(parts):
 if not parts:return None
 return {"min":np.min([p["gameMin"] for p in parts],axis=0).round(6).tolist(),
 "max":np.max([p["gameMax"] for p in parts],axis=0).round(6).tolist()}
# Target section is centered in local coordinates: X +/-2.25, Y +/-1.25, Z +/-0.25.
rock=groups["rock"]
edge={}
for side,limit,metric in [("left",-2.25,lambda p:p["gameMin"][0]),
                          ("right",2.25,lambda p:p["gameMax"][0])]:
 stoneedge=(min if side=="left" else max)([metric(p) for p in rock]) if rock else None
 closest=sorted(rock,key=lambda p:abs(metric(p)-limit))[:18]
 edge[side]={"sectionPlane":limit,"nearestRockExtent":stoneedge,"gap":round(stoneedge-limit,6) if stoneedge is not None else None,
 "boundaryStoneCandidates":[{"meshOrder":p["meshOrder"],"name":p["name"],"material":p["material"],"min":p["gameMin"],"max":p["gameMax"]} for p in closest]}
summary={"source":str(GLB),"meshCount":len(items),"materials":{str(i):mat.get("name","") for i,mat in enumerate(materials)},
 "meshKinds":{k:len(v) for k,v in groups.items()},
 "sourceBounds":raw_bounds,"gameApproxBoundsAfterRootStretch":group_game_bounds(items),
 "boundsByKind":{k:group_game_bounds(v) for k,v in groups.items()},
 "targetBounds":{"min":[-2.25,-1.25,-0.25],"max":[2.25,1.25,0.25]},
 "rawBottomShift":round(shift,6),"sideEdges":edge,
 "allMeshes":[{k:item[k] for k in ("meshOrder","node","name","material","kind","vertices","gameMin","gameMax")} for item in items]}
OUT.parent.mkdir(parents=True,exist_ok=True)
OUT.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({k:v for k,v in summary.items() if k!="allMeshes"},ensure_ascii=False,indent=2))
print("AUDIT_COMPLETE",OUT,len(items))
