import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE='https://3d-5lcon9.v2.appdeploy.ai/';
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
    const uri=`data:${mime};base64,${bytes.toString('base64')}`;
    result.set(`./${relative}`,uri);
    result.set(`/${relative}`,uri);
  }
  return result;
}

function replaceResources(text,resources){
  let output=text;
  for(const [from,to] of resources)output=output.split(from).join(to);
  return output;
}

function findAppScript(html){
  const tags=[...html.matchAll(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*><\/script>/gi)].map(match=>match[0]);
  const tag=tags.find(value=>{
    const src=attribute(value,'src');
    return !/data-appdeploy/i.test(value)&&/\.js(?:\?|$)/i.test(src)&&/assets\//i.test(src);
  });
  if(!tag)throw new Error('Could not locate the built Ashyk JavaScript asset');
  return attribute(tag,'src');
}

function findAppStylesheet(html){
  const tags=[...html.matchAll(/<link\b[^>]*>/gi)].map(match=>match[0]);
  const tag=tags.find(value=>{
    const rel=attribute(value,'rel').toLowerCase();
    const href=attribute(value,'href');
    return !/data-appdeploy/i.test(value)&&rel==='stylesheet'&&/\.css(?:\?|$)/i.test(href)&&/assets\//i.test(href);
  });
  if(!tag)throw new Error('Could not locate the built Ashyk stylesheet');
  return attribute(tag,'href');
}

function visibleMarkup(html){
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'')
    .replace(/<[^>]+>/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}

async function main(){
  const sourceHtml=await fetchOk(SOURCE);
  const scriptSrc=findAppScript(sourceHtml);
  const stylesheetHref=findAppStylesheet(sourceHtml);
  const resources=await dataUris();

  let js=replaceResources(await fetchOk(new URL(scriptSrc,SOURCE)),resources);
  let css=replaceResources(await fetchOk(new URL(stylesheetHref,SOURCE)),resources);

  if(/(?:from\s*["']\.\/|import\s*\(\s*["']\.\/)/.test(js))throw new Error(`Built script still contains relative JS imports: ${scriptSrc}`);
  if(/appdeploy\.ai/i.test(js))throw new Error('Built application JavaScript unexpectedly contains an AppDeploy runtime dependency');
  if(/\burl\([^)]*(?:assets\/|resources\/)/i.test(css))throw new Error('Built stylesheet still references unpacked assets');

  js=js.replace(/<\/script/gi,'<\\/script');
  css=css.replace(/<\/style/gi,'<\\/style');

  const html=`<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#08100d">
  <title>Ашыкъ оюн</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script type="module">${js}</script>
</body>
</html>
`;

  const scriptOpen=(html.match(/<script\b/gi)||[]).length;
  const scriptClose=(html.match(/<\/script>/gi)||[]).length;
  const styleOpen=(html.match(/<style\b/gi)||[]).length;
  const styleClose=(html.match(/<\/style>/gi)||[]).length;
  if(scriptOpen!==1||scriptClose!==1)throw new Error(`Unbalanced embedded scripts: ${scriptOpen}/${scriptClose}`);
  if(styleOpen!==1||styleClose!==1)throw new Error(`Unbalanced embedded styles: ${styleOpen}/${styleClose}`);
  if(/\b(?:src|href)=["'][^"']+(?:assets\/|resources\/|appdeploy\.ai)[^"']*["']/i.test(html))throw new Error('Embedded HTML still references external game assets');
  if(/appdeploy\.ai|__APPDEPLOY_APP_ID|request-latency-log-v1/i.test(html))throw new Error('Embedded runtime still contains AppDeploy instrumentation');
  const visible=visibleMarkup(html);
  if(visible!=='Ашыкъ оюн')throw new Error(`Unexpected visible text outside the game root: ${visible.slice(0,160)}`);
  const bytes=Buffer.byteLength(html);
  if(bytes<100000)throw new Error(`Embedded game is unexpectedly small: ${bytes}`);

  await fs.mkdir(path.dirname(WEB_OUT),{recursive:true});
  await fs.mkdir(path.dirname(MOBILE_OUT),{recursive:true});
  await fs.writeFile(WEB_OUT,html);
  await fs.writeFile(MOBILE_OUT,html);
  console.log(`Embedded Ashyk bundle: ${bytes} bytes; source JS ${scriptSrc}; CSS ${stylesheetHref}`);
}

await main();