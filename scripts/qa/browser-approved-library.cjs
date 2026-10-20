/** Real WebGL smoke test of all ten independently authored and stored 3D masonry recipes. */
const {chromium}=require('playwright');
const path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const server=cp.spawn('python3',['-m','http.server','8824','--bind','127.0.0.1'],{cwd:root,stdio:'ignore'});
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1100,height:720}});
  const pageErrors=[],badRequests=[];
  page.on('pageerror',e=>pageErrors.push(String(e)));
  page.on('response',r=>{if(r.status()>=400)badRequests.push([r.status(),r.url()])});
  await new Promise(r=>setTimeout(r,650));
  await page.goto('http://127.0.0.1:8824/gate-fit-review.html',{waitUntil:'domcontentloaded'});
  const result=await page.evaluate(async()=>{
   const [T,component,variants]=await Promise.all([
    import('/src/vendor/three/three.module.js'),
    import('/src/features/tower/approved-section-scene.js?v=17.7-approved-masonry.1'),
    import('/packages/tower-game/approved-prefab.mjs')
   ]);
   const renderer=new T.WebGLRenderer({antialias:false,alpha:false});
   renderer.setSize(640,400);
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(60,640/400,.01,100);
   camera.position.set(2,2.5,4);camera.lookAt(0,0,0);
   scene.add(new T.AmbientLight('white',2));
   scene.add(new T.DirectionalLight('white',2));
   const loader=component.createApprovedSectionLoader(),material=new T.MeshStandardMaterial({color:'#bdb5a2',roughness:1});
   const expected=[['1x1x1',[6,8]],['2x2x2',[11,19,15]],['2x3x4',[40,40,28]],['3x3x3',[86,23]]];
   const checks=[];
   for(const [name,counts] of expected){
    for(let v=0;v<counts.length;v++){
     const model=await loader.make(name,v,material);
     const meshes=[];model.traverse(n=>{if(n.isMesh)meshes.push(n)});
     if(meshes.length!==counts[v])throw new Error(name+' variant '+v+' has '+meshes.length+' meshes instead of '+counts[v]);
     if(meshes.some(mesh=>mesh.geometry.type==='BoxGeometry'))throw new Error('Procedural cube substitution');
     if(!meshes.every(mesh=>mesh.geometry.attributes.position?.count>12))throw new Error('Bad authored GLB mesh');
     const bbox=new T.Box3().setFromObject(model);
     if(bbox.isEmpty()||![...bbox.min.toArray(),...bbox.max.toArray()].every(Number.isFinite))
      throw new Error('Invalid geometry bounds '+name);
     scene.add(model);
     renderer.render(scene,camera);
     for(let rot=0;rot<4;rot++){model.rotation.y=rot*Math.PI/2;renderer.render(scene,camera)}
     scene.remove(model);
     checks.push({name,variant:v,stones:meshes.length,bounds:{min:bbox.min.toArray(),max:bbox.max.toArray()}});
    }
   }
   renderer.dispose();
   return {passed:checks.length,checks};
  });
  if(result.passed!==10)throw Error('Expected ten rendered sections');
  if(pageErrors.length||badRequests.length)throw Error(JSON.stringify({pageErrors,badRequests}));
  console.log('APPROVED_WEBGL_RENDERING_PASS',JSON.stringify(result));
 }finally{if(browser)await browser.close();server.kill()}
})().catch(e=>{console.error('APPROVED_WEBGL_RENDERING_FAILED',e.stack||String(e));process.exitCode=1});
