const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');

(async()=>{
 const base='http://127.0.0.1:8842';
 const server=spawn('python3',['-m','http.server','8842','--bind','127.0.0.1'],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<40;i++){
   try{if((await fetch(base)).ok)break;}catch{}
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:780,height:400},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route(base+'/qa',r=>r.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><style>body{margin:0}</style>'}));
  await page.goto(base+'/qa');
  const stats=await page.evaluate(async()=>{
   const T=await import('/src/vendor/three/three.module.js');
   const {loadBakedMasonry}=await import('/src/features/tower/baked-masonry.js');
   const {getRockSurface}=await import('/src/features/tower/rock-surface.js');
   const W=780,H=400;
   const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
   renderer.setSize(W,H);
   document.body.append(renderer.domElement);
   const rock=await getRockSurface(renderer);
   if(!rock.name.endsWith('PNG-1K'))throw Error('Expected mobile stone maps: '+rock.name);
   const data=document.createElement('canvas');
   data.width=64;data.height=64;
   const ctx=data.getContext('2d');
   ctx.drawImage(rock.map.image,0,0,64,64);
   const rgb=ctx.getImageData(0,0,64,64).data,mean=new T.Color(),sample=new T.Color();
   for(let i=0;i<rgb.length;i+=4)mean.add(sample.setRGB(rgb[i]/255,rgb[i+1]/255,rgb[i+2]/255,T.SRGBColorSpace));
   mean.multiplyScalar(4/rgb.length);
   const flat=rock.clone();flat.map=null;flat.color.copy(mean);
   const noNormal=rock.clone();noNormal.normalMap=null;
   const flatBoth=flat.clone();flatBoth.normalMap=null;
   const maskMaterial=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});
   const low=await loadBakedMasonry('manual-3x3x3-v2',{fenceLod:true});
   const full=await loadBakedMasonry('manual-3x3x3-v2',{cast:true});
   const camera=new T.PerspectiveCamera(42,W/H,.1,5000);
   const scene=new T.Scene(),wall=new T.Group(),tower=new T.Group();
   const lamps=new T.DirectionalLight(0xffefd8,2.4);lamps.position.set(-20,19,12);
   scene.add(wall,tower,lamps,new T.HemisphereLight(0xf2f4fb,0x8f7a63,1.5));
   function masonry(group,geometry,x,y,z,sx,sy,sz){
    const mesh=new T.Mesh(geometry,rock);
    mesh.scale.set(sx,sy,sz);
    mesh.position.set(x,y,z);
    group.add(mesh);
   }
   for(let i=0;i<26;i++)masonry(wall,low,i*1.06-13,0,0,1.5,1.3,.65);
   for(let row=0;row<11;row++)for(let column=0;column<4;column++)
    masonry(tower,full,(column-1.5)*.72,row*.70,0,1,1,1);
   tower.position.set(4,0,-5);
   const gl=renderer.getContext(),buffer=new Uint8Array(W*H*4);
   function render(material,jitter,mask){
    for(const group of [wall,tower])for(const mesh of group.children)mesh.material=material;
    scene.background=new T.Color(mask?0:0x665e50);
    camera.setViewOffset(W,H,jitter[0],jitter[1],W,H);
    renderer.render(scene,camera);
    gl.readPixels(0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,buffer);
    return buffer.slice();
   }
   const offsets=Array.from({length:16},(_,i)=>[(i%4-1.5)*.23,(Math.floor(i/4)-1.5)*.23]);
   const rows=[];
   for(const distance of [65,95,125]){
    camera.position.set(0,12,distance);camera.lookAt(0,3,0);
    for(const [name,object] of [['fence',wall],['tower',tower]]){
     wall.visible=object===wall;tower.visible=object===tower;
     const masks=offsets.map(offset=>render(maskMaterial,offset,true));
     const pixels=[];
     for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
      const p=(y*W+x)*4;
      if(masks.every(m=>m[p]===255&&m[p-4]===255&&m[p+4]===255&&m[p-4*W]===255&&m[p+4*W]===255))pixels.push(p);
     }
     if(pixels.length<12)throw Error('Insufficient interior pixels '+name+' '+distance);
     const row={name,distance,pixels:pixels.length};
     for(const [mode,material] of [['base',rock],['flatColor',flat],['noNormal',noNormal],['flatBoth',flatBoth]]){
      const frames=offsets.map(offset=>render(material,offset,false));
      let sum=0;
      for(const p of pixels){
       const ys=frames.map(f=>.2126*f[p]+.7152*f[p+1]+.0722*f[p+2]);
       const m=ys.reduce((a,b)=>a+b)/ys.length;
       sum+=ys.reduce((a,b)=>a+(b-m)**2,0)/ys.length;
      }
      row[mode]=Number(Math.sqrt(sum/pixels.length).toFixed(3));
     }
     rows.push(row);
    }
   }
   return rows;
  });
  assert.deepEqual(errors,[]);
  await fs.mkdir('kunlum-shimmer-results',{recursive:true});
  await fs.writeFile('kunlum-shimmer-results/report.json',JSON.stringify(stats,null,2));
  console.log('SHIMMER_AB',JSON.stringify(stats));
 }finally{
  await browser?.close();
  server.kill();
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
