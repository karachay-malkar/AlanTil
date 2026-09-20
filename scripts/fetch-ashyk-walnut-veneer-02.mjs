import fs from'node:fs';
import path from'node:path';
import crypto from'node:crypto';
import{fileURLToPath}from'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DEST=path.join(ROOT,'assets/ashyk/materials/walnut-veneer-02');
const API='https://api.polyhaven.com/files/walnut_veneer_02';
const HEADERS={'User-Agent':'AlanTil/16.7.0 (Walnut Veneer 02 asset bootstrap)'};
const TARGETS=Object.freeze({
  baseColor:'walnut_veneer_02_diff_1k.jpg',
  normal:'walnut_veneer_02_nor_gl_1k.jpg',
  roughness:'walnut_veneer_02_rough_1k.jpg',
  ao:'walnut_veneer_02_ao_1k.jpg',
});

const isJpeg=buffer=>buffer.length>16384&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
const existingIsValid=file=>{
  try{return isJpeg(fs.readFileSync(file));}catch{return false;}
};
function flatten(node,out=[]){
  if(!node||typeof node!=='object')return out;
  if(typeof node.url==='string')out.push(node);
  for(const value of Object.values(node))if(value&&typeof value==='object')flatten(value,out);
  return out;
}
function recordFor(records,filename){
  const lower=filename.toLowerCase();
  return records.find(item=>{
    try{return decodeURIComponent(new URL(item.url).pathname).toLowerCase().endsWith('/'+lower);}catch{return String(item.url).toLowerCase().includes(lower);}
  })||null;
}
async function getBuffer(url){
  const response=await fetch(url,{headers:HEADERS,redirect:'follow'});
  if(!response.ok)throw new Error(`Failed to download ${url}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
function verifyMd5(buffer,expected,filename){
  if(!expected)return;
  const actual=crypto.createHash('md5').update(buffer).digest('hex');
  if(actual.toLowerCase()!==String(expected).toLowerCase())throw new Error(`MD5 mismatch for ${filename}`);
}

fs.mkdirSync(DEST,{recursive:true});
const missing=Object.values(TARGETS).filter(filename=>!existingIsValid(path.join(DEST,filename)));
if(!missing.length){
  console.log('Walnut Veneer 02 PBR assets already present.');
  process.exit(0);
}

const response=await fetch(API,{headers:HEADERS});
if(!response.ok)throw new Error(`Poly Haven files API failed: HTTP ${response.status}`);
const records=flatten(await response.json());
for(const filename of missing){
  const record=recordFor(records,filename);
  if(!record)throw new Error(`Poly Haven did not return required 1K map: ${filename}`);
  const buffer=await getBuffer(record.url);
  if(!isJpeg(buffer))throw new Error(`Downloaded file is not a valid JPEG: ${filename}`);
  verifyMd5(buffer,record.md5,filename);
  fs.writeFileSync(path.join(DEST,filename),buffer);
  console.log(`${filename} — ${(buffer.length/1024).toFixed(2)} KB`);
}
