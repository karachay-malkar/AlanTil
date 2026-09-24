import assert from "node:assert/strict";
import {createAshykEngine,simulateShotTrajectory} from "../../packages/ashyk-game/engine.js";
import {interpolateTrajectoryFrames,validateTrajectoryPacket} from "../../packages/ashyk-game/trajectory.js";

let seed=123456789;
const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
const live=createAshykEngine({random});
live.settleInitial();
const initialState=live.physicsSnapshot();
const alivePiece=live.getPieces().find((piece)=>piece.alive);
const pieceId=alivePiece&&alivePiece.id;
assert.ok(Number.isInteger(pieceId));

const trajectories={};
for(const mode of ["flat","hop"]){
  const trajectory=simulateShotTrajectory({initialState,pieceId,mode,directionX:1,directionZ:.15,pullLength:4,pullRatio:.65});
  trajectories[mode]=trajectory;
  assert.ok(trajectory.frames.length>=2);
  assert.ok(trajectory.frames.length<=132);
  assert.ok(trajectory.durationMs<=6500);
  assert.equal(trajectory.frames[0].t,0);
  for(const frame of trajectory.frames){
    for(const piece of frame.pieces){
      assert.equal(Object.hasOwn(piece,"velocity"),false);
      assert.equal(Object.hasOwn(piece,"angularVelocity"),false);
    }
  }
}
live.destroy();

const flat=trajectories.flat;
const packet={roomId:"r1",actorUserId:"u1",phaseSeq:7,shotId:"smoke-shot",pieceId,mode:"flat",directionX:1,directionZ:.15,pullLength:4,pullRatio:.65,...flat};
assert.equal(validateTrajectoryPacket(packet),true);

function snapshotSignature(state){
  return state.pieces.map((piece)=>({id:piece.id,alive:piece.alive,position:piece.position.map((n)=>Number(n.toFixed(5))),quaternion:piece.quaternion.map((n)=>Number(n.toFixed(6)))}));
}
function replay(delayMs,hz){
  const engine=createAshykEngine({random:()=>.42});
  assert.equal(engine.playRemoteTrajectory(packet,{startedAt:delayMs}),true);
  const dt=1/hz,frameMs=1000/hz;
  for(let t=delayMs;t<delayMs+packet.durationMs;t+=frameMs)engine.step(dt,t);
  engine.step(dt,delayMs+packet.durationMs);
  const final=snapshotSignature(engine.snapshot());
  engine.destroy();
  return final;
}
const reference=snapshotSignature(packet.finalState);
for(const delay of [50,150,300,700]){
  assert.deepEqual(replay(delay,60),reference);
  assert.deepEqual(replay(delay,120),reference);
}

const localEvents=[];
const localPlayback=createAshykEngine({random:()=>.21,onEvent:(event)=>localEvents.push(event)});
assert.equal(localPlayback.playLocalTrajectory(packet,{startedAt:2000}),true);
for(let t=2000;t<2000+packet.durationMs;t+=1000/60)localPlayback.step(1/60,t);
localPlayback.step(1/60,2000+packet.durationMs);
assert.deepEqual(snapshotSignature(localPlayback.snapshot()),reference);
assert.equal(localEvents.filter((event)=>event.type==="shotSettled").length,1);
assert.equal(localEvents.find((event)=>event.type==="shotSettled")?.shotId,"smoke-shot");
localPlayback.destroy();

const remote=createAshykEngine({random:()=>.33});
assert.equal(remote.playRemoteTrajectory(packet,{startedAt:1000}),true);
remote.step(1/60,1000+packet.durationMs/2);
const beforeAuthoritative=snapshotSignature(remote.snapshot());
const authoritative={pieces:packet.finalState.pieces.map((piece,index)=>index===0?{...piece,position:[piece.position[0]+.012,piece.position[1],piece.position[2]]}:piece)};
assert.equal(remote.applyAuthoritativeSnapshot(authoritative),true);
assert.deepEqual(snapshotSignature(remote.snapshot()),beforeAuthoritative);
remote.step(1/60,1000+packet.durationMs);
assert.deepEqual(snapshotSignature(remote.snapshot()),snapshotSignature(authoritative));
remote.destroy();

const a={t:0,pieces:[{id:1,alive:true,position:[0,0,0],quaternion:[0,0,0,1]}]};
const b={t:50,pieces:[{id:1,alive:false,position:[1,0,0],quaternion:[0,0,0,1]}]};
assert.equal(interpolateTrajectoryFrames(a,b,49).pieces[0].alive,true);
assert.equal(interpolateTrajectoryFrames(a,b,50).pieces[0].alive,false);

console.log("Ashyk trajectory Cannon smoke passed");
