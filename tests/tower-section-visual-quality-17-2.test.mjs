import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ROCK_PACK} from '../assets/tower/processed-rocks.mjs';
import {originalRockMesh} from '../packages/tower-game/rock-shapes.mjs';
import {generateSectionStones} from '../packages/tower-game/section-masonry.mjs';
import {mapContactJoints,refineContactMesh,deformContactMesh} from '../packages/tower-game/masonry-contact.mjs';
const source=readFileSync(new URL('../src/features/tower/scene.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../src/features/tower/section-masonry-worker.js',import.meta.url),'utf8');
test('opening an existing multi-stone tower frames its bounds on first load',()=>{
 assert.match(source,/if\(!wasLoaded&&incoming\.length\)/);
});
test('section worker enforces bounded contact deformation',()=>{
 assert.match(worker,/maxDisplacement:\.12/);
});
test('real authored source mesh deformation cannot create distant needle-like vertices',()=>{
 const parent={id:'physical-test',type:'masonry_section',x:3,y:0,z:3,sx:2,sy:2,sz:2,rotation:0};
 const stones=generateSectionStones(parent);
 const contacts=mapContactJoints(stones);
 const rock=stones.find(s=>contacts.get(s.id)?.length);
 assert.ok(rock,'need a real shared face');
 const meshes=ROCK_PACK[rock.type==='stone'?'small':rock.type];
 const mesh=originalRockMesh(meshes[rock.variant],rock.variant);
 const joint=contacts.get(rock.id);
 const baseline=refineContactMesh(mesh,rock,joint);
 const result=deformContactMesh(mesh,rock,joint,{maxDisplacement:.12});
 assert.equal(result.positions.length,baseline.positions.length);
 let maxWorldShift=0;
 for(let i=0;i<result.positions.length;i+=3){
  const size=[rock.sx,rock.sy,rock.sz];
  const shift=Math.hypot(...size.map((s,k)=>(result.positions[i+k]-baseline.positions[i+k])*s));
  maxWorldShift=Math.max(maxWorldShift,shift);
 }
 assert.ok(maxWorldShift<=.1202,`deformation stretched a source rock by ${maxWorldShift.toFixed(3)} cells`);
});
