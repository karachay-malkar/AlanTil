import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE='https://3d-5lcon9.v2.appdeploy.ai/';
const SOURCE_ORIGIN=new URL(SOURCE).origin;
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const WEB_OUT=path.join(ROOT,'assets/ashyk-game/index.html');
const MOBILE_OUT=path.join(ROOT,'mobile/assets/ashyk-game/index.html');
const AUDIO=[
  ['resources/clack.mp3','audio/mpeg'],
  ['resources/smaller-horn-dropped-on-stone-floor.mp3','audio/mpeg'],
  ['resources/wood-hard-hit.wav','audio/wav'],
];

async function fetchOk(url,binary=false){
  const response=await fetch(url,{redirect:'follow'});
  if(!response.ok)throw new Error(`Fetch failed ${response.status}: ${url}`);
  return binary?Buffer.from(await response.arrayBuffer()):response.text();
}

function attribute(tag,name){
  const match=tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`,'i'));
  return match?.[1]||'';
}

async function dataUris(){
  const result=new Map();
  for(const [relative,mime] of AUDIO){
    const bytes=await fetchOk(new URL(relative,SOURCE),true);
    result.set(`./${relative}`,`data:${mime};base64,${bytes.toString('base64')}`);
    result.set(`/${relative}`,`data:${mime};base64,${bytes.toString('base64')}`);
  }
  return result;
}

function replaceResources(text,resources){
  let output=text;
  for(const [from,to] of resources)output=output.split(from).join(to);
  return output;
}

async function main(){
  let html=await fetchOk(SOURCE);
  const resources=await dataUris();

  for(const tag of [...html.matchAll(/<link\b[^>]*>/gi)].map(match=>match[0])){
    const rel=attribute(tag,'rel').toLowerCase();
    const href=attribute(tag,'href');
    if(rel==='manifest'||rel==='modulepreload'||rel.includes('icon')){
      html=html.replace(tag,'');
      continue;
    }
    if(rel!=='stylesheet'||!href)continue;
    const css=replaceResources(await fetchOk(new URL(href,SOURCE)),resources).replace(/<\/style/gi,'<\\/style');
    html=html.replace(tag,`<style>${css}</style>`);
  }

  for(const match of [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi)]){
    const [tag,before,src,after]=match;
    let js=replaceResources(await fetchOk(new URL(src,SOURCE)),resources);
    if(/(?:from\s*["']\.\/|import\s*\(\s*["']\.\/)/.test(js))throw new Error(`Built script still contains relative JS imports: ${src}`);
    js=js.replace(/<\/script/gi,'<\\/script');
    const attrs=`${before}${after}`.replace(/\s*(?:crossorigin|integrity)(?:=["'][^"']*["'])?/gi,'').trim();
    html=html.replace(tag,`<script${attrs?` ${attrs}`:''}>${js}</script>`);
  }

  html=replaceResources(html,resources)
    .replaceAll(SOURCE,'')
    .replaceAll(SOURCE_ORIGIN,'');

  if(/appdeploy\.ai/i.test(html))throw new Error('AppDeploy runtime reference remained in embedded build');
  if(/(?:src|href)=["'][^"']*(?:assets\/|resources\/)/i.test(html))throw new Error('Embedded build still references external asset files');
  if(!html.includes('Ашыкъ оюн'))throw new Error('Unexpected game build: title not found');
  const bytes=Buffer.byteLength(html);
  if(bytes<100000)throw new Error(`Embedded game is unexpectedly small: ${bytes}`);

  await fs.mkdir(path.dirname(WEB_OUT),{recursive:true});
  await fs.mkdir(path.dirname(MOBILE_OUT),{recursive:true});
  await fs.writeFile(WEB_OUT,html);
  await fs.writeFile(MOBILE_OUT,html);
  console.log(`Embedded Ashyk bundle: ${bytes} bytes`);
}

await main();
