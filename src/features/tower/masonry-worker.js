import {ROCK_PACK} from '../../../assets/tower/processed-rocks.mjs';
import {buildStoneProfiles} from '../../../packages/tower-game/masonry-geometry.mjs';
import {packMasonryVolume} from '../../../packages/tower-game/masonry-packing.mjs';

// Created once; reuse geometry profiles and unchanged joint meshes across revisions.
const profiles=buildStoneProfiles(ROCK_PACK);
const cache=new Map();

self.onmessage=({data})=>{
 const {generation,blocks,layer,mobile}=data;
 try{
  const visible=layer===null?blocks:blocks.filter(b=>b.y<=layer);
  const result=packMasonryVolume(visible,profiles,{
   cache,spacing:mobile?.23:.18,maxTriangles:mobile?90000:200000,
  });
  self.postMessage({generation,result},[
   result.stonePositions.buffer,result.stoneColors.buffer,
   result.mortarPositions.buffer,result.mortarColors.buffer,
  ]);
 }catch(error){
  self.postMessage({generation,error:String(error?.message||error)});
 }
};
