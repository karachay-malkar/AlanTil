const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdir}=require('node:fs/promises');
const {chromium}=require('playwright');

(async()=>{
 const base='http://127.0.0.1:8840';
 const server=spawn('python3',['-m','http.server','8840','--bind','127.0.0.1'],{stdio:'ignore'});
 let browser;
 try{
  for(let n=0;n<30;n++){
   try{if((await fetch(base)).ok)break;}catch{}
   await new Promise(resolve=>setTimeout(resolve,200));
  }
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:390,height:330},isMobile:true,hasTouch:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.route(base+'/fence-qa',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#665e50}</style>'}));
  await page.goto(base+'/fence-qa');
  await page.evaluate(async()=>{
   const THREE=await import('/src/vendor/three/three.module.js');
   const current=await import('/src/features/tower/kunlum-stone-facing.js');
   const baseline=await import('/src/features/tower/.fence-baseline.js');
   const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
   renderer.setSize(390,320);
   document.body.append(renderer.domElement);
   const camera=new THREE.OrthographicCamera(-7,7,5,-5,.1,130);
   const material=new THREE.MeshStandardMaterial({color:0xaca08f,roughness:1});
   const scenes=[];
   for(const source of [baseline,current]){
    const scene=new THREE.Scene(),root=new THREE.Group(),layer=new THREE.Group();
    scene.background=new THREE.Color(0x665e50);
    root.add(layer);
    const key=new THREE.DirectionalLight(0xfff6df,2.1);
    key.position.set(-6,8,9);
    scene.add(root,key,new THREE.HemisphereLight(0xffffff,0x888888,1.2));
    const heightAt=(x,z)=>Math.sin(x*.29)*.13+z*.024;
    const segments=[{a:[-6,0],b:[-1,0]},{a:[1,0],b:[6,-1]},
     {a:[-6,0],b:[-6,-7]},{a:[6,-1],b:[6,-7]},{a:[-6,-7],b:[6,-7]}]
     .map(points=>({...points,height:1.6,width:.55,heightAt}));
    const result=await source.enhanceKunlumStoneWalls(THREE,root,[{group:layer,segments}],{
     mobile:true,materialPromise:Promise.resolve(material)
    });
    scenes.push({scene,result,root});
   }
   window.fenceFrame=(index,distance)=>{
    const entry=scenes[index];
    camera.position.set(0,3,distance);
    camera.lookAt(0,.35,-2);
    entry.result.update(camera);
    const start=performance.now();
    renderer.render(entry.scene,camera);
    renderer.getContext().finish();
    return {ms:performance.now()-start,triangles:renderer.info.render.triangles,lod:entry.root.userData.ruinLOD};
   };
  });
  await mkdir('fence-browser-results',{recursive:true});
  for(const [label,distance] of [['near',8],['blend',36],['far',65]]){
   await page.evaluate(distance=>window.fenceFrame(1,distance),distance);
   await page.screenshot({path:'fence-browser-results/'+label+'.png'});
  }
  const stats=await page.evaluate(()=>{
   const path=[8,20,24,28,34,38,44,49,52,56,65,56,49,44,38,34,28,24,20,8];
   return [0,1].map(index=>{
    path.forEach(distance=>window.fenceFrame(index,distance));
    const frames=path.map(distance=>window.fenceFrame(index,distance));
    const timings=frames.map(frame=>frame.ms).sort((a,b)=>a-b);
    return {meanTriangles:Math.round(frames.reduce((sum,f)=>sum+f.triangles,0)/frames.length),
     medianMs:timings[Math.floor(timings.length/2)],p95Ms:timings[Math.ceil(timings.length*.95)-1],
     near:frames[0],blend:frames[5],far:frames[10]};
   });
  });
  assert.equal(errors.length,0,errors.join('\n'));
  assert.ok(stats[1].near.lod.nearCount>0&&stats[1].near.lod.farCount===0);
  assert.ok(stats[1].blend.lod.nearCount>0&&stats[1].blend.lod.farCount>0);
  assert.ok(stats[1].far.lod.nearCount===0&&stats[1].far.lod.farCount>0);
  assert.ok(stats[1].far.triangles<stats[0].far.triangles);
  console.log('FENCE_BENCHMARK',JSON.stringify({baseline:stats[0],casts:stats[1]}));
 }finally{
  await browser?.close();
  server.kill();
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
