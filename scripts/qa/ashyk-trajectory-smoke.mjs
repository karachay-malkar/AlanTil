import assert from "node:assert/strict";
import {createAshykEngine,simulateShotTrajectory} from "../../packages/ashyk-game/engine.js";
let seed=123456789;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const live=createAshykEngine({random});
live.settleInitial();
const initialState=live.physicsSnapshot();
const alivePiece=live.getPieces().find((piece)=>piece.alive);
const pieceId=alivePiece&&alivePiece.id;
assert.ok(Number.isInteger(pieceId));
for(const mode of ["flat","hop"]){
  const trajectory=simulateShotTrajectory({initialState,pieceId,mode,directionX:1,directionZ:.15,pullLength:4,pullRatio:.65});
  assert.ok(trajectory.frames.length>=2);
  assert.ok(trajectory.durationMs<=6500);
  assert.equal(trajectory.frames[0].t,0);
  for(const frame of trajectory.frames)for(const piece of frame.pieces){assert.equal(Object.hasOwn(piece,"velocity"),false);assert.equal(Object.hasOwn(piece,"angularVelocity"),false);}
}
live.destroy();
console.log("Ashyk trajectory Cannon smoke passed");
