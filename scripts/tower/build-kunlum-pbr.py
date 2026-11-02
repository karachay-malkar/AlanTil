"""Reproducible 512px CC0 surface detail from Poly Haven PBR scans.
No network requests are made by the application at runtime.
"""
from __future__ import annotations
import io, json, hashlib, urllib.request
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance, ImageStat

ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/"assets/tower/materials/kunlum-landscape"
DEST.mkdir(parents=True,exist_ok=True)
ASSETS={"grass":"withered_grass","soil":"dry_ground_rocks","rock":"rock_boulder_dry"}
HEADERS={"User-Agent":"AlanTil-Kunlum-CC0-PBR-Build/1.0 (github.com/karachay-malkar/AlanTil)"}
def get(url,limit=15_000_000):
    if not url.startswith("https://"):
        raise ValueError("Only HTTPS source assets")
    with urllib.request.urlopen(urllib.request.Request(url,headers=HEADERS),timeout=40) as resp:
        body=resp.read(limit+1)
        if len(body)>limit:raise ValueError("Source exceeded download budget "+url)
        return body

def pick(doc,names):
    for key in names:
        category=next((value for k,value in doc.items() if k.lower()==key.lower()),None)
        if not isinstance(category,dict):continue
        for resolution in ("1k","2k"):
            variants=category.get(resolution,{})
            for fmt in ("jpg","jpeg","png"):
                candidate=variants.get(fmt,{})
                if isinstance(candidate,dict) and str(candidate.get("url","")).startswith("https://"):
                    return candidate["url"]
    return None

results={}
for biome,slug in ASSETS.items():
    info=json.loads(get("https://api.polyhaven.com/files/"+slug,limit=4_000_000))
    color_url=pick(info,("Diffuse","Color","BaseColor","Albedo"))
    normal_url=pick(info,("Normal","nor_gl","NormalGL"))
    if not color_url:raise RuntimeError("No colour map from "+slug)
    color_data=get(color_url)
    color=Image.open(io.BytesIO(color_data)).convert("RGB")
    if min(color.size)<512:raise ValueError("Source scan too small "+slug)
    color=color.resize((512,512),Image.Resampling.LANCZOS)
    normal=None
    if normal_url:
        normal_data=get(normal_url)
        normal=Image.open(io.BytesIO(normal_data)).convert("RGB").resize((512,512),Image.Resampling.LANCZOS)
    results[biome]={"slug":slug,"color":color,"normal":normal,
                    "color_url":color_url,"normal_url":normal_url,
                    "color_sha256":hashlib.sha256(color_data).hexdigest()}

# The original world-vertex biomes remain unchanged. These scan-based maps
# provide only high-frequency neutral grain/normal detail, without adding
# three costly per-fragment texture blends or changing the DEM.
rock=results["rock"]["color"].convert("L")
soil=results["soil"]["color"].convert("L")
grass=results["grass"]["color"].convert("L")
mix=Image.blend(Image.blend(rock,soil,.26),grass,.12)
mix=ImageEnhance.Contrast(mix).enhance(1.65)
mean=ImageStat.Stat(mix).mean[0]
pixels=mix.point(lambda x:max(0,min(255,round(235+(x-mean)*.70))))
albedo=Image.merge("RGB",(pixels,pixels,pixels))
normals=[(results[k]["normal"] or Image.new("RGB",(512,512),(128,128,255))) for k in ("rock","soil","grass")]
normal=Image.blend(Image.blend(normals[0],normals[1],.26),normals[2],.12)
maps={"KunlumScan_Neutral_512.webp":albedo,"KunlumScan_NormalGL_512.webp":normal}
for name,img in maps.items():
    img.save(DEST/name,format="WEBP",quality=90,method=6)
    if (DEST/name).stat().st_size>600_000:
        raise ValueError("Material too large: "+name)
meta={"license":"CC0 1.0","origin":"https://polyhaven.com","resolution":512,
      "materials":{k:{a:v for a,v in item.items() if a not in ("color","normal")}
      for k,item in results.items()},
      "files":{name:{"sha256":hashlib.sha256((DEST/name).read_bytes()).hexdigest(),
                     "bytes":(DEST/name).stat().st_size} for name in maps}}
(DEST/"manifest.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n")
print(json.dumps({"files":meta["files"],"sources":ASSETS},indent=2))
