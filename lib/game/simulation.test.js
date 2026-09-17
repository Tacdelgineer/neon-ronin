import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, distance, OBSTACLES, TOTAL_HOSTILES } from './simulation.js';
const step=(s,seconds,input={})=>{for(let t=0;t<seconds;t+=1/120)s.update(1/120,input);};
function fixture(type='melee',x=0,z=2){const s=new Simulation();s.reset();s.nextWave=null;s.wave=1;s.player.x=0;s.player.z=0;s.player.angle=0;s.enemies=[{id:1,type,x,z,hp:1000,maxHp:1000,state:'approach',timer:0,cooldown:100,stun:0,flash:0,vx:0,vz:0,angle:Math.PI,move:0}];return s;}
test('movement normalizes diagonals and respects the arena and pillar collision',()=>{
  const a=fixture(),b=fixture();step(a,1,{mx:1});step(b,1,{mx:1,mz:1});assert.ok(Math.abs(Math.hypot(a.player.x,a.player.z)-Math.hypot(b.player.x,b.player.z))<.1);
  step(a,10,{mx:1});assert.ok(a.player.x<11.6);a.player.x=8;a.player.z=3;step(a,1,{mz:1});assert.ok(distance(a.player,OBSTACLES[3])>=OBSTACLES[3].r+.42);
});
test('three strikes chain and a heavy attack does more damage',()=>{
  const s=fixture();let hp=s.enemies[0].hp;for(let i=1;i<=3;i++){s.player.x=0;s.player.z=0;s.player.angle=0;s.enemies[0].x=0;s.enemies[0].z=2;s.attack();assert.equal(s.player.attack.step,i);step(s,.52);}
  assert.equal(hp-s.enemies[0].hp,78);
  s.player.x=0;s.player.z=0;s.enemies[0].x=0;s.enemies[0].z=2;hp=s.enemies[0].hp;assert.equal(s.attack(true),true);step(s,.8);assert.equal(hp-s.enemies[0].hp,64);assert.equal(s.attack(true),false);
});
test('swords do not hit behind the player or through a pillar',()=>{
  const s=fixture('melee',0,-2);s.attack();step(s,.3);assert.equal(s.enemies[0].hp,1000);
  const b=fixture('melee',8,7);b.player.x=8;b.player.z=4.1;b.attack(true);step(b,.45);assert.equal(b.enemies[0].hp,1000);
});
test('dodge cancels attacks, grants brief invulnerability, and has recovery',()=>{
  const s=fixture();s.attack();assert.ok(s.dodge(1,0));assert.equal(s.player.attack,null);assert.equal(s.damagePlayer(20),false);assert.equal(s.dodge(1,0),false);step(s,.5);assert.equal(s.damagePlayer(20),true);assert.equal(s.player.hp,80);step(s,.5);assert.equal(s.dodge(1,0),true);
});
test('sentinel telegraphs, locks aim, then emits a visible-speed projectile',()=>{
  const s=fixture('ranged',0,9);s.enemies[0].cooldown=0;step(s,.03);assert.equal(s.enemies[0].state,'charge');assert.equal(s.projectiles.length,0);step(s,1.12);const a=s.enemies[0].attackAngle;s.player.x=5;step(s,.1);assert.equal(s.enemies[0].attackAngle,a);step(s,.2);assert.ok(s.projectiles.length>0);const p=s.projectiles[0];assert.ok(Math.abs(Math.hypot(p.vx,p.vz)-9)<.01);
});
test('lethal damage yields defeat and reset clears all encounter state',()=>{const s=fixture();s.damagePlayer(100);assert.equal(s.mode,'defeat');s.reset();assert.equal(s.mode,'playing');assert.equal(s.player.hp,100);assert.equal(s.kills,0);assert.equal(s.projectiles.length,0);assert.equal(s.player.dodgeCooldown,0);});
test('pausing stops simulation and damage',()=>{const s=fixture();s.mode='paused';const before=JSON.stringify(s.snapshot());step(s,5,{mx:1,light:true});assert.equal(JSON.stringify(s.snapshot()),before);assert.equal(s.damagePlayer(20),false);});
test('three finite waves use only drones and sentinels, respect the active cap, and end in victory',()=>{
  const s=new Simulation();s.reset();const types=[];
  let frames=0;while(s.mode==='playing'&&frames++<5000){s.update(.04);if(s.enemies.some(e=>e.state!=='dead')){assert.ok(s.enemies.length<=5);types.push(...s.enemies.map(e=>e.type));for(const e of s.enemies){e.state='approach';s.hitEnemy(e,e.hp,0,true);}}}
  assert.equal(types.filter(t=>t==='melee').length,21);assert.equal(types.filter(t=>t==='ranged').length,5);assert.equal(s.kills,TOTAL_HOSTILES);assert.equal(s.mode,'victory');
});
test('a complete encounter can be won using only normal movement and combat inputs',()=>{
  const s=new Simulation();s.reset();let frames=0;
  while(s.mode==='playing'&&frames<120*420){frames++;const p=s.player,es=s.enemies.filter(e=>e.state!=='spawn').sort((a,b)=>distance(a,p)-distance(b,p)),e=es[0];let mx=0,mz=0,angle=p.angle;
    if(e){const d=distance(p,e);angle=Math.atan2(e.x-p.x,e.z-p.z);if(d>2.05){mx=Math.sin(angle);mz=Math.cos(angle); for(const o of s.obstacles){const sep=distance(p,o);if(sep<2.8){const side=1;mx+=(p.x-o.x)/sep*(2.8-sep)*1.4+(p.z-o.z)/sep*side;mz+=(p.z-o.z)/sep*(2.8-sep)*1.4-(p.x-o.x)/sep*side;}}}const danger=es.some(q=>q.state==='windup'&&q.timer<.2&&distance(q,p)<3)||s.projectiles.some(q=>distance(q,p)<2.1);if(danger&&p.dodgeCooldown<=0)s.dodge(Math.cos(angle),-Math.sin(angle));if(d<3.1&&p.dodge<=0&&!p.attack){if(p.heavyCooldown<=0)s.attack(true);else s.attack();}}
    s.update(1/120,{mx,mz,angle});s.events=[];
  }
  console.log(`Encounter: ${s.mode}, ${s.time.toFixed(1)} seconds simulation, ${s.kills}/26 kills, ${s.player.hp} vitality`);if(s.mode!=='victory')console.log(s.player,s.enemies);assert.equal(s.mode,'victory');assert.equal(s.kills,TOTAL_HOSTILES);assert.ok(s.time<300);
});
