import {generateSectionStones} from './section-masonry.mjs';

export const SECTION_CELL_METERS=.25;
const finite=a=>a&&a.length>0&&[...a].every(Number.isFinite);

/**
 * Authored-source-only section tessellation. The source model buffers remain
 * immutable; each individual natural stone is independently transformed into
 * physical metres. This is a render batch, not a trusted collision hull.
 * A caller may supply a mesh contact-deformer, which is applied before transform.
 */
export function buildSectionGeometry(sections,{getModel,counts,deform=null,contacts=new Map(),stones=null,maxTriangles=250000}={}){
 if(typeof getModel!=='function'||!Array.isArray(sections)||sections.length>250||!Number.isInteger(maxTriangles)||maxTriangles<1)
  throw new TypeError('Invalid section geometry input');
 return sections.map(section=>{
  const members=stones===null?generateSectionStones(section,{rockCounts:counts||undefined}):stones.filter(rock=>rock.parent?.id===section.id);
  const positions=[],colors=[],indices=[];
  let vertexCount=0;
  for(const rock of members){
   const family=rock.type==='stone'?'small':rock.type;
   let source=getModel(family,rock.variant);
   if(deform)source=deform(source,rock,contacts.get(rock.id)||[])||source;
   if(!source||!finite(source.positions)||!finite(source.colors)||!source.indices||source.positions.length!==source.colors.length||source.positions.length%3||source.indices.length%3)
    throw new TypeError('Invalid authored rock mesh');
   const count=source.positions.length/3;
   for(let v=0;v<count;v++){
    positions.push((rock.x+rock.sx*(.5+source.positions[3*v]))*SECTION_CELL_METERS,
      (rock.y+rock.sy*(.5+source.positions[3*v+1]))*SECTION_CELL_METERS,
      (rock.z+rock.sz*(.5+source.positions[3*v+2]))*SECTION_CELL_METERS);
    colors.push(source.colors[3*v],source.colors[3*v+1],source.colors[3*v+2]);
   }
   for(const n of source.indices){
    if(!Number.isInteger(n)||n<0||n>=count)throw new TypeError('Bad authored triangle index');
    indices.push(vertexCount+n);
   }
   vertexCount+=count;
   if(indices.length/3>maxTriangles)throw new RangeError('Section exceeds GPU triangle budget');
  }
  return {id:section.id,positions:Float32Array.from(positions),colors:Float32Array.from(colors),
   indices:Uint32Array.from(indices),triangles:indices.length/3,stones:members.length};
 });
}