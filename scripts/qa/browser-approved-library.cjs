/** Real WebGL smoke test of all eleven independently authored and stored 3D masonry recipes. */
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
  // Isolated same-origin harness: the retired gate-fit-review page imports a deleted editor module.
  // This test renders only the approved Common100 sections through their production loader.
  await page.route('**/gate-fit-review.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
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
   const expected=[['1x1x1',[6,8,11]],['2x2x2',[11,19,15]],['2x3x4',[40,40,28]],['3x3x3',[86,23]]];
   const checks=[];
   for(const [name,counts] of expected){
    for(let v=0;v<counts.length;v++){
     const model=await loader.make(name,v,material);
     const meshes=[];model.traverse(n=>{if(n.isMesh)meshes.push(n)});
     if(meshes.length!==1)throw new Error(name+' variant '+v+' must use one optimized mesh, got '+meshes.length);
     if(model.userData.sourceStoneCount!==counts[v])throw new Error('Original stone count changed '+name+' '+v);
     if(meshes.some(mesh=>mesh.geometry.type==='BoxGeometry'))throw new Error('Procedural cube substitution');
     if(!meshes.every(mesh=>mesh.geometry.attributes.position?.count>12))throw new Error('Bad authored GLB mesh');
     const bbox=new T.Box3().setFromObject(model);
     if(bbox.isEmpty()||![...bbox.min.toArray(),...bbox.max.toArray()].every(Number.isFinite))
      throw new Error('Invalid geometry bounds '+name);
     scene.add(model);
     renderer.render(scene,camera);
     for(let rot=0;rot<4;rot++){model.rotation.y=rot*Math.PI/2;renderer.render(scene,camera)}
     scene.remove(model);
     checks.push({name,variant:v,sourceStones:model.userData.sourceStoneCount,renderMeshes:meshes.length,sourceTriangles:model.userData.optimization.sourceTriangles,renderTriangles:model.userData.optimization.renderTriangles,trimmedTriangles:model.userData.optimization.trimmedTriangles,bounds:{min:bbox.min.toArray(),max:bbox.max.toArray()}});
    }
   }

   // Compare actual original and consolidated geometry from the same authored
   // JSON under identical lights and camera (no screenshot substitution).
   const {loadCommon100:loadSource}=await import('/src/features/masonry/library.js');
   const {loadManualSection:loadSourceRecipe}=await import('/src/features/masonry/manual-sections/registry.mjs');
   const {getApprovedStoneSurfaceGeometry:getStoneUV}=await import('/src/features/tower/rock-surface.js');
   const sourceLibrary=await loadSource();
   const visualChecks=[];
   for(const [name,variant] of [['2x3x4',0],['3x3x3',0]]){
    const id=variants.approvedSectionId(name,variant);
    const document=await loadSourceRecipe(id,sourceLibrary.manifest);
    const originalRoot=new T.Group();
    originalRoot.position.y=-document.recipe.cells[1]*.25/2;
    for(const stone of document.recipe.stones){
     const mesh=new T.Mesh(getStoneUV(sourceLibrary.geometries.get(stone.name),stone.scale),material);
     mesh.position.fromArray(stone.position);
     mesh.quaternion.fromArray(stone.quaternion);
     mesh.scale.fromArray(stone.scale);
     originalRoot.add(mesh);
    }
    const optimizedRoot=await loader.make(name,variant,material);
    const gl=renderer.getContext(),width=640,height=400;
    for(const rotation of [0,1,2,3]){
     originalRoot.rotation.y=optimizedRoot.rotation.y=rotation*Math.PI/2;
     const frame=node=>{
      scene.add(node);renderer.render(scene,camera);
      const pixels=new Uint8Array(width*height*4);
      gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      scene.remove(node);
      return pixels;
     };
     const beforePixels=frame(originalRoot),afterPixels=frame(optimizedRoot);
     let changed=0;
     for(let i=0;i<beforePixels.length;i+=4){
      const delta=Math.max(Math.abs(beforePixels[i]-afterPixels[i]),
       Math.abs(beforePixels[i+1]-afterPixels[i+1]),
       Math.abs(beforePixels[i+2]-afterPixels[i+2]));
      if(delta>12)changed++;
     }
     const mismatch=changed/(width*height);
     visualChecks.push({section:id,rotation,changedPixels:changed,mismatch});
     if(mismatch>.015)throw Error('Exterior masonry changed beyond pixel tolerance '+JSON.stringify(visualChecks.at(-1)));
    }
   }

   // Actual WebGL draw calls: identical six-stone construction sections,
   // compared as independent source rocks and consolidated render meshes.
   const {loadCommon100}=await import('/src/features/masonry/library.js');
   const {loadManualSection}=await import('/src/features/masonry/manual-sections/registry.mjs');
   const {getApprovedStoneSurfaceGeometry}=await import('/src/features/tower/rock-surface.js');
   const library=await loadCommon100();
   const original=await loadManualSection('manual-1x1x1-v1',library.manifest);
   const merged=await loader.make('1x1x1',0,material);
   const performanceChecks=[];
   for(const count of [25,100,300]){
    const results={sections:count};
    for(const mode of ['original','merged']){
     const benchScene=new T.Scene(),columns=Math.ceil(Math.sqrt(count));
     benchScene.add(new T.AmbientLight('white',1));
     for(let i=0;i<count;i++){
      const instance=mode==='merged'?merged.clone(true):new T.Group();
      if(mode==='original'){
       instance.position.y=-original.recipe.cells[1]*.25/2;
       for(const stone of original.recipe.stones){
        const mesh=new T.Mesh(getApprovedStoneSurfaceGeometry(library.geometries.get(stone.name),stone.scale),material);
        mesh.position.fromArray(stone.position);
        mesh.quaternion.fromArray(stone.quaternion);
        mesh.scale.fromArray(stone.scale);
        instance.add(mesh);
       }
      }
      const column=i%columns,row=Math.floor(i/columns),rows=Math.ceil(count/columns);
      const wrap=new T.Group();
      wrap.position.set((column-(columns-1)/2)*.6,0,(row-(rows-1)/2)*.6);
      wrap.add(instance);
      benchScene.add(wrap);
     }
     camera.position.set(0,18,25);camera.lookAt(0,0,0);
     renderer.render(benchScene,camera);
     results[mode]={drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};
    }
    if(results.original.drawCalls!==count*original.recipe.stones.length||
       results.merged.drawCalls!==count)
     throw new Error('WebGL call count mismatch '+JSON.stringify(results));
    performanceChecks.push(results);
   }
   renderer.dispose();
   return {passed:checks.length,checks,visualChecks,performanceChecks};
  });
  if(result.passed!==11)throw Error('Expected eleven rendered sections');
  if(pageErrors.length||badRequests.length)throw Error(JSON.stringify({pageErrors,badRequests}));
  console.log('APPROVED_WEBGL_RENDERING_PASS',JSON.stringify(result));
 }finally{if(browser)await browser.close();server.kill()}
})().catch(e=>{console.error('APPROVED_WEBGL_RENDERING_FAILED',e.stack||String(e));process.exitCode=1});
