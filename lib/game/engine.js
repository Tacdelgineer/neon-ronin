import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Simulation, ARENAS, clamp, TAU } from './simulation.js';
import { buildWorld, buildActor, animateActor, C, ring, material, glow, palette } from './world.js';
import { TempleAudio } from './audio.js';
import { loadPlayerModel, updatePlayerModel, disposePlayerModel } from './player-model.js';
import { loadEnemyTemplate, instantiateEnemyModel, disposeEnemyModel } from './enemy-model.js';

export class NeonRonin {
  constructor(mount,onState){
    this.mount=mount;this.onState=onState;this.sim=new Simulation();this.audio=new TempleAudio();this.disposed=false;this.t=0;this.last=performance.now();this.uiClock=0;this.keys=new Set();this.mouse=new T.Vector2(0,.1);this.pointerActive=false;this.left=false;this.right=false;this.yaw=.52;this.target=new T.Vector3();this.shake=0;this.actors=new Map();this.shots=new Map();this.effects=[];this.particles=[];this.handlers=[];this.frameTimes=[];this.quality=1;
    this.zoom=22;this.zoomTarget=22;
    this.scene=new T.Scene();this.scene.background=new T.Color(0x07151f);this.scene.fog=new T.FogExp2(0x102732,.023);
    this.renderer=new T.WebGLRenderer({antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.16;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.setClearColor(0x091721);
    this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label','Combat arena. WASD move, mouse aim, left click combo, right click heavy, Space dodge, mouse wheel zoom, Q and E orbit, Escape pause.');mount.appendChild(this.renderer.domElement);
    this.camera=new T.PerspectiveCamera(43,1,.1,150);this.camera.position.set(20,26,30);this.raycaster=new T.Raycaster();this.ground=new T.Plane(new T.Vector3(0,1,0),0);this.aimPoint=new T.Vector3();
    const hemi=new T.HemisphereLight(0x9ac9db,0x242529,2.0);this.scene.add(hemi);
    const sun=new T.DirectionalLight(0xffd4a0,3.2);sun.position.set(-10,22,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-23,right:23,top:22,bottom:-23,near:.5,far:65});sun.shadow.bias=-.0006;sun.shadow.normalBias=.035;sun.target.position.set(0,0,-2);this.scene.add(sun,sun.target);
    this.rim=new T.DirectionalLight(0x43bcd7,1.45);this.rim.position.set(10,10,-15);this.scene.add(this.rim);
    this.shrineLight=new T.PointLight(0x48e8e9,32,16,2);this.shrineLight.position.set(0,3.5,-13);this.scene.add(this.shrineLight);
    this.lanterns=[];for(let i=0;i<6;i++){const l=new T.PointLight(0xff9c45,13,7,2);this.scene.add(l);this.lanterns.push(l);}
    this.setArena(0);
    this.player=buildActor();this.scene.add(this.player.root);
    this.enemyTemplates=new Map();
    this.enemyLoads=['ranged','melee'].map(type=>loadEnemyTemplate(type).then(template=>{
      if(this.disposed){disposePlayerModel(template);return;}
      this.enemyTemplates.set(type,template);
    }).catch(error=>{if(!this.disposed)console.error(`Forge3D ${type} enemy could not load; keeping its procedural visual.`,error);}));
    this.playerModel=null;
    loadPlayerModel().then(visual=>{
      if(this.disposed){disposePlayerModel(visual);return;}
      this.playerModel=visual;
      this.player.root.add(visual);
      this.player.body.visible=false;
      this.mount.dataset.playerModel='forge3d';
    }).catch(error=>{
      if(!this.disposed)console.error('Forge3D player model could not load; keeping the procedural player visible.',error);
    });
    this.playerLight=new T.PointLight(0x62e8ef,2,4);this.scene.add(this.playerLight);
    this.footRing=ring(this.scene,.55,.014,glow(0x59e8e0,1.5),0,.025,0,true);this.footRing.castShadow=false;
    this.cursor=ring(this.scene,.2,.014,new T.MeshBasicMaterial({color:0xade7e1,transparent:true,opacity:.7}),0,.035,0,true);this.cursor.visible=false;
    this.particleMesh=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({vertexColors:false,toneMapped:false}),800);this.particleMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.particleMesh.count=0;this.particleMesh.frustumCulled=false;this.scene.add(this.particleMesh);this.dummy=new T.Object3D();
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new UnrealBloomPass(new T.Vector2(1,1),.43,.5,1.1);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    this.resize();this.bind();this.updateCamera(.1,true);animateActor(this.player,this.sim.player,0,.016);
    this.sim.mode='ready';this.onState(this.sim.snapshot());this.loop=this.loop.bind(this);this.frame=requestAnimationFrame(this.loop);
    // Read-only diagnostics are available to automated playtests in development.
    if(import.meta.env.DEV)window.__neonRonin={snapshot:()=>this.sim.snapshot(),inspect:()=>({player:{...this.sim.player},enemies:this.sim.enemies.map(e=>({...e})),projectiles:this.sim.projectiles.map(e=>({...e})),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,quality:this.quality,aim:{x:this.aimPoint.x,z:this.aimPoint.z}}),project:(x,z)=>{const v=new T.Vector3(x,1,z).project(this.camera);return{x:(v.x+1)*this.mount.clientWidth/2,y:(1-v.y)*this.mount.clientHeight/2};}};
  }
  listen(target,type,fn,opts){target.addEventListener(type,fn,opts);this.handlers.push(()=>target.removeEventListener(type,fn,opts));}
  bind(){
    this.listen(window,'resize',()=>this.resize());
    this.listen(window,'keydown',e=>{if(e.target instanceof HTMLElement&&['INPUT','TEXTAREA'].includes(e.target.tagName))return;
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      if(e.code==='Escape'&&!e.repeat){this.togglePause();return;}
      if(e.code==='Enter'&&!e.repeat&&['ready','victory','defeat'].includes(this.sim.mode)){this.start();return;}
      this.keys.add(e.code);if(e.code==='Space'&&!e.repeat){const m=this.movement();this.sim.dodge(m.mx,m.mz);}
    });
    this.listen(window,'keyup',e=>this.keys.delete(e.code));
    this.listen(this.renderer.domElement,'pointermove',e=>{const r=this.mount.getBoundingClientRect();this.mouse.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);this.pointerActive=true;});
    this.listen(this.renderer.domElement,'pointerdown',e=>{if(this.sim.mode!=='playing')return;e.preventDefault();this.renderer.domElement.focus();this.audio.start();this.aim();if(e.button===0){this.left=true;this.sim.attack(false);}if(e.button===2){this.right=true;this.sim.attack(true);}});
    this.listen(window,'pointerup',e=>{if(e.button===0)this.left=false;if(e.button===2)this.right=false;});
    this.listen(this.renderer.domElement,'contextmenu',e=>e.preventDefault());
    this.listen(this.renderer.domElement,'wheel',e=>{e.preventDefault();if(this.sim.mode==='ready')return;const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?this.mount.clientHeight:1);this.zoomTarget=clamp(this.zoomTarget+clamp(delta,-240,240)*.016,17,30);},{passive:false});
    this.listen(this.renderer.domElement,'pointerleave',()=>{this.pointerActive=false;this.left=false;this.right=false;});
    this.listen(window,'blur',()=>{if(this.sim.mode==='playing')this.togglePause();this.keys.clear();this.left=this.right=false;});
    this.listen(document,'visibilitychange',()=>{if(document.hidden&&this.sim.mode==='playing')this.togglePause();});
    this.listen(this.renderer.domElement,'webglcontextlost',e=>{e.preventDefault();if(this.sim.mode==='playing')this.togglePause();this.onState({...this.sim.snapshot(),banner:'Graphics interrupted',sub:'RELOAD TO RETURN TO THE SHRINE'});});
  }
  resize(){const w=this.mount.clientWidth,h=this.mount.clientHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);this.composer?.setSize(w,h);}
  setMuted(v){this.audio.mute(v);}
  start(){
    this.audio.start();this.sim.reset();this.keys.clear();this.left=this.right=false;this.yaw=.52;this.zoom=this.zoomTarget=22;this.shake=0;this.uiClock=0;
    if(this.arenaIndex!==0)this.setArena(0);
    this.updateCamera(0,true);
    for(const rig of this.actors.values())this.removeActor(rig);this.actors.clear();for(const s of this.shots.values())this.disposeEffect(s);this.shots.clear();for(const e of this.effects)this.disposeEffect(e.mesh);this.effects=[];this.particles=[];
    this.renderer.domElement.focus();this.onState(this.sim.snapshot());
  }
  togglePause(){if(this.sim.mode==='playing'){this.sim.mode='paused';this.audio.ctx?.suspend();}else if(this.sim.mode==='paused'){this.sim.mode='playing';this.audio.ctx?.resume();}this.keys.clear();this.left=this.right=false;this.onState(this.sim.snapshot());}
  movement(){const x=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0),z=(this.keys.has('KeyS')?1:0)-(this.keys.has('KeyW')?1:0);return{mx:x*Math.cos(this.yaw)+z*Math.sin(this.yaw),mz:-x*Math.sin(this.yaw)+z*Math.cos(this.yaw)};}
  aim(){this.raycaster.setFromCamera(this.mouse,this.camera);if(this.raycaster.ray.intersectPlane(this.ground,this.aimPoint)){const p=this.sim.player;this.cursor.position.set(this.aimPoint.x,.03,this.aimPoint.z);return Math.atan2(this.aimPoint.x-p.x,this.aimPoint.z-p.z);}return this.sim.player.angle;}
  setArena(index){
    // Retain shared actor materials while releasing only the outgoing environment.
    const shared=new Set(Object.values(palette)),geometries=new Set(),materials=new Set(),textures=new Set();
    for(const root of [this.world,this.worldDynamics])if(root){root.removeFromParent();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])if(!shared.has(m)){materials.add(m);if(m.map)textures.add(m.map);}});}
    for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
    const arena=ARENAS[index],built=buildWorld(this.scene,index);this.world=built.world;this.worldDynamics=built.dynamics;this.animated=built.animated;this.arenaIndex=index;
    this.scene.background.set(arena.background);this.scene.fog.color.set(arena.fog);
    this.rim.color.set(arena.accent);this.shrineLight.color.set(arena.accent);this.shrineLight.position.x=arena.shrineX;
    const positions=[...arena.obstacles, {x:-12,z:10},{x:12,z:-11}];
    this.lanterns.forEach((l,i)=>{const p=positions[i];l.visible=!!p;if(p)l.position.set(p.x,3.4,p.z);l.color.set(index===0?0xff9c45:arena.accent);});
    this.mount.dataset.arena=arena.name;
  }
  updateCamera(dt,instant=false){
    const p=this.sim.player,intro=this.sim.mode==='ready',active=this.sim.mode==='playing';
    if(active&&this.pointerActive&&Math.abs(this.mouse.x)>.92)this.yaw-=Math.sign(this.mouse.x)*(Math.abs(this.mouse.x)-.92)*dt*5;
    if(active)this.yaw+=((this.keys.has('KeyE')?1:0)-(this.keys.has('KeyQ')?1:0))*dt*.8;
    this.yaw=clamp(this.yaw,-.18,1.22);this.zoom+=(this.zoomTarget-this.zoom)*(instant?1:1-Math.exp(-dt*10));
    const desired=new T.Vector3(intro?-3.5:p.x*.6,0,intro?-1.7:p.z*.6-1.2);if(intro)desired.add(new T.Vector3(-Math.cos(this.yaw)*2,0,Math.sin(this.yaw)*2));
    this.target.lerp(desired,instant?1:1-Math.exp(-dt*3.2));
    const radius=intro?31:this.zoom,vertical=intro?25:radius*.87+1.4;const cameraPosition=new T.Vector3(Math.sin(this.yaw)*radius,vertical,Math.cos(this.yaw)*radius).add(this.target);
    if(this.shake>0&&active){cameraPosition.x+=(Math.random()-.5)*this.shake;cameraPosition.y+=(Math.random()-.5)*this.shake*.5;this.shake*=Math.exp(-dt*18);}
    this.camera.position.copy(cameraPosition);this.camera.lookAt(this.target);
  }
  makeEnemy(e){
    const rig=buildActor(e.type);rig.id=e.id;this.scene.add(rig.root);
    rig.entity=e;
    rig.materials=[];rig.root.traverse(o=>{if(o.isMesh){o.material=o.material.clone();o.material.userData.baseEmissive=o.material.emissive?.clone();o.material.userData.baseIntensity=o.material.emissiveIntensity;rig.materials.push(o.material);}});
    const hp=new T.Group(),bg=new T.Mesh(new T.PlaneGeometry(.95,.065),new T.MeshBasicMaterial({color:0x101b22,depthTest:false,transparent:true,opacity:.85}));hp.add(bg);const fill=new T.Mesh(new T.PlaneGeometry(.9,.036),new T.MeshBasicMaterial({color:0xf1656f,depthTest:false,transparent:true}));fill.position.z=.002;hp.add(fill);hp.userData.fill=fill;hp.renderOrder=30;this.scene.add(hp);rig.health=hp;
    const warning=ring(this.scene,e.type==='ranged'?1.4:1.05,.026,new T.MeshBasicMaterial({color:C.red,transparent:true,opacity:0,depthWrite:false}),e.x,.035,e.z,true);warning.castShadow=false;rig.warning=warning;
    const line=new T.Mesh(new T.PlaneGeometry(.075,18).rotateX(-Math.PI/2).translate(0,0,9),new T.MeshBasicMaterial({color:C.red,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));this.scene.add(line);rig.line=line;
    this.actors.set(e.id,rig);return rig;
  }
  attachEnemyVisual(rig){
    const template=this.enemyTemplates.get(rig.type);if(rig.visual||!template)return;
    rig.visual=instantiateEnemyModel(template);rig.root.add(rig.visual);rig.body.visible=false;
    rig.materials.push(...rig.visual.userData.materials);
  }
  removeActor(rig){disposeEnemyModel(rig.visual);rig.root.removeFromParent();rig.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});this.disposeEffect(rig.health);this.disposeEffect(rig.warning);this.disposeEffect(rig.line);}
  disposeEffect(object){if(!object)return;object.removeFromParent();object.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
  burst(x,z,count,color,heavy=false){for(let i=0;i<count&&this.particles.length<790;i++){const angle=Math.random()*TAU,speed=1+Math.random()*(heavy?8:5);this.particles.push({x,y:.8+Math.random()*.8,z,vx:Math.sin(angle)*speed,vy:1+Math.random()*(heavy?6:4),vz:Math.cos(angle)*speed,life:.25+Math.random()*.65,total:.9,size:Math.random()*.05+.023,color:new T.Color(color).multiplyScalar(1.2),fragment:i%4===0});}}
  arc(x,z,angle,color,heavy=false,enemy=false){
    const positions=[],colors=[],n=48,reach=heavy?3.35:enemy?1.8:2.75;
    for(let i=0;i<n;i++){const a=-1.5+i/n*3.3,b=-1.5+(i+1)/n*3.3,r1=reach*(.78+.16*i/n),r2=reach;const points=[[a,r1],[a,r2],[b,r2],[a,r1],[b,r2],[b,r1]];for(const [q,r] of points){positions.push(Math.sin(q)*r,.85+Math.cos(q)*.1,Math.cos(q)*r);const c=new T.Color(color).multiplyScalar(.7+(i/n)*2.2);colors.push(...c.toArray());}}
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const mat=new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,transparent:true,opacity:.9,blending:T.AdditiveBlending,depthWrite:false});const m=new T.Mesh(geo,mat);m.position.set(x,0,z);m.rotation.y=angle;this.scene.add(m);this.effects.push({mesh:m,life:heavy?.3:.21,total:heavy?.3:.21,type:'slash'});
    const edge=ring(this.scene,reach,.024,new T.MeshBasicMaterial({color:0xffced6,transparent:true,opacity:.95,blending:T.AdditiveBlending,depthWrite:false}),x,.91,z,true,-angle-.05,2.95);this.effects.push({mesh:edge,life:.12,total:.12,type:'fade'});
  }
  pulse(x,z,color,max=2,life=.4){const m=ring(this.scene,.5,.03,new T.MeshBasicMaterial({color,transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false}),x,.045,z,true);this.effects.push({mesh:m,life,total:life,type:'pulse',max});}
  events(){for(const ev of this.sim.events){this.audio.play(ev);switch(ev.type){
    case'swing':this.arc(ev.x,ev.z,ev.angle,ev.heavy?0xff889b:0xff284a,ev.heavy);if(ev.heavy)this.pulse(ev.x,ev.z,0xff526c,6,.4);break;
    case'arena':this.setArena(ev.arena);this.target.set(0,0,1.8);this.updateCamera(0,true);this.left=this.right=false;break;
    case'enemySwing':this.arc(ev.x,ev.z,ev.angle,C.red,false,true);break;
    case'hit':this.burst(ev.x,ev.z,ev.heavy?32:18,0xffb979,ev.heavy);this.burst(ev.x,ev.z,7,0x9bffff);break;
    case'impact':this.shake=ev.heavy?.32:.14;break;
    case'destroy':this.burst(ev.x,ev.z,44,0xff5a45,true);this.burst(ev.x,ev.z,15,0xd6cdad,true);this.pulse(ev.x,ev.z,C.red,4,.45);this.shake=.22;break;
    case'spawn':this.pulse(ev.enemy.x,ev.enemy.z,C.red,3,1.3);break;
    case'dodge':this.pulse(ev.x,ev.z,C.cyan,2,.3);break;
    case'damage':this.shake=.5;this.burst(ev.x,ev.z,20,0xf04359);this.mount.parentElement.classList.add('damage-flash');clearTimeout(this.flashTimer);this.flashTimer=setTimeout(()=>this.mount.parentElement?.classList.remove('damage-flash'),220);break;
    case'projectileImpact':this.burst(ev.x,ev.z,18,C.red);break;
    case'deflect':this.burst(ev.x,ev.z,25,C.cyan);this.pulse(ev.x,ev.z,C.cyan,3,.4);break;
    case'victory':this.pulse(0,0,C.cyan,50,2.2);this.burst(this.sim.player.x,this.sim.player.z,65,C.cyan,true);break;
  }}this.sim.events=[];}
  visuals(dt){
    const sim=this.sim,p=sim.player,t=this.t;
    updatePlayerModel(this.playerModel,sim,dt);
    animateActor(this.player,p,t,dt);this.player.root.visible=sim.mode!=='defeat'||Math.sin(t*8)>.05;
    this.playerLight.position.set(p.x,1.2,p.z);this.footRing.position.set(p.x,.035,p.z);this.footRing.material.emissiveIntensity=p.dodge>0?4:1;
    this.cursor.visible=sim.mode==='playing'&&this.pointerActive&&Math.abs(this.aimPoint.x)<11.8&&this.aimPoint.z>-11&&this.aimPoint.z<12;
    for(const e of sim.enemies){let rig=this.actors.get(e.id);if(!rig)rig=this.makeEnemy(e);this.attachEnemyVisual(rig);animateActor(rig,e,t,dt);
      rig.visual?.userData.enemyAnimation.update(sim,dt,e);
      rig.materials.forEach(m=>{if(m.emissive){m.emissive.copy(e.flash>0?new T.Color(0xffddbb):m.userData.baseEmissive);m.emissiveIntensity=e.flash>0?2:m.userData.baseIntensity;}});
      rig.health.position.set(e.x,e.type==='ranged'?3.65:2.55,e.z);rig.health.quaternion.copy(this.camera.quaternion);rig.health.visible=e.hp<e.maxHp&&e.state!=='spawn';rig.health.userData.fill.scale.x=Math.max(0,e.hp/e.maxHp);rig.health.userData.fill.position.x=-(1-e.hp/e.maxHp)*.45;
      const warn=e.state==='windup'||e.state==='charge',spawn=e.state==='spawn';rig.warning.position.set(e.x,.038,e.z);rig.warning.material.opacity=warn?.5+Math.sin(t*18)*.2:spawn?.35:0;rig.warning.scale.setScalar(warn?1+(Math.sin(t*10)+1)*.07:1);
      rig.line.position.set(e.x,.025,e.z);rig.line.rotation.set(0,e.attackAngle,0);rig.line.material.opacity=e.state==='charge'?(e.timer<.28?.65:.12+Math.sin(t*23)*.07):0;
    }
    for(const [id,rig] of this.actors)if(!sim.enemies.some(e=>e.id===id)){
      if(rig.visual&&rig.entity.hp<=0){
        if(!rig.deathEntity){rig.deathEntity={...rig.entity,state:'dead'};rig.deathTime=0;}
        rig.health.visible=rig.warning.visible=rig.line.visible=false;
        rig.visual.userData.enemyAnimation.update(sim,dt,rig.deathEntity);rig.deathTime+=dt;
        for(const m of rig.visual.userData.materials){m.transparent=true;m.opacity=Math.min(1,Math.max(0,(.95-rig.deathTime)/.15));}
        if(rig.deathTime<.95)continue;
      }
      this.removeActor(rig);this.actors.delete(id);
    }
    for(const s of sim.projectiles){let obj=this.shots.get(s.id);if(!obj){obj=new T.Group();const core=new T.Mesh(new T.SphereGeometry(.15,10,8),glow(0xffd3be,4));obj.add(core);const orb=new T.Mesh(new T.SphereGeometry(.25,10,8),new T.MeshBasicMaterial({color:C.red,transparent:true,opacity:.65,blending:T.AdditiveBlending,depthWrite:false}));orb.scale.set(.65,.65,2.7);obj.add(orb);const halo=new T.PointLight(C.red,3,3);obj.add(halo);this.scene.add(obj);this.shots.set(s.id,obj);}obj.position.set(s.x,1.05,s.z);obj.rotation.y=Math.atan2(s.vx,s.vz);this.particles.push({x:s.x,y:1.05,z:s.z,vx:0,vy:0,vz:0,life:.15,total:.15,size:.07,color:new T.Color(C.red).multiplyScalar(2),fragment:false});}
    for(const [id,obj] of this.shots)if(!sim.projectiles.some(s=>s.id===id)){this.disposeEffect(obj);this.shots.delete(id);}
    if(p.dodge>0){for(let i=0;i<3;i++)this.particles.push({x:p.x+(Math.random()-.5)*.4,y:.3+Math.random()*1.5,z:p.z+(Math.random()-.5)*.4,vx:-p.dx*3,vy:0,vz:-p.dz*3,life:.25,total:.25,size:.06,color:new T.Color(C.cyan).multiplyScalar(2),fragment:false});}
    this.particles=this.particles.filter(pt=>{pt.life-=dt;if(pt.life<=0)return false;pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;pt.z+=pt.vz*dt;if(pt.fragment)pt.vy-=12*dt;if(pt.y<.06){pt.y=.06;pt.vy=Math.abs(pt.vy)*.3;pt.vx*=.8;pt.vz*=.8;}return true;});
    const count=Math.min(800,this.particles.length);this.particleMesh.count=count;for(let i=0;i<count;i++){const pt=this.particles[i];this.dummy.position.set(pt.x,pt.y,pt.z);this.dummy.scale.set(pt.size,pt.size,pt.size*(pt.fragment?1.2:4)*Math.min(1,pt.life*8));this.dummy.rotation.set(t*3+i,t+i,0);this.dummy.updateMatrix();this.particleMesh.setMatrixAt(i,this.dummy.matrix);this.particleMesh.setColorAt(i,pt.color.clone().multiplyScalar(Math.min(1,pt.life*5)));}this.particleMesh.instanceMatrix.needsUpdate=true;if(this.particleMesh.instanceColor)this.particleMesh.instanceColor.needsUpdate=true;
    this.effects=this.effects.filter(e=>{e.life-=dt;if(e.life<=0){this.disposeEffect(e.mesh);return false;}e.mesh.material.opacity=e.life/e.total*.9;if(e.type==='pulse')e.mesh.scale.setScalar(1+(1-e.life/e.total)*e.max);if(e.type==='slash'){e.mesh.rotation.y+=dt*1.8;e.mesh.scale.multiplyScalar(1+dt*.5);}return true;});
    for(let i=0;i<this.animated.flames.length;i++){const flame=this.animated.flames[i];flame.scale.y=2.2+Math.sin(t*13+i)*.4;flame.scale.x=.85+Math.sin(t*17+i)*.16;}
    for(const holo of this.animated.holograms)holo.position.y=1.6+Math.sin(t*.8)*.035;
    const pos=this.animated.petals.geometry.attributes.position;for(let i=0;i<pos.count;i++){pos.setY(i,pos.getY(i)-dt*(.12+(i%4)*.05));pos.setX(i,pos.getX(i)+dt*(.13+Math.sin(t+i)*.07));if(pos.getY(i)<.12)pos.setY(i,8);if(pos.getX(i)>17)pos.setX(i,-17);}pos.needsUpdate=true;
  }
  loop(now){if(this.disposed)return;const raw=(now-this.last)/1000,dt=clamp(raw,0,.04);this.last=now;const paused=this.sim.mode==='paused';if(!paused)this.t+=dt;
    const m=this.movement(),angle=this.pointerActive?this.aim():Math.hypot(m.mx,m.mz)>.1?Math.atan2(m.mx,m.mz):this.sim.player.angle;
    this.sim.update(dt,{...m,angle,light:this.left,heavy:this.right});this.events();this.updateCamera(dt);
    if(!paused)this.visuals(dt);this.audio.update(dt,this.sim.mode==='playing',this.sim.wave);
    this.composer.render();this.uiClock+=dt;if(this.uiClock>.08){this.uiClock=0;this.onState(this.sim.snapshot());if(import.meta.env.DEV)this.mount.dataset.diagnostics=JSON.stringify({calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,frameMs:Math.round(raw*1000),mode:this.sim.mode});}
    // Reduce only render resolution when a sustained slow device needs it, preserving simulation timing.
    if(this.t>5&&this.quality===1){this.frameTimes.push(raw);if(this.frameTimes.length>150){const avg=this.frameTimes.reduce((a,b)=>a+b,0)/this.frameTimes.length;if(avg>.027){this.quality=.8;this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1));this.composer.setPixelRatio(Math.min(window.devicePixelRatio,1));this.resize();}this.frameTimes=[];}}
    this.frame=requestAnimationFrame(this.loop);
  }
  dispose(){this.disposed=true;cancelAnimationFrame(this.frame);clearTimeout(this.flashTimer);for(const f of this.handlers)f();this.audio.dispose();disposePlayerModel(this.playerModel);for(const rig of this.actors.values())disposeEnemyModel(rig.visual);for(const template of this.enemyTemplates.values())disposePlayerModel(template);this.enemyTemplates.clear();this.scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){m.map?.dispose();m.dispose();}}});this.composer.dispose();this.renderer.dispose();this.renderer.domElement.remove();if(import.meta.env.DEV)delete window.__neonRonin;}
}
