import {UI_TOKENS} from '../alantil-ui/tokens.js';

export const DIFFICULTY_ORDER=Object.freeze(['easy','normal','hard']);
export const DIFFICULTIES=Object.freeze({
  easy:Object.freeze({id:'easy',computerShotAccuracy:.70,computerAnswerAccuracy:.50,humanShotSeconds:20,humanQuestionSeconds:15}),
  normal:Object.freeze({id:'normal',computerShotAccuracy:.85,computerAnswerAccuracy:.70,humanShotSeconds:15,humanQuestionSeconds:10}),
  hard:Object.freeze({id:'hard',computerShotAccuracy:1,computerAnswerAccuracy:1,humanShotSeconds:15,humanQuestionSeconds:7}),
});
export const FACE_DEFS=Object.freeze([
  Object.freeze({id:'КЪЫТ',axis:[1,0,0],value:6}),
  Object.freeze({id:'БИЙ',axis:[-1,0,0],value:15}),
  Object.freeze({id:'АЛЧИ',axis:[0,0,1],value:4}),
  Object.freeze({id:'ТАУ',axis:[0,0,-1],value:3}),
  Object.freeze({id:'ФОК',axis:[0,1,0],value:2}),
  Object.freeze({id:'ЧЫК',axis:[0,-1,0],value:1}),
]);
export const BOARD_REFERENCE=32.8;
export const BOARD=28;
export const BOARD_SCALE=BOARD/BOARD_REFERENCE;
export const HALF=BOARD/2;
export const BOUNDARY_RADIUS=HALF-1.48*BOARD_SCALE;
export const BOUNDARY_RESTITUTION=.26;
export const BOUNDARY_TANGENT_RETENTION=.998;
export const PHYSICS_STEP=1/60;
export const GRAVITY=9.82;
export const MAX_PULL=6.8;
export const FLAT_MAX_SPEED=40;
export const HOP_MAX_SPEED=20;
export const HOP_MAX_VERTICAL_SPEED=10;
export const HOP_MIN_SPEED=3.8;
export const HOP_MIN_VERTICAL_SPEED=3.2;
export const SHOT_CANCEL_RADIUS=.7;
export const FLOOR_Y=.11;
export const HOP_LAUNCH_CLEARANCE=.018;
export const TURN_READY_LINEAR_SPEED=.38;
export const TURN_READY_ANGULAR_SPEED=.62;
export const TURN_READY_STABLE_MS=180;
export const DEFAULT_PIECE_COUNT=10;
export const ASHYK_COLORS=Object.freeze({background:UI_TOKENS.colors.appBg,board:'#9a6840',field:'#b27b50',rim:'#70482f',ring:'#4a2e1d',bone:'#d8b784',accent:'#65491f'});
