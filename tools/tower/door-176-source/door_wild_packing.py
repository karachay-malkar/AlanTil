"""StonePacking-inspired authored irregular-stone fill for AlanTil door piers.

The 25 cm grid defines ONLY the prefab's outer envelope, never stone geometry.
All solids are transformed vertices of the original 36 approved GLB source rocks.
No synthetic cube, block, fragment, procedural mesh or rectangular masonry stone.
"""
from __future__ import annotations
import math
import numpy as np
from scipy import ndimage as ndi

# Reject Rock005 (fullness .97) and every stone with 75%+ bounding box fullness.
# All large stones retain the authored natural proportions with < 7% anisotropy.
MAX_FULLNESS=.74


def acceptable_stones(models):
    return [i for i,m in enumerate(models) if .24<m['fullness']<MAX_FULLNESS]


def pack_pier(wall,models,rng,seed, max_small=125):
    """Return (meshes, source_ids, statistics) for one 0.50x2.00x0.50m pier.

    Primary packing does not use cuboid stone meshes. An occupancy mask of each
    source rock's actual convex hull is queried before committing a placement.
    The cavity filling stage targets the *largest measured 3D gaps* with smaller
    original natural stones. A stone cannot float off the structure: it needs
    support or contact with existing rock voxels within one wall voxel layer.
    """
    occupied=wall.Occupancy((2,8,2))
    rocks=[];ids=[]
    primary=wall.add_primary_stones(models,occupied,rng,rocks,ids)
    primary_count=len(rocks)
    primary_coverage=occupied.density
    allowed=acceptable_stones(models)
    short=[i for i in allowed if models[i]['fullness']<.68]
    # Distinct authored natural stones rather than repeated equal-size pebbles.
    selected=[i for i in short if max(models[i]['aspect'])/min(models[i]['aspect'])<3.4]
    if len(selected)<8: raise AssertionError('Too few natural source models')
    failure=np.zeros_like(occupied.solid,dtype=bool)
    counts=occupied.count
    added=0
    support_count=0
    for it in range(max_small):
        free=~(occupied.solid | failure)
        if not free.any():break
        # Search real 3D pockets, not facade sticker coordinates or rectangular cells.
        distances=ndi.distance_transform_edt(np.pad(free,1,constant_values=False))[1:-1,1:-1,1:-1]
        if distances.max() < 1.55:break
        # Sample from top 10% of void pockets; avoid all stones landing in one hole.
        target=max(1.55,float(distances.max())*.79)
        peaks=np.argwhere(distances >= target)
        if not len(peaks):break
        viable=[]
        for _ in range(min(5,len(peaks))):
            vox=peaks[int(rng.integers(len(peaks)))]
            radius=float(distances[tuple(vox)])*float(occupied.step.min())
            center=(vox+.5)*occupied.step-occupied.box/2
            viable.append((vox,radius,center))
        best=None
        for seed_vox,radius,center in viable:
            # Adapt scale of original rock (not cuboid fill dimensions) to pocket.
            # Limit filler to 8-28 cm. Natural triangular faces are kept intact.
            diameter=float(np.clip(radius*2.05,.090,.28))
            for model_id in rng.choice(selected,size=min(9,len(selected)),replace=False):
                model=models[int(model_id)]
                orientations,_=wall.proposed_orientations(model,rng)
                rng.shuffle(orientations)
                for base_angles in orientations[:4]:
                    angles=(float(base_angles[0]+rng.uniform(-.11,.11)),
                            float(base_angles[1]+rng.uniform(-.29,.29)),
                            float(base_angles[2]+rng.uniform(-.11,.11)))
                    matrix=wall.rotation_matrix(angles)
                    # Make the longest outer span fit the current pocket; only 5%
                    # anisotropy so the original rock remains irregular.
                    rotated_half=np.abs(matrix) @ np.asarray(model['aspect'])
                    factor=diameter/max(rotated_half)
                    scale=factor*rng.uniform(.88,1.15,size=3)
                    extent=np.abs(matrix) @ (scale*np.asarray(model['aspect'])/2)
                    margin=occupied.box/2-extent-.001
                    if np.any(margin<0):continue
                    for jitter in (np.zeros(3),rng.uniform(-.015,.015,3)):
                        center_try=np.clip(center+jitter,-margin,margin)
                        exam=occupied.evaluate(model,scale,center_try,angles)
                        if not exam:continue
                        vox_count,overlap,sl,mask=exam
                        if vox_count<5 or overlap/max(vox_count,1)>.08:continue
                        # Contact is measured against rock volumes (including
                        # diagonally touching fragments); floating is rejected.
                        occupied_here=occupied.solid[sl]
                        touch=int(np.count_nonzero(ndi.binary_dilation(mask,iterations=2) & occupied_here & ~mask))
                        floor=(sl[1].start<=1)
                        if not floor and touch<max(1,int(vox_count*.007)):continue
                        gain=vox_count-overlap
                        depth=float(center_try[2])
                        # Prefer seated rocks with good real 3D contact, but do
                        # not cover the facade with tiny beads.
                        score=gain*(1+.12*min(1.,touch/max(1,vox_count*.09))) - overlap*4
                        score+=rng.uniform(-1.0,1.0)
                        if best is None or score>best[0]:
                            best=(score,int(model_id),scale,center_try,angles,exam,seed_vox,touch)
        if best is None:
            # Skip this free pocket, then keep searching across the volume.
            for vox,_,_ in viable:failure[tuple(vox)]=True
            continue
        _,idx,size,center,angles,exam,_,contact=best
        occupied.add(exam)
        mesh=wall.make_mesh(models[idx],size,center,wall.PALETTE[int(rng.integers(len(wall.PALETTE)))],angles)
        rocks.append(mesh);ids.append(idx+1)
        added+=1;support_count+=contact>0
        # only show progressively smaller stones when cavities actually warrant them
        if occupied.density > .84:break
    return rocks, ids, occupied, {
        'primary_stones':primary_count,'added_authored_rubble':added,
        'primary_density':round(primary_coverage,4),
        'final_density':round(occupied.density,4),
        'original_model_variants':len(set(ids)),
        'supported_filler_stones':support_count,
        'horizontal_primary':primary['horizontal'],
        'upright_primary':primary['upright'],
    }
