// Read-only browser instrumentation. No game source changes; controls use real input.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'../..'),label='animated';
const out=path.join(root,'artifacts/asset-audit');fs.mkdirSync(out,{recursive:true});
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
   return {clips:v.animations.map(c=>({name:c.name,duration:c.duration})),meshes,bones:[...bones],scale:v.scale.toArray(),offset:v.position.toArray(),rotation:v.rotation.y};
 });
 if(label==='animated') {
  assert.equal(model.bones.length,20,'runtime bone count');
  assert(model.meshes.filter(m=>m.skinned).every(m=>m.joints.length===20),'runtime skinned meshes');
  assert(model.meshes.filter(m=>m.skinned).every(m=>m.attributes.includes('skinWeight')&&m.attributes.includes('skinIndex')));
 }
 assert.deepEqual(model.clips.map(c=>c.name).sort(),['attack','dodge','idle','run']);
 assert.equal(model.scale[0],2.6);assert.equal(model.rotation,0);
 assert(model.meshes.filter(m=>m.skinned).every(m=>Math.abs(m.bounds[0][1])<.002),'rest feet near ground');
 assert(model.meshes.every(m=>m.material.map&&m.material.metalnessMap&&m.material.roughnessMap),'PBR maps');
 const frames=await page.evaluate(()=>new Promise(resolve=>{let t=performance.now(),dt=[];function frame(n){dt.push(n-t);t=n;if(dt.length===241)resolve(dt.slice(1));else requestAnimationFrame(frame)}requestAnimationFrame(frame)}));
 frames.sort((a,b)=>a-b);
 const timing={samples:frames.length,meanMs:frames.reduce((a,b)=>a+b,0)/frames.length,medianMs:frames[120],p95Ms:frames[228]};
 timing.fps=1000/timing.meanMs;
 const capture=()=>page.evaluate(()=>{
  const v=window.__step02engine.playerModel;
  return {state:v.userData.playerAnimation.state,chest:v.getObjectByName('chest').quaternion.toArray(),
   arm:v.getObjectByName('upper_armR').quaternion.toArray(),leg:v.getObjectByName('upper_legL').quaternion.toArray(),
   hips:v.getObjectByName('hips').position.toArray(),katana:v.userData.katana?.visible,sheath:v.userData.sheath?.visible,
   weapon:v.userData.katana?.children[0]?.getWorldPosition(v.position.clone()).toArray()};
 });
 const idleStart=await capture();await page.waitForTimeout(350);const idleEnd=await capture();
 assert.equal(idleEnd.state,'idle');assert.notDeepEqual(idleStart.chest,idleEnd.chest,'idle bones move');
 assert.equal(idleEnd.katana,false);assert.equal(idleEnd.sheath,true);
 await page.screenshot({path:path.join(out,'animated-idle.png')});
 await page.keyboard.press('Enter');await page.waitForTimeout(700);
 await page.screenshot({path:path.join(out,label+'-in-game.png')});
 const start=await page.evaluate(()=>window.__neonRonin.inspect().player);
 await page.keyboard.down('KeyW');await page.waitForTimeout(400);
 const run=await capture();assert.equal(run.state,'run');
 await page.screenshot({path:path.join(out,'animated-run.png')});await page.keyboard.up('KeyW');
 const moved=await page.evaluate(()=>window.__neonRonin.inspect().player);
 assert(Math.hypot(start.x-moved.x,start.z-moved.z)>.5,'movement');
 await page.mouse.move(690,360);
 await page.mouse.down();await page.waitForTimeout(50);
 const light=await page.evaluate(()=>window.__neonRonin.inspect().player.attack);
 const lightPose=await capture();assert.equal(lightPose.state,'attack');
 assert.equal(lightPose.katana,true);assert.equal(lightPose.sheath,false);
 await page.screenshot({path:path.join(out,'animated-attack.png')});
 await page.mouse.up();assert(light&&!light.heavy,'light attack');
 await page.waitForTimeout(600);await page.mouse.down({button:'right'});await page.waitForTimeout(50);
 const heavy=await page.evaluate(()=>window.__neonRonin.inspect().player.attack);
 const heavyPose=await capture();assert.equal(heavyPose.state,'attack');
 await page.mouse.up({button:'right'});assert(heavy?.heavy,'heavy attack');
 await page.waitForTimeout(700);await page.keyboard.press('Space');
 const dodge=await page.evaluate(()=>window.__neonRonin.inspect().player.dodge);
 assert(dodge>0,'dodge');await page.waitForTimeout(80);
 const dodgePose=await capture();assert.equal(dodgePose.state,'dodge');
 await page.screenshot({path:path.join(out,'animated-dodge.png')});
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
 const pauseStart=await capture();await page.waitForTimeout(250);assert.deepEqual(await capture(),pauseStart,'pause freezes actual bones');
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__neonRonin.snapshot().mode),'playing');
 // Isolated visual fixtures use the same engine/mixer; simulation and production code stay intact.
 const types=(process.env.CHARACTER_TYPES||'ranged,melee').split(',');
 await page.waitForFunction(types=>types.every(type=>window.__step02engine.enemyTemplates.has(type)),types,{timeout:90000});
 await page.evaluate(types=>{
   const g=window.__step02engine;cancelAnimationFrame(g.frame);
   g.sim.mode='playing';g.sim.time=100;g.sim.player.x=0;g.sim.player.z=4;g.sim.player.angle=Math.PI;
   g.sim.player.attack=null;g.sim.player.dodge=0;g.sim.player.move=0;
   g.sim.enemies=types.map((type,i)=>({id:900+i,type,x:types.length===1?0:i===0?-2:2,z:0,hp:100,maxHp:100,angle:0,state:'approach',timer:0,cooldown:2,stun:0,flash:0,move:0,attackAngle:0,vx:0,vz:0}));
   g.sim.events=[];g.camera.position.set(5,6,11);g.camera.lookAt(0,1,1.5);g.visuals(.016);g.composer.render();
 },types);
 const fixture=async(state)=>page.evaluate(state=>{
   const g=window.__step02engine;
   for(const e of g.sim.enemies){e.state=state==='attack'?(e.type==='ranged'?'charge':'windup'):'approach';e.move=state==='run'?1:0;e.stun=state==='hit'?.2:0;e.flash=0;e.timer=e.type==='ranged'?.05:0;}
   g.sim.player.move=state==='run'?1:0;g.sim.player.attack=state==='attack'?{t:.085,duration:.32,heavy:false}:null;
   for(let i=0;i<5;i++){g.sim.time+=.04;for(const e of g.sim.enemies)if(state==='hit')e.stun=Math.max(.01,e.stun-.03);g.visuals(.04);}
   g.composer.render();
   return g.sim.enemies.map(e=>{const rig=g.actors.get(e.id),v=rig.visual;
     return {type:e.type,state:v.userData.enemyAnimation.state,clips:v.userData.enemyAnimation.clipNames,
       bones:(()=>{let n=0;v.traverse(o=>{if(o.isBone)n++});return n})(),
       chest:v.getObjectByName('chest').quaternion.toArray(),leg:v.getObjectByName('upper_legL').quaternion.toArray(),
       socket:v.getObjectByName('weapon_hand_r').getWorldPosition(v.position.clone()).toArray(),
       weaponAttached:!!v.getObjectByName('weapon_hand_r').children.find(o=>!o.isBone),bodyHidden:!rig.body.visible};});
 },state);
 const characterFixtures={};
 for(const state of ['idle','run','attack','hit']){
   characterFixtures[state]=await fixture(state);
   for(const row of characterFixtures[state]){
     assert.equal(row.state,state);assert.equal(row.bones,20);assert.equal(row.weaponAttached,true);assert.equal(row.bodyHidden,true);
     assert.deepEqual(row.clips.sort(),['attack','death','hit','idle','run']);
   }
   await page.screenshot({path:path.join(out,'cast-'+state+'.png')});
 }
 assert.notDeepEqual(characterFixtures.idle[0].leg,characterFixtures.run[0].leg,'enemy locomotion moves bones');
 assert.notDeepEqual(characterFixtures.idle[0].chest,characterFixtures.attack[0].chest,'enemy attack moves torso');
 assert.notDeepEqual(characterFixtures.idle[0].chest,characterFixtures.hit[0].chest,'enemy hit reaction moves torso');
 characterFixtures.death=await page.evaluate(()=>{
   const g=window.__step02engine;for(const e of g.sim.enemies)g.sim.hitEnemy(e,1000,0,false);
   g.sim.enemies=[];
   for(let i=0;i<10;i++){g.sim.time+=.04;g.visuals(.04);}g.composer.render();
   return [...g.actors.values()].filter(r=>r.deathEntity).map(r=>({type:r.type,state:r.visual.userData.enemyAnimation.state,root:r.visual.getObjectByName('root').quaternion.toArray(),timer:r.deathTime,health:r.health.visible}));
 });
 assert.equal(characterFixtures.death.length,types.length);
 assert(characterFixtures.death.every(r=>r.state==='death'&&!r.health),'visual death persists after immediate simulation removal');
 await page.screenshot({path:path.join(out,'cast-death.png')});
 await page.evaluate(()=>{const g=window.__step02engine;for(let i=0;i<20;i++){g.sim.time+=.04;g.visuals(.04);}});
 assert.equal(await page.evaluate(()=>window.__step02engine.actors.size),0,'death visuals cleaned up');
 // Maximum existing concurrency: same scene/resolution, compare procedural and imported enemies.
 await page.evaluate(types=>{
   const g=window.__step02engine;
   g.sim.player.attack=null;g.sim.player.move=0;
   g.sim.enemies=Array.from({length:5},(_,i)=>({id:1000+i,type:types.length===1?types[0]:i===0?'ranged':'melee',x:(i-2)*2.7,z:i%2?-2:0,hp:100,maxHp:100,angle:0,state:'approach',timer:0,stun:0,flash:0,move:1,attackAngle:0,vx:0,vz:0}));
   g.visuals(.016);g.composer.render();
 },types);
 const benchmark=async(imported)=>page.evaluate(imported=>new Promise(resolve=>{
   const g=window.__step02engine;for(const r of g.actors.values()){r.visual.visible=imported;r.body.visible=!imported;}
   let previous=performance.now(),intervals=[],count=0;
   function frame(now){const dt=Math.min(.04,(now-previous)/1000);if(count++>60)intervals.push(now-previous);previous=now;g.sim.time+=dt;g.visuals(dt);g.composer.render();
     if(intervals.length===240){intervals.sort((a,b)=>a-b);const meanMs=intervals.reduce((a,b)=>a+b,0)/240;resolve({meanMs,p95Ms:intervals[228],fps:1000/meanMs,samples:240});}else requestAnimationFrame(frame);}
   requestAnimationFrame(frame);
 }),imported);
 const castPerformance={proceduralEnemies:await benchmark(false),importedEnemies:await benchmark(true)};
 await page.screenshot({path:path.join(out,'final-cast-in-game.png')});
 await fixture('attack');await page.screenshot({path:path.join(out,'final-combat-scene.png')});
 const result={label,model,timing,castPerformance,characterFixtures,animationStates:{idleStart,idleEnd,run,lightPose,heavyPose,dodgePose,pauseStart},start,moved,light:!!light,heavy:!!heavy,dodge,before,combat,errors};
 fs.writeFileSync(path.join(out,label+'-browser.json'),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));
 assert.equal(errors.length,0);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
