import {FACE_DEFS} from './constants.js';
export function faceValue(face){return FACE_DEFS.find((item)=>item.id===face)?.value??1;}
function rotateAxisByQuaternion(axis,q){const [x,y,z]=axis,qx=q.x??q[0]??0,qy=q.y??q[1]??0,qz=q.z??q[2]??0,qw=q.w??q[3]??1;const ix=qw*x+qy*z-qz*y,iy=qw*y+qz*x-qx*z,iz=qw*z+qx*y-qy*x,iw=-qx*x-qy*y-qz*z;return [ix*qw+iw*-qx+iy*-qz-iz*-qy,iy*qw+iw*-qy+iz*-qx-ix*-qz,iz*qw+iw*-qz+ix*-qy-iy*-qx];}
export function topFace(bodyOrQuaternion){const q=bodyOrQuaternion?.quaternion||bodyOrQuaternion;let best=FACE_DEFS[0],bestDot=-Infinity;for(const candidate of FACE_DEFS){const [,y]=rotateAxisByQuaternion(candidate.axis,q||{x:0,y:0,z:0,w:1});if(y>bestDot){bestDot=y;best=candidate;}}return best.id;}
export function faceDefinition(face){return FACE_DEFS.find((item)=>item.id===face)||FACE_DEFS[5];}
