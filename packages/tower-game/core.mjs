export const GRID_SIZE=60, HEIGHT_LIMIT=80, GOLD_RATE=8;
const entry=(name,category,price,min,max,defaults,bridge=false)=>Object.freeze({name,category,price,min,max,defaults,bridge});
export const CATALOG=Object.freeze({
 stone:entry('Обычный камень','stone',1,[1,1,1],[1,1,1],[1,1,1]),
 medium:entry('Средний камень','stone',4,[2,1,1],[2,2,1],[2,1,1]),
 long:entry('Вытянутый камень','stone',8,[3,1,1],[5,2,1],[4,1,1],true),
 big:entry('Большой камень','stone',24,[3,2,2],[5,4,4],[4,3,3]),
 beam:entry('Балка / столб','wood',8,[8,1,1],[16,1,1],[12,1,1],true),
 deck:entry('Секция настила','wood',16,[4,1,1],[4,1,4],[4,1,4],true),
 window:entry('Окно','openings',24,[2,4,1],[4,5,1],[3,4,1]),
 door:entry('Дверь','openings',32,[2,6,1],[4,8,1],[3,8,1]),
 ladder:entry('Лестница','wood',64,[3,8,1],[3,16,4],[3,12,2]),
 roof:entry('Крыша','finish',160,[4,2,4],[40,8,40],[16,4,16],true),
});
/** A stone configuration fixes its three local dimensions; only the authored
 * mesh variant and discrete orientation may change in the placement preview.
 * Coordinates are [length, height, depth], measured in 25cm construction cells.
 * Never reorder CATALOG: its index is part of existing saved tower serialization. */
export const STONE_CONFIGURATIONS=Object.freeze({
 stone:Object.freeze([[1,1,1]]),
 medium:Object.freeze([1,2].map(y=>Object.freeze([2,y,1]))),
 long:Object.freeze(Array.from({length:6},(_,i)=>Object.freeze([3+Math.floor(i/2),1+i%2,1]))),
 big:Object.freeze(Array.from({length:27},(_,i)=>Object.freeze([3+Math.floor(i/9),2+Math.floor(i%9/3),2+i%3]))),
});
export function worldDimensions(b){const a=[b.sx,b.sy,b.sz];if(b.rotation===4)return[a[1],a[0],a[2]];if(b.rotation===5)return[a[0],a[2],a[1]];return b.rotation%2?[a[2],a[1],a[0]]:a;}
export function bounds(b){const [dx,dy,dz]=worldDimensions(b);return{x0:b.x,x1:b.x+dx,y0:b.y,y1:b.y+dy,z0:b.z,z1:b.z+dz};}
export function intersects(a,b){const A=bounds(a),B=bounds(b);return A.x0<B.x1&&A.x1>B.x0&&A.y0<B.y1&&A.y1>B.y0&&A.z0<B.z1&&A.z1>B.z0;}
export function hasSupport(blocks,b){if(b.y===0)return true;const box=bounds(b),[dx,,dz]=worldDimensions(b);const supporters=blocks.filter(a=>bounds(a).y1===b.y&&!['window','door','ladder','roof'].includes(a.type));const supported=(x,z)=>supporters.some(a=>{const A=bounds(a);return x>=A.x0&&x<A.x1&&z>=A.z0&&z<A.z1;});if(CATALOG[b.type]?.bridge){if(dx>=dz)return Array.from({length:dz},(_,i)=>supported(b.x,b.z+i)&&supported(box.x1-1,b.z+i)).every(Boolean);return Array.from({length:dx},(_,i)=>supported(b.x+i,b.z)&&supported(b.x+i,box.z1-1)).every(Boolean);}for(let x=b.x;x<box.x1;x++)for(let z=b.z;z<box.z1;z++)if(!supported(x,z))return false;return true;}
export function validatePlacement(blocks,b){const c=CATALOG[b.type];if(!c)return{ok:false,reason:'Неизвестный элемент'};if(![b.x,b.y,b.z,b.sx,b.sy,b.sz,b.rotation].every(Number.isInteger))return{ok:false,reason:'Размеры и положение должны соответствовать сетке'};if(b.rotation<0||b.rotation>(b.type==='beam'?5:3))return{ok:false,reason:'Недопустимый поворот'};if([b.sx,b.sy,b.sz].some((v,i)=>v<c.min[i]||v>c.max[i]))return{ok:false,reason:'Размер вне диапазона элемента'};const B=bounds(b);if(B.x0<0||B.z0<0||B.y0<0||B.x1>GRID_SIZE||B.z1>GRID_SIZE||B.y1>HEIGHT_LIMIT)return{ok:false,reason:'Элемент выходит за границы участка'};if(blocks.some(a=>a.id!==b.id&&intersects(a,b)))return{ok:false,reason:'Это место занято'};if(!hasSupport(blocks.filter(a=>a.id!==b.id),b))return{ok:false,reason:c.bridge?'Нужна опора с обеих сторон':'Нужна опора под элементом'};return{ok:true,reason:''};}
export function removalDependents(blocks,id){const removed=new Set([id]);let changed=true;while(changed){changed=false;const remaining=blocks.filter(b=>!removed.has(b.id));for(const b of remaining)if(!hasSupport(remaining.filter(a=>a.id!==b.id),b)){removed.add(b.id);changed=true;}}return [...removed].filter(v=>v!==id);}
const types=Object.keys(CATALOG);
export function encodeTower(blocks){return blocks.map(b=>[b.id,types.indexOf(b.type),b.x,b.y,b.z,b.sx,b.sy,b.sz,b.rotation,b.variant||0,b.paidCurrency==='gold'?1:0,b.paidAmount??CATALOG[b.type].price]);}
export function decodeTower(rows){return rows.map(r=>({id:r[0],type:typeof r[1]==='string'?r[1]:types[r[1]],x:r[2],y:r[3],z:r[4],sx:r[5],sy:r[6],sz:r[7],rotation:r[8],...(r[9]?{variant:r[9]}:{}),paidCurrency:r[10]===1||r[10]==='gold'?'gold':'silver',paidAmount:r[11]}));}
