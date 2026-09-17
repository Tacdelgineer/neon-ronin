import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ARENAS, TAU } from './simulation.js';
export const C={cyan:0x4ae8e1,red:0xff284a,gold:0xf5b865};
let seed=8371;
export function rand(a=0,b=1){seed=(seed*1664525+1013904223)>>>0;return a+(seed/4294967296)*(b-a);}
export function material(color,opts={}){return new T.MeshStandardMaterial({color,roughness:.86,metalness:.05,flatShading:true,...opts});}
export function glow(color,intensity=2){return material(color,{emissive:color,emissiveIntensity:intensity,roughness:.4});}
export const palette={dark:material(0x131e27),black:material(0x091019),armor:material(0xd0ccbb,{metalness:.28}),armorShade:material(0x717d80),redCloth:material(0x852237,{side:T.DoubleSide}),redLight:glow(C.red,2.7),cyan:glow(C.cyan,2.4),gold:material(0x9e7544,{metalness:.6}),skin:material(0xc99c84),hair:material(0x111823),moss:material(0x394c33),stone:material(0x626864)};
export function mesh(parent,geometry,mat,x=0,y=0,z=0){const o=new T.Mesh(geometry,mat);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
export function box(parent,w,h,d,mat,x=0,y=0,z=0){return mesh(parent,new T.BoxGeometry(w,h,d),mat,x,y,z);}
export function sphere(parent,r,mat,x=0,y=0,z=0,detail=0){return mesh(parent,new T.IcosahedronGeometry(r,detail),mat,x,y,z);}
export function cylinder(parent,rt,rb,h,mat,x=0,y=0,z=0,segments=8){return mesh(parent,new T.CylinderGeometry(rt,rb,h,segments),mat,x,y,z);}
export function beam(parent,a,b,r,mat,segments=6){const va=new T.Vector3(...a),vb=new T.Vector3(...b),mid=va.clone().add(vb).multiplyScalar(.5);const o=cylinder(parent,r,r*.83,va.distanceTo(vb),mat,...mid.toArray(),segments);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),vb.sub(va).normalize());return o;}
export function ring(parent,r,t,mat,x,y,z,flat=false,start=0,arc=TAU){const o=mesh(parent,new T.TorusGeometry(r,t,6,64,arc),mat,x,y,z);if(flat)o.rotation.x=-Math.PI/2;o.rotation.z=start;return o;}
function stoneTexture(){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#b6b6a6';c.fillRect(0,0,256,256);
  for(let i=0;i<2600;i++){const v=Math.floor(rand(75,180));c.fillStyle=`rgba(${v},${v},${v-10},${rand(.025,.13)})`;c.fillRect(rand(0,256),rand(0,256),rand(1,12),rand(1,6));}
  c.strokeStyle='#e2dfc55a';c.lineWidth=3;c.strokeRect(3,3,250,250);c.strokeStyle='#171d2180';c.lineWidth=2;
  for(let i=0;i<4;i++){let x=rand(0,256),y=rand(0,256);c.beginPath();c.moveTo(x,y);for(let j=0;j<4;j++){x+=rand(-25,25);y+=rand(12,36);c.lineTo(x,y);}c.stroke();}
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function batchStatic(root){
  root.updateMatrixWorld(true);const groups=new Map();root.traverse(o=>{if(o.isMesh&&!o.userData.dynamic){const key=o.material.uuid;const bucket=groups.get(key)||{mat:o.material,geos:[],objects:[]};let g=o.geometry.clone();g.applyMatrix4(o.matrixWorld);if(g.index)g=g.toNonIndexed();for(const attr of Object.keys(g.attributes))if(!['position','normal','uv'].includes(attr))g.deleteAttribute(attr);if(!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));bucket.geos.push(g);bucket.objects.push(o);groups.set(key,bucket);}});
  for(const {mat,geos,objects} of groups.values()){const merged=mergeGeometries(geos);if(!merged)continue;const m=new T.Mesh(merged,mat);m.castShadow=true;m.receiveShadow=true;root.add(m);for(const o of objects){o.removeFromParent();o.geometry.dispose();}for(const g of geos)g.dispose();}
}
export function buildWorld(scene,arenaIndex=0){
  const arena=ARENAS[arenaIndex],accent=arenaIndex===0?palette.cyan:glow(arena.accent,2.4);
  seed=8371+arenaIndex*721;const world=new T.Group(),dynamics=new T.Group();world.name=arena.name;scene.add(world,dynamics);const animated={flames:[],holograms:[],water:[],petals:null};
  const tex=stoneTexture(),stones=Array.from({length:7},(_,i)=>material(new T.Color().setHSL(arenaIndex===2?.68:.115,arenaIndex===0?.07:.15,.25+i*.032),{map:tex}));
  const stone=stones[3],stoneDark=stones[0],edge=material(0x252f33),wood=material(0x3c1d24),redwood=material(0x6e2c35),brass=palette.gold;
  const mossMats=[0x344631,0x475634,0x233b31,0x58613c].map(c=>material(c,{side:T.DoubleSide}));
  const leafMats=[0x742d43,0x9d3750,0xbc425f,0x592b40,0xc95c70].map(c=>material(c,{side:T.DoubleSide}));
  const pool=material(arenaIndex===1?0x4c3020:arenaIndex===2?0x302850:0x124149,{metalness:.62,roughness:.25,transparent:true,opacity:.85});
  box(world,28,3.5,28,edge,0,-1.94,0);
  // Individually laid, irregular stone slabs make the silhouette and floor pattern legible from above.
  for(let x=-12;x<=12;x+=1.5)for(let z=-12;z<=12;z+=1.5){
    const o=box(world,1.45,.23,1.45,stones[Math.floor(rand(0,7))],x+rand(-.015,.015),-.14+rand(-.016,.01),z);o.rotation.y=rand(-.014,.014);
  }
  for(let row=0;row<4;row++)for(let i=-7;i<=7;i++)for(const side of [-1,1]){box(world,1.78,.7,1,stones[Math.floor(rand(0,4))],i*1.82,-.63-row*.76,side*13.35);box(world,1,.7,1.78,stones[Math.floor(rand(0,4))],side*13.35,-.63-row*.76,i*1.82);}
  const circuit=(x,z,len,vertical=false,mat=accent,y=.013)=>box(world,vertical?.065:len,.035,vertical?len:.065,mat,x,y,z);
  for(const side of [-1,1]){
    for(const z of [-9,-3,3,9]){circuit(side*10,z,3);circuit(side*8.5,z+.6,1.2,true);circuit(side*9,z+1.2,1);}
    for(const x of [-6,0,6]){circuit(x,side*10.9,2);circuit(x-1,side*10.3,1.2,true);}
    for(let i=0;i<10;i++){const x=rand(-12,12);box(world,.028,rand(1,4),.025,accent,x,-2,side*13.88);}
  }
  const medallion=new T.Group();medallion.position.z=arena.medallionZ;world.add(medallion);
  if(arenaIndex===1){for(const z of [-6,0,6]){circuit(0,z,19);circuit(0,z+.25,19,false,brass);}}
  if(arenaIndex===2){for(const r of [5.5,8.5])ring(world,r,.035,accent,0,.028,0,true);}
  // Engraved central lotus medallion with inlaid cyan arcs and an eight-petal relief.
  cylinder(medallion,3.25,3.3,.06,brass,0,.005,0,64);cylinder(medallion,3.12,3.12,.07,stoneDark,0,.025,0,64);
  ring(medallion,2.98,.027,accent,0,.075,0,true);ring(medallion,2.65,.045,brass,0,.085,0,true);ring(medallion,1.11,.04,brass,0,.085,0,true);
  for(let i=0;i<16;i++){const a=i*TAU/16;const block=box(medallion,.09,.08,.27,stone,Math.sin(a)*3.02,.09,Math.cos(a)*3.02);block.rotation.y=a;}
  for(let i=0;i<8;i++){
    const group=new T.Group();group.rotation.y=i*TAU/8;medallion.add(group);
    const shape=new T.Shape();shape.moveTo(0,.35);shape.bezierCurveTo(-1.05,1.1,-.7,1.9,0,2.45);shape.bezierCurveTo(.7,1.9,1.05,1.1,0,.35);
    const petal=mesh(group,new T.ShapeGeometry(shape),brass,0,.09,0);petal.rotation.x=-Math.PI/2;
    const inner=mesh(group,new T.ShapeGeometry(shape),stone,0,.096,0);inner.rotation.x=-Math.PI/2;inner.scale.set(.7,.87,1);
  }
  cylinder(medallion,.35,.4,.12,brass,0,.11,0,8);
  function vines(x,y,z,width=1,height=3){
    for(let i=0;i<Math.floor(height*26);i++){const px=x+rand(-width,width),py=y-rand(0,height),pz=z+rand(-.22,.22);if(py<0)continue;const l=sphere(world,rand(.09,.24),mossMats[i%4],px,py,pz);l.scale.set(1,.35,1);l.rotation.set(rand(0,3),rand(0,3),rand(0,3));}
    for(let i=0;i<3;i++)beam(world,[x+rand(-width,width),y,z],[x+rand(-width,width),Math.max(.1,y-height),z+.1],.025,mossMats[0]);
  }
  function candles(x,y,z,count=4){
    for(let i=0;i<count;i++){const px=x+rand(-.32,.32),pz=z+rand(-.3,.3),h=rand(.15,.45);cylinder(world,.045,.065,h,material(0xd8b879),px,y+h/2,pz,6);const flame=mesh(dynamics,new T.SphereGeometry(.065,5,5),glow(0xffb53d,4.5),px,y+h+.09,pz);flame.scale.y=2.5;flame.castShadow=false;animated.flames.push(flame);}
  }
  function pillar(x,z,height=3.6,broken=false){
    box(world,2.1,.27,2.1,stoneDark,x,.14,z);box(world,1.77,.22,1.77,stone,x,.38,z);
    for(let k=0;k<Math.ceil(height/.65);k++){const h=Math.min(.64,height-k*.65);if(h<=0)continue;const block=box(world,1.14,h,1.16,stones[k%5],x+rand(-.025,.025),.5+k*.65+h/2,z+rand(-.025,.025));if(broken&&k===Math.ceil(height/.65)-1)block.rotation.z=.1;}
    for(const side of [-1,1])box(world,.07,height-.3,.05,brass,x+side*.42,.65+height/2,z+.586);
    circuit(x,z+.59,.65,false,accent,.7);box(world,.035,1.3,.025,accent,x+.28,1.3,z+.59);
    if(!broken){box(world,1.64,.2,1.64,stone,x,height+.56,z);box(world,1.83,.14,1.83,stoneDark,x,height+.73,z);candles(x,height+.8,z,5);}
    vines(x+.2,height+.6,z+.65,.75,height*.9);
    for(let i=0;i<5;i++){const o=box(world,rand(.18,.6),rand(.12,.4),rand(.2,.6),stones[i%5],x+rand(-1.35,1.35),.16,z+rand(-1.35,1.35));o.rotation.y=rand(0,6);}
  }
  for(const o of arena.obstacles)pillar(o.x,o.z,o.z<0?2.7:2.1,o.x<0&&o.z<0);
  for(const side of [-1,1]){
    for(const z of [-11,-1,10])pillar(side*12.7,z,z===-11?6.2:3.5,z===-1);
    // Low boundary walls, broken parapets, and shallow lotus pools.
    for(let z=-10;z<=10;z+=2){if(Math.abs(z)<4)continue;box(world,.9,.85,1.94,stoneDark,side*12.8,.35,z);box(world,1.13,.16,2.02,stone,side*12.8,.85,z);}
    const w=box(world,2.1,.04,7.5,pool,side*12.5,.05,0);w.castShadow=false;animated.water.push(w);
    for(let i=0;i<13;i++){const px=side*12.5+rand(-.8,.8),pz=rand(-3.3,3.3),pad=cylinder(world,rand(.16,.33),.15,.025,mossMats[2],px,.11,pz,12);pad.rotation.y=rand(0,6);if(i%3===0){for(let j=0;j<5;j++){const a=j*TAU/5;const petal=sphere(world,.1,leafMats[2],px+Math.sin(a)*.07,.2,pz+Math.cos(a)*.07);petal.scale.set(.5,1.2,1.1);petal.rotation.z=.6;}sphere(world,.05,glow(0xffd48c,1),px,.24,pz);}}
    vines(side*12.8,1.2,4,.6,1.5);vines(side*12.8,1.2,-4,.6,1.5);
  }
  // Elevated shrine, a suspended circuit hologram, and vermilion torii lintels.
  for(let i=0;i<5;i++)box(world,7.8-i*.2,.24,3.5-i*.42,stone,arena.shrineX,.08+i*.23,-12.25-i*.18);
  box(world,10,1.15,4,stoneDark,arena.shrineX,.44,-15.1);box(world,10.5,.2,4.5,stone,arena.shrineX,1.08,-15.1);
  function portal(x,z,scale=1){
    const g=new T.Group();g.position.set(x,1.2,z);g.scale.setScalar(scale);world.add(g);
    for(const s of [-1,1]){box(g,.55,5,.6,redwood,s*2.2,2.5,0);box(g,.7,.3,.75,brass,s*2.2,.15,0);box(g,.75,.22,.78,brass,s*2.2,4.3,0);}
    box(g,5.7,.25,.75,wood,0,4.45,0);box(g,6.25,.33,.95,redwood,0,5.05,0);box(g,6.5,.17,1.05,wood,0,5.29,0);
    for(const s of [-1,1]){const tip=box(g,.8,.3,.94,redwood,s*3.2,5.13,0);tip.rotation.z=s*.15;}
    box(g,1.1,.6,.16,brass,0,4.5,.48);box(g,.85,.43,.19,wood,0,4.5,.54);
    const holo=new T.Group();holo.position.set(x,1.6,z);holo.scale.setScalar(scale);dynamics.add(holo);animated.holograms.push(holo);
    const holoMat=new T.MeshBasicMaterial({color:arena.accent,transparent:true,opacity:.7,blending:T.AdditiveBlending,depthWrite:false});
    ring(holo,.66,.022,accent,0,2.05,0);ring(holo,.78,.009,accent,0,2.05,0);
    for(let i=-3;i<=3;i++){const px=i*.35,y=2.9+rand(-.5,.7);box(holo,.045,y,.045,accent,px,y/2,0);box(holo,.2,.035,.04,accent,px,y*.74,0);}
    const diamond=ring(holo,1.04,.012,accent,0,2.05,0);diamond.scale.set(.8,1.2,1);
    const veil=box(holo,2.9,3.9,.01,holoMat,0,1.9,0);veil.material=veil.material.clone();veil.material.opacity=.055;veil.castShadow=false;
    cylinder(holo,1.65,1.65,.035,accent,0,0,0,4);cylinder(holo,1.57,1.57,.05,palette.dark,0,.01,0,4);
  }
  portal(arena.shrineX,-14.8,arenaIndex===2?1.25:1.1);
  if(arenaIndex===1)portal(5,-14.8,.7);
  function banner(x,y,z,width=1.4,height=3.6){
    const geo=new T.PlaneGeometry(width,height,4,9),pos=geo.attributes.position;for(let i=0;i<pos.count;i++){pos.setZ(i,Math.sin(pos.getY(i)*2.2)*.09);if(pos.getY(i)<-height/2+.1)pos.setY(i,pos.getY(i)+rand(-.23,.18));}geo.computeVertexNormals();mesh(world,geo,palette.redCloth,x,y,z);
    ring(world,.3,.075,material(0xc9ad77),x,y+.35,z+.12,false,.2,4.8);
    for(let i=0;i<3;i++)box(world,.08,.48,.025,brass,x+(i-1)*.21,y-.52+(i%2)*.1,z+.12);
    beam(world,[x-width*.7,y+height*.5,z],[x+width*.7,y+height*.5,z],.055,brass);
  }
  for(const s of [-1,1]){
    pillar(arena.shrineX+s*5.7,-14,7);banner(arena.shrineX+s*5.7,4.35,-13.32,1.4,4.5);
    for(let j=0;j<4;j++){const x=s*(8+j*1.6);box(world,1.5,4.5,1,stones[j%3],x,2,-14.7);box(world,1.6,.3,1.3,stoneDark,x,4.3,-14.7);vines(x,4.4,-14.1,.7,3.8);}
  }
  function statue(x,z,scale=1){
    const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);world.add(g);
    box(g,2.5,.4,2,stoneDark,0,.2,0);box(g,2.2,.23,1.85,stone,0,.51,0);
    const bust=sphere(g,1.2,stone,0,1.35,0);bust.scale.set(1.15,.8,.7);
    const head=sphere(g,1.2,stones[4],0,3.0,0,1);head.scale.set(.74,1.26,.65);
    for(const side of [-1,1]){const brow=box(g,.6,.16,.24,stones[2],side*.32,3.25,.59);brow.rotation.z=-side*.18;box(g,.4,.055,.16,stoneDark,side*.3,3.13,.7);const lid=box(g,.43,.1,.2,stone,side*.3,3.07,.67);lid.rotation.z=side*.08;}
    const nose=cylinder(g,.13,.23,.75,stones[3],0,2.96,.71,4);nose.rotation.x=.16;
    box(g,.48,.085,.2,stoneDark,0,2.54,.64);box(g,.57,.12,.2,stone,0,2.45,.59);
    const crown=sphere(g,1.15,stoneDark,0,4.05,-.04);crown.scale.set(.84,.44,.75);
    for(let i=0;i<5;i++)cylinder(g,.02,.19,.6,stone,(i-2)*.29,4.55,-.06,4);
    vines(x+.3,4.8*scale,z+.68,.95,4.3*scale);candles(x, .65*scale,z+1.2,3);
  }
  statue(-9.2,-11.6,1.2);statue(9.2,-11.6,1.15);
  function tree(x,z,height){
    const bark=material(0x282a2b);const base=[x,0,z],top=[x+.6,height,z-.4];beam(world,base,top,.32,bark);
    for(let i=0;i<9;i++){const a=i*2.4,end=[x+Math.sin(a)*rand(1,3),height+rand(-.7,1.6),z+Math.cos(a)*rand(1,2.4)];beam(world,[x+.3,height*.62,z],end,rand(.06,.13),bark);
      for(let k=0;k<24;k++){const leaf=sphere(world,rand(.16,.43),leafMats[(i+k)%5],end[0]+rand(-1,1),end[1]+rand(-.6,.45),end[2]+rand(-1,1));leaf.scale.set(1.3,.32,1);leaf.rotation.set(rand(-.3,.3),rand(0,6),rand(-.3,.3));}
    }
  }
  tree(-13,-12,7.3);tree(13,-10,7.8);tree(-14,9,5.6);tree(14,10,5.2);
  // Ferns and fallen petals stay at the edges, leaving the combat surface uncluttered.
  for(let i=0;i<520;i++){
    let x=rand(-12.5,12.5),z=rand(-12,12);if(Math.abs(x)<6.5&&Math.abs(z)<7.5)continue;
    const o=sphere(world,rand(.035,.13),i%3===0?leafMats[i%5]:mossMats[i%4],x,.035,z);o.scale.set(1,.17,1.6);o.rotation.y=rand(0,6);
  }
  for(let i=0;i<40;i++){let x=rand(-12.3,12.3),z=rand(-12,12);if(Math.abs(x)<9&&Math.abs(z)<10)continue;for(let j=0;j<5;j++){const a=j*TAU/5;const leaf=mesh(world,new T.ConeGeometry(.095,rand(.35,.75),3),mossMats[j%4],x+Math.sin(a)*.15,.23,z+Math.cos(a)*.15);leaf.rotation.set(Math.sin(a)*.55,a,Math.cos(a)*.55);}}
  // Distant vertical ruins vanish into the teal mist; the courtyard remains the only playable space.
  for(let i=0;i<25;i++){const x=rand(-45,45),z=rand(-40,-22),h=rand(8,26);box(world,rand(1.8,4),h,rand(2,4),edge,x,h/2-8,z);box(world,.025,h*.7,.04,accent,x+.7,h/2-8,z+2.02);}
  for(const s of [-1,1]){for(let i=0;i<3;i++){const x=s*(17+i*3);box(world,1.8,rand(9,16),2,edge,x,-3,rand(0,14));}}
  batchStatic(world);
  const petalGeo=new T.BufferGeometry(),positions=new Float32Array(100*3),colors=new Float32Array(100*3);for(let i=0;i<100;i++){positions[i*3]=rand(-17,17);positions[i*3+1]=rand(.5,10);positions[i*3+2]=rand(-16,16);const c=new T.Color(i%3===0?0x6dccd1:0xb9556c);colors.set(c.toArray(),i*3);}petalGeo.setAttribute('position',new T.BufferAttribute(positions,3));petalGeo.setAttribute('color',new T.BufferAttribute(colors,3));const petals=new T.Points(petalGeo,new T.PointsMaterial({size:.055,vertexColors:true,transparent:true,opacity:.72,depthWrite:false}));dynamics.add(petals);animated.petals=petals;
  return {world,animated,dynamics};
}

function cloth(parent,x,y,z,width,length,mat){
  const geo=new T.PlaneGeometry(width,length,3,12);const o=mesh(parent,geo,mat,x,y,z);o.userData.base=Float32Array.from(geo.attributes.position.array);o.castShadow=true;return o;
}
export function buildActor(type='player'){
  const player=type==='player',ranged=type==='ranged',root=new T.Group(),body=new T.Group();root.add(body);
  const rig={root,body,type,arms:[],legs:[],cloth:[],blades:[],eye:null,health:null,warning:null};
  const dark=palette.dark,white=palette.armor,red=palette.redCloth,metal=palette.armorShade;
  const waist=box(body,.55,.35,.35,dark,0,1.07,0);waist.rotation.z=.04;
  const chest=cylinder(body,.42,.29,.64,dark,0,1.57,0,6);chest.scale.z=.65;
  if(player){
    const wrap=box(body,.11,.77,.41,palette.black,-.07,1.55,.05);wrap.rotation.z=-.5;
    box(body,.7,.14,.4,red,0,1.13,0);box(body,.15,.18,.08,palette.gold,.1,1.14,.26);
    const face=sphere(body,.235,palette.skin,0,2.09,.015,1);face.scale.set(.8,1.12,.83);
    const hair=sphere(body,.258,palette.hair,0,2.21,-.055,1);hair.scale.set(1,.85,1.05);
    for(let i=0;i<8;i++){const a=i*.8;const spike=cylinder(body,0,.105,.32,palette.hair,Math.sin(a)*.17,2.26,Math.cos(a)*.17,4);spike.rotation.set(Math.cos(a)*.6,0,-Math.sin(a)*.7);}
    const pony=sphere(body,.17,palette.hair,.03,2.47,-.17);pony.scale.set(.7,1.2,1.4);ring(body,.09,.028,red,.03,2.44,-.09);
    for(const s of [-1,1]){box(body,.055,.035,.022,palette.black,s*.095,2.1,.196);box(body,.06,.012,.015,palette.cyan,s*.095,2.108,.21);}
    cylinder(body,.29,.32,.16,red,0,1.94,0,7);
    for(let i=0;i<2;i++){const scarf=cloth(body,i===0?-.09:.13,1.89,-.13,i===0?.34:.19,1.5+i*.25,red);rig.cloth.push(scarf);}
    const sash=cloth(body,-.07,.76,.21,.28,.68,red);sash.userData.sash=true;rig.cloth.push(sash);
    const sheath=beam(body,[-.28,.65,-.25],[-.75,1.6,-.24],.06,palette.black);ring(sheath,.065,.015,palette.gold,0,0,0);
  } else {
    const core=cylinder(body,.47,.4,.5,metal,0,1.68,0,8);core.rotation.x=Math.PI/2;
    ring(body,.29,.08,palette.black,0,1.68,.32);ring(body,.235,.034,palette.redLight,0,1.68,.405);
    sphere(body,.16,palette.redLight,0,1.68,.41,1);rig.eye=sphere(body,.075,glow(0xffdad4,3),0,1.68,.535);
    for(const s of [-1,1]){box(body,.19,.18,.3,white,s*.28,2.0,.1);beam(body,[s*.31,1.9,-.14],[s*.55,2.28,-.2],.045,dark);}
    const apron=cloth(body,0,.83,.07,.34,.83,red);apron.userData.sash=true;rig.cloth.push(apron);
    ring(body,.095,.025,palette.gold,0,.75,.09,false,0,4.9);
  }
  for(const side of [-1,1]){
    const hip=new T.Group();hip.position.set(side*.23,1.04,0);body.add(hip);rig.legs.push(hip);
    const thigh=cylinder(hip,.18,.14,.5,dark,0,-.22,0,5);thigh.rotation.z=side*-.08;
    const knee=sphere(hip,.155,white,0,-.47,.045);knee.scale.set(.85,1.05,.73);
    const shin=new T.Group();shin.position.set(0,-.49,0);hip.add(shin);hip.userData.shin=shin;
    const calf=cylinder(shin,.135,.08,.4,metal,0,-.19,-.005,5);calf.rotation.x=-.04;
    const plate=box(shin,.16,.27,.1,white,0,-.16,.07);plate.rotation.x=-.15;
    box(shin,.19,.13,.34,palette.black,0,-.41,.08);box(shin,.12,.08,.09,player?red:palette.redLight,0,-.43,.24);
    const shoulder=new T.Group();shoulder.position.set(side*.42,1.78,0);body.add(shoulder);rig.arms.push(shoulder);
    const pauldron=sphere(shoulder,.245,player&&side===-1?palette.skin:white,side*.015,-.02,0,1);pauldron.scale.set(1,.85,1);
    cylinder(shoulder,.12,.09,.32,dark,0,-.25,0,6);
    sphere(shoulder,.11,metal,0,-.41,0);
    const forearm=cylinder(shoulder,.12,.09,.33,player?white:metal,0,-.55,.07,5);forearm.rotation.x=-.2;
    sphere(shoulder,.1,dark,0,-.73,.11);
    if(player&&side===1){ring(shoulder,.08,.026,palette.redLight,.18,0,.13);}
    if(!ranged&&(side===1||!player)){
      const sword=new T.Group();sword.position.set(0,-.75,.17);shoulder.add(sword);rig.blades.push(sword);
      beam(sword,[0,0,-.14],[0,0,.22],.045,dark);box(sword,.28,.07,.07,palette.gold,0,0,.22);
      const bladeMat=player?palette.cyan:palette.redLight;
      const shape=new T.Shape();shape.moveTo(-.045,.23);shape.lineTo(.055,.23);shape.quadraticCurveTo(.09,1.35,.28,1.92);shape.lineTo(.14,1.83);shape.quadraticCurveTo(-.02,1.2,-.045,.23);
      const blade=mesh(sword,new T.ShapeGeometry(shape),bladeMat);blade.rotation.x=Math.PI/2;blade.material=blade.material.clone();blade.material.side=T.DoubleSide;
      beam(sword,[0,.006,.23],[.09,.006,1.5],.016,glow(player?0xd9ffff:0xffdcce,4));
    }
  }
  if(ranged){
    root.scale.setScalar(1.4);body.scale.set(1.18,1.07,1);
    for(const side of [-1,1]){box(body,.62,1.76,.32,white,side*.81,1.27,.02);box(body,.45,1.24,.09,red,side*.81,1.22,.21);box(body,.12,1.88,.4,dark,side*1.05,1.3,0);box(body,.05,.54,.04,palette.redLight,side*1.075,1.3,.23);ring(body,.13,.035,palette.gold,side*.81,1.1,.28,false,0,4.9);}
    const cannon=cylinder(body,.18,.25,1.28,dark,0,1.4,.9,10);cannon.rotation.x=Math.PI/2;
    for(let i=0;i<4;i++)ring(body,.22,.04,metal,0,1.4,.5+i*.25);
    ring(body,.19,.045,palette.redLight,0,1.4,1.55);sphere(body,.14,palette.redLight,0,1.4,1.55);
  }else if(player)root.scale.setScalar(1.04);else root.scale.setScalar(.96);
  return rig;
}
export function animateActor(rig,e,t,dt){
  const moving=e.move||0,player=rig.type==='player',attack=e.attack,phase=t*(player?13:11),dodge=e.dodge>0;
  rig.root.position.set(e.x,dodge?.05:0,e.z);rig.root.rotation.y=e.angle;
  rig.body.position.y=moving?Math.abs(Math.sin(phase))*.045:Math.sin(t*2)*.018;
  rig.body.rotation.x=dodge?.65:moving?.12:0;rig.body.rotation.z=e.stun>0?-.15:0;
  rig.legs.forEach((leg,i)=>{leg.rotation.x=Math.sin(phase+i*Math.PI)*.7*moving;leg.rotation.z=(i===0?.1:-.1);leg.userData.shin.rotation.x=Math.max(0,-Math.sin(phase+i*Math.PI))*.65*moving;});
  rig.arms.forEach((arm,i)=>{arm.rotation.x=-.15+Math.sin(phase+i*Math.PI)*.45*moving;arm.rotation.z=i===0?.2:-.2;arm.rotation.y=0;});
  if(player){
    if(attack){const p=attack.t/attack.duration,sweep=Math.sin(p*Math.PI);rig.body.rotation.y=Math.sin(p*Math.PI*2)*(attack.heavy?.65:.4);rig.arms[1].rotation.x=-.65-sweep*.4;rig.arms[1].rotation.y=(attack.step===2?-1:1)*(-1.65+p*3.9);rig.arms[0].rotation.x=-.4;}
    else{rig.body.rotation.y=0;rig.arms[1].rotation.x=-.2;rig.arms[1].rotation.y=-.25;}
  }else{
    if(e.state==='windup'){rig.arms.forEach((arm,i)=>{arm.rotation.x=-1;arm.rotation.y=i===0?-.8:.8;});rig.body.rotation.x=-.2;}
    if(e.state==='slash'){rig.arms.forEach((arm,i)=>{arm.rotation.x=-.8;arm.rotation.y=i===0?1.2:-1.2;});rig.body.rotation.x=.3;}
    rig.eye.scale.setScalar(e.state==='charge'?1.2+Math.sin(t*30)*.5:1);
  }
  for(const c of rig.cloth){const pos=c.geometry.attributes.position,base=c.userData.base;
    for(let i=0;i<pos.count;i++){const x=base[i*3],y=base[i*3+1],f=(base[1]-y)/(base[1]-base[base.length-2]||1);
      if(c.userData.sash){pos.setXYZ(i,x+Math.sin(t*7-f*3)*.035*f,y,Math.sin(t*6-f*2)*.1*f);}
      else{pos.setXYZ(i,x+Math.sin(t*6-f*5)*(.12+moving*.09)*f,-f*(.2+(.45-moving*.15)*f),-f*(1.3+moving*.28)+Math.sin(t*7-f*4)*.1*f);}
    }pos.needsUpdate=true;c.geometry.computeVertexNormals();
  }
  if(e.state==='spawn'){const s=Math.max(.01,1-e.timer/1.9);rig.root.scale.y=s*(rig.type==='ranged'?1.4:rig.type==='player'?1.04:.96);}
  else rig.root.scale.y=rig.type==='ranged'?1.4:rig.type==='player'?1.04:.96;
}
