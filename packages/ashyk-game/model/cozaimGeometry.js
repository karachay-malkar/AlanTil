import { POS_0 } from './modelData/pos0.ts';
import { POS_1 } from './modelData/pos1.ts';
import { POS_2 } from './modelData/pos2.ts';
import { POS_3 } from './modelData/pos3.ts';
import { IDX_0 } from './modelData/idx0.ts';
import { IDX_1 } from './modelData/idx1.ts';
import { IDX_2 } from './modelData/idx2.ts';
import { IDX_3 } from './modelData/idx3.ts';
import { IDX_4 } from './modelData/idx4.ts';
import { IDX_5 } from './modelData/idx5.ts';
import { IDX_6 } from './modelData/idx6.ts';
import { IDX_7 } from './modelData/idx7.ts';

// Exact runtime mesh data from the current Ashyk game source snapshot.
export const COZAIM_SOURCE_VERTEX_COUNT = 13525;
export const COZAIM_SOURCE_TRIANGLE_COUNT = 27046;
export const COZAIM_VERTEX_COUNT = 1387;
export const COZAIM_TRIANGLE_COUNT = 2794;
export const COZAIM_POSITION_SCALE = 1 / 500000;
export const COZAIM_POSITIONS = new Int16Array([...POS_0, ...POS_1, ...POS_2, ...POS_3]);
export const COZAIM_INDICES = new Uint16Array([...IDX_0, ...IDX_1, ...IDX_2, ...IDX_3, ...IDX_4, ...IDX_5, ...IDX_6, ...IDX_7]);
