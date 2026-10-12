/** Experimental read-only scene preview. Never accepts payments or mutations. */
import {resolveTowerV2Proposal} from '../../../packages/tower-game/tower-v2-proposals.mjs';
self.onmessage=({data})=>{
 const {requestId,revision,key,payload}=data||{};
 try{
  const result=resolveTowerV2Proposal(payload);
  self.postMessage({requestId,revision,key,result});
 }catch(e){
  self.postMessage({requestId,revision,key,result:{ok:false,reason:String(e?.message||e)}});
 }
};
