export const TAU = Math.PI * 2;
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const angleDelta = (a, b) => Math.atan2(Math.sin(b-a), Math.cos(b-a));
export const distance = (a, b) => Math.hypot(a.x-b.x, a.z-b.z);
export const OBSTACLES = [{x:-8,z:-5,r:1.13},{x:8,z:-5,r:1.13},{x:-8,z:6,r:1.13},{x:8,z:6,r:1.13}];
export const ARENAS = [
  {name:'The Silent Shrine',accent:0x4ae8e1,fog:0x102732,background:0x07151f,shrineX:0,medallionZ:0,obstacles:OBSTACLES},
  {name:'The Ember Gates',accent:0xffa047,fog:0x34251e,background:0x1b1112,shrineX:-4,medallionZ:-5,obstacles:[{x:-5,z:0,r:1.13},{x:5,z:0,r:1.13}]},
  {name:'The Moon Terrace',accent:0xb69aff,fog:0x25213b,background:0x0f1024,shrineX:4,medallionZ:3,obstacles:[{x:-3.8,z:-6.8,r:1.13},{x:3.8,z:-6.8,r:1.13},{x:-3.8,z:6.8,r:1.13},{x:3.8,z:6.8,r:1.13}]},
];
export const WAVES = [
  [{type:'melee',x:-5,z:-8},{type:'melee',x:5,z:-8},{type:'melee',x:0,z:-10}],
  [{type:'melee',x:-10,z:-7},{type:'melee',x:10,z:2},{type:'melee',x:-9,z:9},{type:'ranged',x:6,z:-10}],
  [{type:'melee',x:-10,z:-8},{type:'melee',x:10,z:8},{type:'melee',x:-10,z:8},{type:'melee',x:9,z:-8},{type:'ranged',x:0,z:-10}],
];
export const WAVE_PACKS = [1,2,3];
export const TOTAL_HOSTILES = WAVES.reduce((n,w,i)=>n+w.length*WAVE_PACKS[i],0);
const TITLES = ['The shrine awakens', 'Steel in the silence', 'The last resistance'];
const SUBS = ['WAVE I · MELEE DRONES', 'WAVE II · SENTINEL INBOUND', 'FINAL WAVE · SURVIVE'];
export class Simulation {
  constructor() { this.mode='ready'; this.reset(); this.mode='ready'; }
  reset() {
    this.mode='playing'; this.time=0; this.wave=0; this.arena=0; this.transitioning=false; this.kills=0; this.combo=0; this.best=0; this.comboTime=0;
    this.player={x:0,z:5,angle:Math.PI,hp:100,attack:null,dodge:0,dodgeCooldown:0,heavyCooldown:0,invuln:0,comboStep:0,lastAttack:-10,move:0,dx:0,dz:0};
    this.enemies=[]; this.projectiles=[]; this.events=[]; this.nextId=1; this.nextWave=2; this.reserves=0; this.reinforceTimer=null; this.banner='The silent shrine'; this.sub='PURIFY THE TEMPLE'; this.bannerTime=2; this.hitStop=0;
  }
  event(type, data={}) { this.events.push({type,...data}); }
  get obstacles() { return ARENAS[this.arena].obstacles; }
  startWave() {
    this.wave++;
    this.reserves=WAVE_PACKS[this.wave-1]-1;
    this.spawnPack();
    this.banner=TITLES[this.wave-1]; this.sub=`${ARENAS[this.arena].name.toUpperCase()} · ${SUBS[this.wave-1]}`; this.bannerTime=3; this.event('wave',{wave:this.wave});
  }
  spawnPack() {
    for (const [i, def] of WAVES[this.wave-1].entries()) {
      const hp = def.type==='melee' ? 250 + (this.wave-1)*55 : 520 + (this.wave-2)*90;
      const enemy={...def,id:this.nextId++,hp,maxHp:hp,angle:0,state:'spawn',timer:1.25+i*.23,cooldown:.8+i*.45,stun:0,flash:0,vx:0,vz:0,move:0,attackAngle:0};
      this.enemies.push(enemy); this.event('spawn',{enemy});
    }
  }
  collide(entity,r=.43) {
    entity.x=clamp(entity.x,-11.6+r,11.6-r); entity.z=clamp(entity.z,-10.7+r,11.6-r);
    for (const o of this.obstacles) { const d=distance(entity,o); if(d<o.r+r){const a=Math.atan2(entity.x-o.x,entity.z-o.z);entity.x=o.x+Math.sin(a)*(o.r+r);entity.z=o.z+Math.cos(a)*(o.r+r);} }
  }
  obstructed(a,b) {
    for (const o of this.obstacles) { const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz; const t=clamp(((o.x-a.x)*dx+(o.z-a.z)*dz)/(l||1),0,1); if(Math.hypot(a.x+t*dx-o.x,a.z+t*dz-o.z)<o.r) return true; } return false;
  }
  attack(heavy=false) {
    const p=this.player;
    if(this.mode!=='playing'||this.transitioning||p.dodge>0)return false;
    if(p.attack) { if(p.attack.t > p.attack.duration*.4 && !heavy) p.attack.queued=true; return false; }
    if(heavy&&p.heavyCooldown>0)return false;
    p.comboStep = heavy ? 0 : (this.time-p.lastAttack<1.1 ? (p.comboStep%3)+1 : 1);
    p.lastAttack=this.time;
    const step=p.comboStep, duration=heavy?.66:[0,.32,.36,.46][step];
    // A narrow aim assist makes nearby targets reliable without turning the character away from the cursor.
    let target=null, nearest=3.4;
    for(const e of this.enemies){const d=distance(p,e),a=Math.atan2(e.x-p.x,e.z-p.z);if(e.state!=='spawn'&&d<nearest&&Math.abs(angleDelta(p.angle,a))<.8){target=e;nearest=d;}}
    if(target) p.angle=Math.atan2(target.x-p.x,target.z-p.z);
    p.attack={heavy,step,t:0,duration,hit:false,angle:p.angle,queued:false};
    if(heavy)p.heavyCooldown=1.35;
    this.event('swing',{x:p.x,z:p.z,angle:p.angle,heavy,step}); return true;
  }
  dodge(mx,mz) {
    const p=this.player;if(this.mode!=='playing'||this.transitioning||p.dodgeCooldown>0)return false;
    let l=Math.hypot(mx,mz);if(l<.1){mx=Math.sin(p.angle);mz=Math.cos(p.angle);l=1;}
    p.dx=mx/l;p.dz=mz/l;p.dodge=.29;p.invuln=.34;p.dodgeCooldown=.9;p.attack=null;
    this.event('dodge',{x:p.x,z:p.z,angle:Math.atan2(p.dx,p.dz)});return true;
  }
  damagePlayer(amount,source) {
    const p=this.player;if(p.invuln>0||this.mode!=='playing')return false;
    p.hp=Math.max(0,p.hp-amount);p.invuln=.7;this.combo=0;this.comboTime=0;this.event('damage',{x:p.x,z:p.z,amount,source});
    if(p.hp<=0){this.mode='defeat';p.attack=null;this.event('defeat');}return true;
  }
  hitEnemy(e,amount,angle,heavy) {
    e.hp-=amount;e.stun=heavy?.56:.2;e.flash=.12;e.vx=Math.sin(angle)*(heavy?6:2.6);e.vz=Math.cos(angle)*(heavy?6:2.6);
    if(e.state==='windup' || e.state==='charge') {e.state='recover';e.timer=heavy?1.1:.55;}
    this.combo++;this.comboTime=3;this.best=Math.max(this.best,this.combo);this.hitStop=heavy?.055:.029;
    this.event('hit',{x:e.x,z:e.z,angle,heavy,amount,id:e.id});
    if(e.hp<=0){this.kills++;this.player.hp=Math.min(100,this.player.hp+3);e.state='dead';this.event('destroy',{x:e.x,z:e.z,id:e.id,typeName:e.type});}
  }
  update(dt,input={}) {
    if(this.mode!=='playing')return;
    dt=Math.min(dt,.04); if(this.hitStop>0){this.hitStop-=dt;return;}
    this.time+=dt;const p=this.player;
    this.bannerTime-=dt;if(this.bannerTime<=0)this.banner='';
    this.comboTime-=dt;if(this.comboTime<=0)this.combo=0;
    p.invuln=Math.max(0,p.invuln-dt);p.heavyCooldown=Math.max(0,p.heavyCooldown-dt);p.dodgeCooldown=Math.max(0,p.dodgeCooldown-dt);
    if(this.transitioning){
      p.move=0;this.nextWave-=dt;
      if(this.nextWave<=2&&this.arena!==this.wave){
        this.arena=this.wave;Object.assign(p,{x:0,z:5,angle:Math.PI,attack:null,dodge:0});
        this.event('arena',{arena:this.arena});
      }
      if(this.nextWave<=0){this.transitioning=false;this.startWave();this.nextWave=null;}
      return;
    }
    const mx=input.mx||0,mz=input.mz||0,l=Math.hypot(mx,mz), nx=l>0?mx/l:0,nz=l>0?mz/l:0;
    if(p.dodge>0){p.dodge-=dt;const speed=19*(.65+.35*Math.max(0,p.dodge/.29));p.x+=p.dx*dt*speed;p.z+=p.dz*dt*speed;p.move=2;}
    else {
      const speed=p.attack?3.0:6.1;p.x+=nx*dt*speed;p.z+=nz*dt*speed;p.move=l>0?1:0;
      if(!p.attack&&Number.isFinite(input.angle))p.angle+=angleDelta(p.angle,input.angle)*Math.min(1,dt*24);
    }
    this.collide(p);
    if(p.attack){const a=p.attack;a.t+=dt;p.angle=a.angle;
      if(a.t<.16){p.x+=Math.sin(a.angle)*dt*2.5;p.z+=Math.cos(a.angle)*dt*2.5;this.collide(p);}
      if(!a.hit&&a.t>=(a.heavy?.27:.085)){
        a.hit=true;let count=0;
        const damage=a.heavy?64:[0,18,24,36][a.step],reach=a.heavy?3.4:2.8,arc=a.heavy?1.75:1.48;
        for(const e of this.enemies){if(e.state==='dead'||e.state==='spawn')continue;const d=distance(p,e),angle=Math.atan2(e.x-p.x,e.z-p.z);if(d<reach&&Math.abs(angleDelta(a.angle,angle))<arc&&!this.obstructed(p,e)){this.hitEnemy(e,damage,angle,a.heavy);count++;}}
        if(count>0)this.event('impact',{heavy:a.heavy,count});
      }
      if(a.t>=a.duration){const queued=a.queued;p.attack=null;if(queued)this.attack(false);}
    }
    if(input.light&&!p.attack)this.attack(false);
    if(input.heavy&&!p.attack)this.attack(true);
    for(const e of this.enemies){
      if(e.state==='dead')continue;
      e.flash=Math.max(0,e.flash-dt);e.stun=Math.max(0,e.stun-dt);e.cooldown-=dt;
      e.x+=e.vx*dt;e.z+=e.vz*dt;e.vx*=Math.exp(-9*dt);e.vz*=Math.exp(-9*dt);this.collide(e,e.type==='ranged'?.75:.5);e.move=0;
      if(e.state==='spawn'){e.timer-=dt;if(e.timer<=0)e.state='approach';continue;}
      if(e.stun>0)continue;
      const d=distance(e,p),aim=Math.atan2(p.x-e.x,p.z-e.z);
      if(e.state==='recover'){e.timer-=dt;if(e.timer<=0)e.state='approach';continue;}
      if(e.state==='windup'){
        e.timer-=dt;
        if(e.timer>.15){e.angle+=angleDelta(e.angle,aim)*dt*5;e.attackAngle=e.angle;}
        if(e.timer<=0){e.state='slash';e.timer=.19;e.didHit=false;this.event('enemySwing',{x:e.x,z:e.z,angle:e.attackAngle});}continue;
      }
      if(e.state==='slash'){
        e.timer-=dt;e.x+=Math.sin(e.attackAngle)*dt*7;e.z+=Math.cos(e.attackAngle)*dt*7;this.collide(e);
        if(!e.didHit&&distance(e,p)<1.65&&Math.abs(angleDelta(e.attackAngle,aim))<1.25&&!this.obstructed(e,p)){this.damagePlayer(this.wave===3?12:10,e);e.didHit=true;}
        if(e.timer<=0){e.state='recover';e.timer=.7;e.cooldown=.5;}continue;
      }
      if(e.state==='charge'){
        e.timer-=dt;
        if(e.timer>.28){e.angle+=angleDelta(e.angle,aim)*Math.min(1,dt*6);e.attackAngle=e.angle;}
        if(e.timer<=0){const vx=Math.sin(e.attackAngle),vz=Math.cos(e.attackAngle);this.projectiles.push({id:this.nextId++,x:e.x+vx*1.2,z:e.z+vz*1.2,vx:vx*9,vz:vz*9,life:5});this.event('shot',{x:e.x,z:e.z,angle:e.attackAngle});e.state='recover';e.timer=this.wave===3?1.55:2.05;}continue;
      }
      e.angle+=angleDelta(e.angle,aim)*Math.min(1,dt*8);
      if(e.type==='melee'){
        if(d<1.95&&e.cooldown<=0&&!this.obstructed(e,p)){e.state='windup';e.timer=this.wave===3?.55:.72;e.attackAngle=aim;this.event('meleeWarning',{x:e.x,z:e.z});}
        else if(d>1.3){let dx=Math.sin(aim),dz=Math.cos(aim);
          // Soft separation keeps silhouettes readable. A tangential force guides drones around pillars.
          for(const other of this.enemies){if(other===e||other.state==='dead')continue;const sep=distance(e,other);if(sep<1.7&&sep>.01){dx+=(e.x-other.x)/sep*(1.7-sep)*1.5;dz+=(e.z-other.z)/sep*(1.7-sep)*1.5;}}
          for(const o of this.obstacles){const sep=distance(e,o);if(sep<2.5){const side=e.id%2?1:-1;dx+=(e.x-o.x)/sep*(2.5-sep)*1.5+(e.z-o.z)/sep*side;dz+=(e.z-o.z)/sep*(2.5-sep)*1.5-(e.x-o.x)/sep*side;}}
          const n=Math.hypot(dx,dz)||1,speed=this.wave===3?3.3:2.85;e.x+=dx/n*speed*dt;e.z+=dz/n*speed*dt;e.move=1;this.collide(e,.5);
        }
      } else {
        if((d<5||d>10)&&!this.obstructed(e,p)){const sign=d<5?-1:1;e.x+=Math.sin(aim)*dt*1.15*sign;e.z+=Math.cos(aim)*dt*1.15*sign;e.move=.6;this.collide(e,.8);}
        if(e.cooldown<=0){e.state='charge';e.timer=1.35;e.attackAngle=aim;this.event('warning',{x:e.x,z:e.z});}
      }
    }
    this.enemies=this.enemies.filter(e=>e.state!=='dead');
    for(const shot of this.projectiles){shot.life-=dt;shot.x+=shot.vx*dt;shot.z+=shot.vz*dt;
      if(distance(shot,p)<.65){if(this.damagePlayer(16,shot)||p.dodge>0){shot.life=0;this.event(p.dodge>0?'deflect':'projectileImpact',{x:shot.x,z:shot.z});}}
      if(Math.abs(shot.x)>12||shot.z>12||shot.z<-12||this.obstacles.some(o=>distance(o,shot)<o.r)){shot.life=0;this.event('projectileImpact',{x:shot.x,z:shot.z});}
    }
    this.projectiles=this.projectiles.filter(s=>s.life>0);
    if(this.mode!=='playing')return;
    if(this.enemies.length===0){
      if(this.reserves>0){
        if(this.reinforceTimer===null){this.reinforceTimer=2.6;this.banner='Steel answers steel';this.sub='REINFORCEMENTS INBOUND';this.bannerTime=2.4;this.projectiles=[];}
        this.reinforceTimer-=dt;
        if(this.reinforceTimer<=0){this.reserves--;this.reinforceTimer=null;this.spawnPack();}
        return;
      }
      if(this.wave===3){this.mode='victory';this.projectiles=[];this.event('victory');}
      else {if(this.nextWave===null){this.nextWave=4;this.transitioning=true;this.banner=ARENAS[this.wave].name;this.sub='WAVE CLEARED · MOVING ON · VITALITY RESTORED';this.bannerTime=4;this.player.hp=Math.min(100,p.hp+22);this.projectiles=[];p.attack=null;p.dodge=0;p.move=0;this.event('clear');}else{this.nextWave-=dt;if(this.nextWave<=0){this.startWave();this.nextWave=null;}}}
    }
  }
  snapshot(){return {mode:this.mode,hp:this.player.hp,wave:this.wave,arena:ARENAS[this.arena].name,transition:this.transitioning?Math.max(0,1-Math.abs(this.nextWave-2)/.65):0,enemies:this.enemies.length+this.reserves*(WAVES[this.wave-1]?.length||0),kills:this.kills,time:this.time,combo:this.combo,dodge:this.player.dodgeCooldown,heavy:this.player.heavyCooldown,banner:this.banner,sub:this.sub,score:this.best};}
}
