import fs from'node:fs';
import path from'node:path';
import zlib from'node:zlib';
import{fileURLToPath}from'node:url';

const SIZE=1024,SCALE=2,HI=SIZE*SCALE;
const BG=[252,247,241],FG=[61,51,41];
const POLYGON=[[157,623],[164,625],[195,625],[223,623],[250,615],[273,605],[293,591],[310,575],[330,554],[384,494],[393,485],[399,483],[406,483],[411,485],[453,529],[470,549],[476,554],[485,560],[493,564],[502,567],[511,568],[529,566],[546,558],[561,544],[574,529],[617,485],[621,483],[629,483],[635,485],[693,549],[722,579],[741,595],[756,605],[766,610],[781,616],[806,623],[835,625],[852,625],[871,623],[869,621],[841,597],[805,561],[745,495],[660,399],[650,392],[643,389],[628,385],[617,385],[609,386],[601,389],[588,396],[573,411],[547,438],[521,464],[514,467],[509,466],[505,464],[441,398],[434,393],[425,388],[410,385],[400,385],[393,386],[379,391],[370,398],[361,407],[309,468],[232,553],[186,599]];

function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
function chunk(type,data=Buffer.alloc(0)){const name=Buffer.from(type,'ascii'),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc32(Buffer.concat([name,data])));return Buffer.concat([length,name,data,checksum]);}
function rasterMask(){const mask=new Uint8Array(HI*HI),points=POLYGON.map(([x,y])=>[x*SCALE,y*SCALE]);for(let y=0;y<HI;y++){const scan=y+.5,xs=[];for(let i=0;i<points.length;i++){const[x1,y1]=points[i],[x2,y2]=points[(i+1)%points.length];if((y1<=scan&&scan<y2)||(y2<=scan&&scan<y1))xs.push(x1+(scan-y1)*(x2-x1)/(y2-y1));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const start=Math.max(0,Math.ceil(xs[i]-.5)),end=Math.min(HI-1,Math.floor(xs[i+1]-.5));for(let x=start;x<=end;x++)mask[y*HI+x]=1;}}return mask;}
function pngBytes(){const mask=rasterMask(),row=1+SIZE*3,raw=Buffer.alloc(row*SIZE);for(let y=0;y<SIZE;y++){const base=y*row;raw[base]=0;for(let x=0;x<SIZE;x++){let coverage=0;for(let yy=0;yy<SCALE;yy++)for(let xx=0;xx<SCALE;xx++)coverage+=mask[(y*SCALE+yy)*HI+x*SCALE+xx];const t=coverage/(SCALE*SCALE),offset=base+1+x*3;for(let c=0;c<3;c++)raw[offset+c]=Math.round(BG[c]+(FG[c]-BG[c])*t);}}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(SIZE,0);ihdr.writeUInt32BE(SIZE,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND')]);}

const here=path.dirname(fileURLToPath(import.meta.url)),branding=path.resolve(here,'../assets/branding'),bytes=pngBytes();
fs.mkdirSync(branding,{recursive:true});
for(const name of['alantil-icon.png','alantil-adaptive-foreground.png']){const target=path.join(branding,name),tmp=`${target}.${process.pid}.tmp`;fs.writeFileSync(tmp,bytes);fs.renameSync(tmp,target);}
console.log(`Generated Alan Til launcher icons: ${bytes.length} bytes each`);
