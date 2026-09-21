// Read-only browser instrumentation. No game source changes; controls use real input.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'../..'),label=process.argv[2]||'rigged';
const out=path.join(root,'work/forge3d-step02');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1280,height:720},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.route('**/lib/game/engine.js*',async route=>{
   const response=await route.fetch();let body=await response.text();
   assert.match(body,/this\.mount\s*=\s*mount/);
   body=body.replace(/this\.mount\s*=\s*mount/,'window.__step02engine=this;this.mount=mount');
   await route.fulfill({response,body});
 });
 await page.goto(process.env.GAME_URL||'http://localhost:3000');
 await page.waitForFunction(()=>window.__step02engine?.playerModel,{timeout:60000});
 await page.waitForTimeout(1800);
 const model=await page.evaluate(()=>{
   const g=window.__step02engine,v=g.playerModel,meshes=[],bones=new Set();
   v.updateWorldMatrix(true,true);
   v.traverse(o=>{if(o.isBone)bones.add(o.name);if(o.isMesh){
     o.geometry.computeBoundingBox();const box=o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
     meshes.push({name:o.name,skinned:!!o.isSkinnedMesh,triangles:(o.geometry.index?.count||o.geometry.attributes.position.count)/3,
       joints:o.skeleton?.bones.map(b=>b.name),attributes:Object.keys(o.geometry.attributes),bounds:[box.min.toArray(),box.max.toArray()],
       material:{name:o.material.name,map:!!o.material.map,metalnessMap:!!o.material.metalnessMap,
        roughnessMap:!!o.material.roughnessMap,textureSize:[o.material.map?.image?.width,o.material.map?.image?.height]}})
   }});
   return {meshes,bones:[...bones],scale:v.scale.toArray(),offset:v.position.toArray(),rotation:v.rotation.y};
 });
 if(label==='rigged') {
  assert.equal(model.bones.length,20,'runtime bone count');
  assert(model.meshes.every(m=>m.skinned && m.joints.length===20),'runtime skinned meshes');
  assert(model.meshes.every(m=>m.attributes.includes('skinWeight')&&m.attributes.includes('skinIndex')));
 }
 assert.equal(model.scale[0],2.6);assert.equal(model.rotation,0);
 assert(model.meshes.every(m=>Math.abs(m.bounds[0][1])<.002),'feet near ground');
 assert(model.meshes.every(m=>m.material.map&&m.material.metalnessMap&&m.material.roughnessMap),'PBR maps');
 const frames=await page.evaluate(()=>new Promise(resolve=>{let t=performance.now(),dt=[];function frame(n){dt.push(n-t);t=n;if(dt.length===241)resolve(dt.slice(1));else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));
 frames.sort((a,b)=>a-b);
 const timing={samples:frames.length,meanMs:frames.reduce((a,b)=>a+b,0)/frames.length,medianMs:frames[120],p95Ms:frames[228]};
 timing.fps=1000/timing.meanMs;
 await page.keyboard.press('Enter');await page.waitForTimeout(700);
 await page.screenshot({path:path.join(out,label+'-in-game.png')});
 const start=await page.evaluate(()=>window.__neonRonin.inspect().player);
 await page.keyboard.down('KeyW');await page.waitForTimeout(400);await page.keyboard.up('KeyW');
 const moved=await page.evaluate(()=>window.__neonRonin.inspect().player);
 assert(Math.hypot(start.x-moved.x,start.z-moved.z)>.5,'movement');
 await page.mouse.move(690,360);
 await page.mouse.down();await page.waitForTimeout(50);
 const light=await page.evaluate(()=>window.__neonRonin.inspect().player.attack);
 await page.mouse.up();assert(light&&!light.heavy,'light attack');
 await page.waitForTimeout(600);await page.mouse.down({button:'right'});await page.waitForTimeout(50);
 const heavy=await page.evaluate(()=>window.__neonRonin.inspect().player.attack);
 await page.mouse.up({button:'right'});assert(heavy?.heavy,'heavy attack');
 await page.waitForTimeout(700);await page.keyboard.press('Space');
 const dodge=await page.evaluate(()=>window.__neonRonin.inspect().player.dodge);
 assert(dodge>0,'dodge');
 // Fight the first wave using mouse-facing and held attacks while the enemies approach.
 await page.waitForTimeout(1500);const before=await page.evaluate(()=>window.__neonRonin.snapshot());
 for(let i=0;i<100;i++){
  const target=await page.evaluate(()=>{const s=window.__neonRonin.inspect();const enemies=s.enemies.filter(e=>e.state!=='dead').sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z));return enemies[0]?window.__neonRonin.project(enemies[0].x,enemies[0].z):null});
  if(target){await page.mouse.move(target.x,target.y);await page.mouse.down();if(i%10===0)await page.mouse.click(target.x,target.y,{button:'right'});}
  await page.waitForTimeout(100);
  const s=await page.evaluate(()=>window.__neonRonin.snapshot());if(s.kills>0)break;
 }
 await page.mouse.up();const combat=await page.evaluate(()=>window.__neonRonin.snapshot());
 assert(combat.combo>0||combat.kills>0,'hit detection registers damage');
 await page.screenshot({path:path.join(out,label+'-combat.png')});
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__neonRonin.snapshot().mode),'paused');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__neonRonin.snapshot().mode),'playing');
 const result={label,model,timing,start,moved,light:!!light,heavy:!!heavy,dodge,before,combat,errors};
 fs.writeFileSync(path.join(out,label+'-browser.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 assert.equal(errors.length,0);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
