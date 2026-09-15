export function evaluateCapture(attackerFace,targetFace,thirdPartyTouched){
  if(thirdPartyTouched)return{success:false,reasonCode:'third_piece',attackerFace,targetFace};
  if(attackerFace!==targetFace)return{success:false,reasonCode:'face_mismatch',attackerFace,targetFace};
  return{success:true,reasonCode:'capture',attackerFace,targetFace};
}
export function isInstantKytWin(attackerFace,targetFace){return attackerFace==='КЪЫТ'&&targetFace==='КЪЫТ';}
