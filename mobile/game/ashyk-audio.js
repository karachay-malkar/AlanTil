import {createAudioPlayer} from 'expo-audio';

const SOURCES=Object.freeze({
  horn:require('../assets/ashyk/audio/smaller-horn-dropped-on-stone-floor.mp3'),
  clack:require('../assets/ashyk/audio/clack.mp3'),
  wood:require('../assets/ashyk/audio/wood-hard-hit.wav'),
});
const PROFILES=Object.freeze({ashyk:{threshold:.07,fullScale:5.8,cooldownMs:34},board:{threshold:.09,fullScale:7.2,cooldownMs:38},rim:{threshold:.12,fullScale:8.2,cooldownMs:42}});
const SEGMENTS=Object.freeze({
  ashyk:{weak:[['horn',8.60,.24,.86,1],['horn',17.86,.25,.9,1],['clack',0,.19,.56,1.08]],medium:[['horn',3.18,.34,.94,1],['horn',21,.31,.96,1],['clack',0,.29,.74,.99]],strong:[['horn',.98,.43,1,1],['horn',10.03,.44,1,1],['wood',0,.4,.86,.95]]},
  board:{weak:[['horn',31.28,.28,.62,1.06],['horn',34.65,.26,.62,1.03]],medium:[['horn',12,.34,.74,.96],['horn',14.8,.34,.72,.96]],strong:[['wood',0,.4,.88,1],['wood',0,.4,.82,.95]]},
  rim:{weak:[['clack',0,.2,.5,1.02],['horn',36.7,.27,.58,1.03]],medium:[['horn',23.05,.36,.75,.96],['clack',0,.31,.68,.94]],strong:[['wood',0,.4,.96,.93],['wood',0,.4,.9,.89]]},
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const now=()=>globalThis.performance?.now?.()??Date.now();
function band(kind,strength){const profile=PROFILES[kind],value=clamp((strength-profile.threshold)/Math.max(.001,profile.fullScale-profile.threshold),0,1);return value<.28?'weak':value<.67?'medium':'strong';}
function createPool(source,size){return Array.from({length:size},()=>({player:createAudioPlayer(source,{downloadFirst:true}),timer:0,last:-Infinity}));}

export function createNativeAshykAudio(){
  const pools={horn:createPool(SOURCES.horn,4),clack:createPool(SOURCES.clack,3),wood:createPool(SOURCES.wood,3)};
  const cursors={horn:0,clack:0,wood:0},lastImpact=new Map(),lastRoll=new Map();let disposed=false;
  const take=(name)=>{const list=pools[name];if(!list?.length)return null;const slot=list[cursors[name]%list.length];cursors[name]=(cursors[name]+1)%list.length;return slot;};
  const playSegment=(name,start,duration,volume,rate=1)=>{if(disposed)return;const slot=take(name);if(!slot)return;const player=slot.player;if(slot.timer)clearTimeout(slot.timer);try{player.pause();player.volume=clamp(volume,0,1);player.playbackRate=clamp(rate,.84,1.18);Promise.resolve(player.seekTo(Math.max(0,start))).then(()=>{if(disposed)return;player.play();slot.timer=setTimeout(()=>{try{player.pause();}catch{}slot.timer=0;},Math.max(35,duration*1000/player.playbackRate));}).catch(()=>{});}catch{}};
  const playImpact=(kind,strength,key)=>{const profile=PROFILES[kind];if(!profile||strength<profile.threshold)return;const time=now(),previous=lastImpact.get(key)??-Infinity;if(time-previous<profile.cooldownMs)return;lastImpact.set(key,time);const list=SEGMENTS[kind][band(kind,strength)],segment=list[Math.floor(Math.random()*list.length)];if(!segment)return;const [name,start,duration,gain,rate]=segment,normalized=clamp(Math.pow(Math.max(0,strength-profile.threshold)/profile.fullScale,.54),0,1);playSegment(name,start,duration,(.2+normalized*.8)*gain,rate*(1+(Math.random()-.5)*.04));};
  const playUiClick=()=>{const time=now(),previous=lastImpact.get('ui')??-Infinity;if(time-previous<40)return;lastImpact.set('ui',time);playSegment('clack',0,.09,.22,1.09);};
  const updateRolling=(key,linearSpeed,angularSpeed,grounded)=>{if(!grounded||(linearSpeed<.09&&angularSpeed<.85))return;const motion=Math.max(0,linearSpeed*.82+Math.min(angularSpeed,14)*.055);if(motion<.18)return;const time=now(),cooldown=clamp(172-motion*22,55,160),previous=lastRoll.get(key)??-Infinity;if(time-previous<cooldown)return;lastRoll.set(key,time);const starts=[31.28,34.65,36.7],start=starts[Math.floor(Math.random()*starts.length)];playSegment('horn',start,.1+Math.min(motion,4)*.012,clamp(.1+motion*.055,.1,.34),.92+Math.min(motion,5)*.035);};
  const unlock=()=>{};
  const dispose=()=>{disposed=true;lastImpact.clear();lastRoll.clear();for(const list of Object.values(pools))for(const slot of list){if(slot.timer)clearTimeout(slot.timer);try{slot.player.pause();slot.player.release();}catch{}}};
  return{unlock,playImpact,playUiClick,updateRolling,dispose};
}
