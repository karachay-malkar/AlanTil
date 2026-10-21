import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep,join} from 'node:path';

const root=resolve(process.cwd());
const port=Number(process.env.PORT||4173);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.glb':'model/gltf-binary','.ktx2':'image/ktx2','.wasm':'application/wasm'};
http.createServer(async(req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 if(pathname.includes('\0')){res.writeHead(400).end();return;}
 let file=resolve(root,'.'+pathname);
 if(file!==root&&!file.startsWith(root+sep)){res.writeHead(403).end();return;}
 try{
  let info=await stat(file).catch(()=>null);
  if(info?.isDirectory()){file=join(file,'index.html');info=await stat(file).catch(()=>null);}
  if(!info?.isFile()){
   if(extname(pathname)){res.writeHead(404).end('Not Found');return;}
   file=join(root,'index.html');
  }
  const data=await readFile(file);
  res.writeHead(200,{'Content-Type':mime[extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
  res.end(data);
 }catch(error){res.writeHead(500).end(error.message);}
}).listen(port,'127.0.0.1',()=>console.log('AlanTil test server on 127.0.0.1:'+port));
