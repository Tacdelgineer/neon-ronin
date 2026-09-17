import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPlayerAnimation } from './player-animation.js';

function parseGlb(file) {
  const bytes = readFileSync(new URL('../../public/assets/models/' + file, import.meta.url));
  const length = bytes.readUInt32LE(12);
  return { bytes, json: JSON.parse(bytes.subarray(20, 20 + length)), bin: bytes.subarray(28 + length) };
}
const asset = parseGlb('neon-ronin-forge3d-animated.glb');
const rigged = parseGlb('neon-ronin-forge3d-rigged.glb');
function values(asset, index) {
  const a = asset.json.accessors[index], v = asset.json.bufferViews[a.bufferView];
  const count = { SCALAR: 1, VEC3: 3, VEC4: 4 }[a.type];
  assert.equal(a.componentType, 5126);
  return Array.from({ length: a.count }, (_, i) => Array.from({ length: count }, (_, k) =>
    asset.bin.readFloatLE((v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || count * 4) + k * 4)));
}

test('animated asset preserves both checkpoints, mesh budget, skeleton, and original material payloads', () => {
  assert.equal(createHash('sha256').update(rigged.bytes).digest('hex'), 'f1a44209392393f353e6eb0051fd208355b083c0e3e61c0471e782a614448d8e');
  const j = asset.json;
  assert.equal(j.skins.length, 1); assert.equal(j.skins[0].joints.length, 20);
  assert.equal(j.meshes.length, 1);
  assert.equal(j.meshes.flatMap(m => m.primitives).reduce((n, p) => n + j.accessors[p.indices].count / 3, 0), 298498);
  assert.deepEqual(j.materials, rigged.json.materials); assert.deepEqual(j.textures, rigged.json.textures);
  function image(a, i) { const v = a.json.bufferViews[a.json.images[i].bufferView]; return a.bin.subarray(v.byteOffset, v.byteOffset + v.byteLength); }
  assert.equal(j.images.length, 2);
  for (let i = 0; i < 2; i++) assert.deepEqual(image(asset, i), image(rigged, i));
  assert.ok(asset.bytes.length < rigged.bytes.length * 1.05, 'small animation overhead');
});

test('four real clips have valid keys, seamless loops, and no root motion', () => {
  const j = asset.json;
  assert.deepEqual(j.animations.map(a => a.name).sort(), ['attack', 'dodge', 'idle', 'run']);
  for (const clip of j.animations) {
    let movingChannels = 0;
    for (const channel of clip.channels) {
      const sampler = clip.samplers[channel.sampler];
      const times = values(asset, sampler.input).flat(), keys = values(asset, sampler.output);
      assert.equal(times[0], 0); assert.equal(times.length, keys.length);
      assert.ok(times.every((t, i) => Number.isFinite(t) && (i === 0 || t > times[i - 1])));
      assert.ok(keys.flat().every(Number.isFinite));
      const name = j.nodes[channel.target.node].name;
      assert.ok(j.skins[0].joints.includes(channel.target.node), 'bone-only tracks');
      const differs = keys.some(k => k.some((x, c) => Math.abs(x - keys[0][c]) > 1e-5));
      if (differs) movingChannels++;
      if (name === 'root') assert.equal(differs, false, 'root remains fixed');
      if (name === 'hips' && channel.target.path === 'translation') {
        // glTF Y is vertical. No animation-driven horizontal movement.
        assert.ok(keys.every(k => Math.abs(k[0] - keys[0][0]) < 1e-5 && Math.abs(k[2] - keys[0][2]) < 1e-5));
      }
      if (channel.target.path === 'rotation') assert.ok(keys.every(k => Math.abs(Math.hypot(...k) - 1) < .001));
      if (clip.name === 'idle' || clip.name === 'run') {
        assert.ok(keys[0].every((x, c) => Math.abs(x - keys.at(-1)[c]) < 1e-4), clip.name + ' closes its loop');
      }
    }
    assert.ok(movingChannels >= 6, clip.name + ' must visibly articulate the skeleton');
  }
});

async function runtimeAsset() {
  // Preserve actual geometry, skeleton, and tracks; omit textures only in this Node binding test.
  const j = structuredClone(asset.json);
  delete j.materials; delete j.textures; delete j.images; delete j.extensionsUsed; delete j.extensionsRequired;
  for (const mesh of j.meshes) for (const p of mesh.primitives) delete p.material;
  let json = Buffer.from(JSON.stringify(j)); json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
  const header = Buffer.alloc(20), binHeader = Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + asset.bin.length, 8);
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  binHeader.writeUInt32LE(asset.bin.length); binHeader.writeUInt32LE(0x004e4942, 4);
  const buffer = Buffer.concat([header, json, binHeader, asset.bin]);
  return new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '');
}

test('actual exported clips bind to Three.js bones and visibly change every requested state', async () => {
  const gltf = await runtimeAsset();
  const controller = createPlayerAnimation(gltf.scene, gltf.animations);
  const sim = { mode: 'playing', time: 0, player: { move: 0, dodge: 0, attack: null } };
  const bone = name => gltf.scene.getObjectByName(name);
  const q = name => bone(name).quaternion.clone();
  controller.update(sim, 0);
  const idle = q('chest'); sim.time += .6; controller.update(sim, .6);
  assert.ok(idle.angleTo(q('chest')) > .005, 'idle breath');
  sim.player.move = 1; sim.time += .2; controller.update(sim, .2);
  const leg = q('upper_legL'); sim.time += .15; controller.update(sim, .15);
  assert.equal(controller.state, 'run'); assert.ok(leg.angleTo(q('upper_legL')) > .05, 'run stride');
  sim.player.attack = { t: .085, duration: .32, heavy: false }; sim.time += .1; controller.update(sim, .1);
  assert.equal(controller.state, 'attack'); const arm = q('upper_armR');
  sim.player.attack = { t: 0, duration: .36, heavy: false }; sim.time += .01; controller.update(sim, .01);
  assert.ok(arm.angleTo(q('upper_armR')) > .1, 'new combo seeks back to clip start');
  sim.player.dodge = .145; sim.player.attack = null; sim.time += .145; controller.update(sim, .145);
  assert.equal(controller.state, 'dodge'); assert.ok(Math.abs(bone('hips').position.y - rigged.json.nodes.find(n => n.name === 'hips').translation[1]) > .01);
  const frozen = q('chest'); sim.mode = 'paused'; controller.update(sim, 1);
  assert.ok(frozen.angleTo(q('chest')) < 1e-6, 'pause freezes bones');
  sim.mode = 'playing'; sim.player.dodge = 0; sim.player.move = 0; sim.time += .3; controller.update(sim, .3);
  assert.equal(controller.state, 'idle');
  const held = q('chest'); controller.update(sim, .04); assert.ok(held.angleTo(q('chest')) < 1e-6, 'hit-stop freezes bones');
  sim.player = { ...sim.player }; sim.time = 0;
  controller.update(sim, 0); assert.equal(controller.state, 'idle');
  const afterReset = JSON.stringify(sim); controller.update(sim, 0); assert.equal(JSON.stringify(sim), afterReset, 'playback never writes simulation');
  controller.dispose(); assert.deepEqual(controller.clipNames, []);
});

test('attack impact aligns at the same pose for every combo duration and heavy timing', async () => {
  const gltf = await runtimeAsset();
  const controller = createPlayerAnimation(gltf.scene, gltf.animations);
  let impact;
  for (const [duration, heavy] of [[.32, false], [.36, false], [.46, false], [.66, true]]) {
    const sim = { mode: 'playing', time: 0, player: { move: 0, dodge: 0, attack: { duration, heavy, t: heavy ? .27 : .085 } } };
    controller.update(sim, 0);
    const q = gltf.scene.getObjectByName('upper_armR').quaternion.clone();
    if (impact) assert.ok(impact.angleTo(q) < 1e-6);
    impact = q;
  }
  controller.dispose();
});

test('a visual without clips remains usable and disposable', () => {
  const root = new T.Group(), controller = createPlayerAnimation(root);
  assert.doesNotThrow(() => controller.update({ mode: 'playing', time: 0, player: {} }, .016));
  assert.deepEqual(root.position.toArray(), [0, 0, 0]);
  controller.dispose();
});
