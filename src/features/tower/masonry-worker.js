import {ROCK_PACK} from '../../../assets/tower/processed-rocks.mjs';
import {buildStoneProfiles} from '../../../packages/tower-game/masonry-geometry.mjs';
import {packMasonryVolume} from '../../../packages/tower-game/masonry-packing.mjs';
import {buildV2CertifiedPresentation} from '../../../packages/tower-game/masonry-v2-presentation.mjs';

// Created once; reuse geometry profiles and unchanged joint meshes across revisions.
const profiles=buildStoneProfiles(ROCK_PACK);
const cache=new Map();

self.onmessage=({data})=>{
 const {generation,blocks,layer,mobile,mode}=data;
 try{
  const visible=layer===null?blocks:blocks.filter(b=>b.y<=layer);
  const result=mode==='v2'?buildV2CertifiedPresentation(visible,{
   maxStones:mobile?36:72,maxJoints:mobile?90:160,steps:mobile?7:9
  }):packMasonryVolume(visible,profiles,{
   cache,spacing:.12,maxTriangles:mobile?90000:200000,
  });
  self.postMessage({generation,result},[
   result.stonePositions.buffer,result.stoneColors.buffer,
   result.mortarPositions.buffer,result.mortarColors.buffer,
   ...(result.fits||[]).map(f=>f.positions.buffer),
  ]);
 }catch(error){
  self.postMessage({generation,error:String(error?.message||error)});
 }
};
