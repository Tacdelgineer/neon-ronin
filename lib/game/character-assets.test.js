import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadPlayerModel, updatePlayerModel, disposePlayerModel } from './player-model.js';
import { loadEnemyTemplate, instantiateEnemyModel, disposeEnemyModel } from './enemy-model.js';

// Node lacks this browser event required by Three.js FileLoader's data-URI progress path.
globalThis.ProgressEvent ??= class ProgressEvent { constructor(type,values={}) { Object.assign(this,{type},values); } };

function asset(name) {
  const bytes=readFileSync(new URL(`../../public/assets/models/${name}-final.glb`,import.meta.url));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const n=bytes.readUInt32LE(12);
  return {json:JSON.parse(bytes.subarray(20,20+n)),bin:bytes.subarray(28+n)};
}
function view(a,index) {
  const v=a.json.bufferViews[index];return a.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);
}
async function runtime(name) {
  const a=asset(name),j=structuredClone(a.json);
  delete j.images;delete j.textures;delete j.materials;delete j.extensionsUsed;delete j.extensionsRequired;
  for(const mesh of j.meshes)for(const p of mesh.primitives)delete p.material;
  j.buffers[0].uri=`data:application/octet-stream;base64,${a.bin.toString('base64')}`;
  return new GLTFLoader().parseAsync(JSON.stringify(j),'');
}
function mockAssets(t) {
  t.mock.method(GLTFLoader.prototype,'loadAsync',url=>runtime(url.split('/').at(-1).replace('-final.glb','')));
}

test('final cast preserves all originals and exact PBR payloads while reducing geometry',()=>{
  const records=JSON.parse(readFileSync(new URL('../../artifacts/asset-audit/inventory.json',import.meta.url)));
  for(const r of records)assert.equal(createHash('sha256').update(readFileSync(new URL('../../'+r.filename,import.meta.url))).digest('hex'),r.sha256);
  for(const name of ['hero','hero-katana','hero-sheath','enemy-a','enemy-a-cannon','enemy-a-shield','enemy-b','enemy-b-blade']){
    const report=JSON.parse(readFileSync(new URL(`../../artifacts/asset-audit/${name}-report.json`,import.meta.url)));
    const original=readFileSync(new URL('../../'+report.original_file.replaceAll('\\','/'),import.meta.url));
    const n=original.readUInt32LE(12),src={json:JSON.parse(original.subarray(20,20+n)),bin:original.subarray(28+n)},final=asset(name);
    assert.deepEqual(final.json.materials,src.json.materials);
    assert.deepEqual(final.json.textures,src.json.textures);
    final.json.images.forEach((im,i)=>assert.deepEqual(view(final,im.bufferView),view(src,src.json.images[i].bufferView)));
    assert.ok(report.triangles<report.source_triangles*.4);
    if(['hero','enemy-a','enemy-b'].includes(name)){
      assert.equal(final.json.skins[0].joints.length,20);
      assert.deepEqual(final.json.animations.map(a=>a.name).sort(),(name==='hero'?['idle','run','attack','dodge']:['idle','run','attack','hit','death']).sort());
    }
  }
});

test('actual upgraded hero draws its katana into the animated hand and freezes on pause',async t=>{
  mockAssets(t);const visual=await loadPlayerModel();
  const sim={mode:'playing',time:0,wave:1,player:{move:0,attack:null,dodge:0}};
  updatePlayerModel(visual,sim,.016);visual.updateMatrixWorld(true);
  assert.equal(visual.userData.katana.parent.name,'weapon_sheath');
  assert.equal(visual.userData.sheath.parent.name,'weapon_sheath');
  assert.equal(visual.userData.katana.visible,true);assert.equal(visual.userData.sheath.visible,true);
  const before=visual.userData.katana.getWorldPosition(new Vector3());
  sim.player.attack={t:.085,duration:.32,heavy:false};sim.time=.085;
  updatePlayerModel(visual,sim,.085);visual.updateMatrixWorld(true);
  assert.equal(visual.userData.katana.visible,true);assert.equal(visual.userData.sheath.visible,false);
  assert.equal(visual.userData.katana.parent.name,'weapon_hand_r');
  assert.ok(before.distanceTo(visual.userData.katana.getWorldPosition(new Vector3()))>.1);
  const pose=visual.getObjectByName('handR').quaternion.clone();
  sim.mode='paused';sim.player.attack=null;updatePlayerModel(visual,sim,.5);
  assert.equal(visual.userData.katana.visible,true);assert.ok(pose.equals(visual.getObjectByName('handR').quaternion));
  sim.mode='playing';sim.time+=.016;updatePlayerModel(visual,sim,.016);
  assert.equal(visual.userData.katana.visible,true);assert.equal(visual.userData.sheath.visible,true);
  assert.equal(visual.userData.katana.parent.name,'weapon_sheath');
  disposePlayerModel(visual);
});

for(const type of ['ranged','melee'])test(`${type} enemy uses existing states and independent instances with shared geometry`,async t=>{
  mockAssets(t);const template=await loadEnemyTemplate(type),a=instantiateEnemyModel(template),b=instantiateEnemyModel(template);
  const name=type==='ranged'?'enemy-aMesh':'enemy-bMesh',am=a.getObjectByName(name),bm=b.getObjectByName(name);
  assert.equal(am.geometry,bm.geometry);assert.notEqual(am.material,bm.material);assert.notEqual(am.skeleton,bm.skeleton);
  const e={state:'approach',move:0,stun:0,flash:0,hp:100,timer:0};
  const sim={mode:'playing',time:0,wave:1,player:{}};const controller=a.userData.enemyAnimation;
  for(const [state,move,stun,expected] of [['approach',0,0,'idle'],['approach',1,0,'run'],[type==='ranged'?'charge':'windup',0,0,'attack'],['recover',0,.2,'hit'],['dead',0,0,'death']]){
    Object.assign(e,{state,move,stun,timer:.2});sim.time+=.15;controller.update(sim,.15,e);assert.equal(controller.state,expected);
  }
  for(let i=0;i<8;i++){sim.time+=.1;controller.update(sim,.1,e);}
  assert.ok(a.getObjectByName('root').quaternion.angleTo(b.getObjectByName('root').quaternion)>.8,'death clip visibly falls while other instance remains unchanged');
  let sharedDisposals=0;am.geometry.addEventListener('dispose',()=>sharedDisposals++);
  disposeEnemyModel(a);assert.equal(sharedDisposals,0);
  assert.ok(bm.geometry.attributes.position.count>0);
  disposeEnemyModel(b);disposePlayerModel(template);assert.equal(sharedDisposals,1);
});
