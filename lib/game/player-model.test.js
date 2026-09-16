import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadPlayerModel, disposePlayerModel } from './player-model.js';

const bytes = readFileSync(new URL('../../public/assets/models/neon-ronin-forge3d.glb', import.meta.url));
const jsonLength = bytes.readUInt32LE(12);
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());

test('the complete supplied GLB is preserved and contains no skin or animation', () => {
  assert.equal(createHash('sha256').update(bytes).digest('hex'), 'fa5d87a1fd477b8b95aa3fa0f68e712c3f20498baaf6dd4baa62fa2ffafb3cbd');
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(gltf.skins?.length || 0, 0);
  assert.equal(gltf.animations?.length || 0, 0);
  assert.equal(gltf.meshes.length, 1);
  assert.equal(gltf.materials.length, 1);
  assert.equal(gltf.accessors[gltf.meshes[0].primitives[0].indices].count / 3, 981577);
  assert.equal(gltf.images.length, 2);
  assert.ok(gltf.images.every(image => image.mimeType === 'image/webp' && image.bufferView != null));
});

test('visual loading uses the public asset URL, fits the existing root, and preserves PBR maps', async (t) => {
  const position = gltf.accessors[gltf.meshes[0].primitives[0].attributes.POSITION];
  const view = gltf.bufferViews[position.bufferView];
  const bufferOffset = 28 + jsonLength + (view.byteOffset || 0) + (position.byteOffset || 0);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(bytes.buffer, bytes.byteOffset + bufferOffset, position.count * 3), 3));
  const material = new T.MeshStandardMaterial({metalness: 1, roughness: 1});
  material.map = new T.Texture(); material.map.colorSpace = T.SRGBColorSpace;
  material.metalnessMap = new T.Texture(); material.roughnessMap = material.metalnessMap;
  const mesh = new T.Mesh(geometry, material);
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async (url) => {
    assert.equal(url, '/assets/models/neon-ronin-forge3d.glb');
    return {scene: mesh};
  });
  const visual = await loadPlayerModel();
  const root = new T.Group(); root.scale.setScalar(1.04); root.add(visual);
  const box = new T.Box3().setFromObject(root);
  assert.ok(Math.abs(box.min.y) < 0.00001, 'feet align with controller ground');
  assert.ok(box.max.y > 2.65 && box.max.y < 2.8, 'height matches original player');
  assert.equal(visual.rotation.y, 0, 'source +Z remains gameplay +Z');
  assert.equal(mesh.castShadow, true); assert.equal(mesh.receiveShadow, true);
  assert.equal(mesh.material, material);
  assert.equal(material.map.colorSpace, T.SRGBColorSpace);
  assert.equal(material.metalnessMap.colorSpace, T.NoColorSpace);
  assert.equal(material.metalness, 1); assert.equal(material.roughness, 1);
  let textureDisposals = 0;
  material.metalnessMap.addEventListener('dispose', () => textureDisposals++);
  disposePlayerModel(visual);
  assert.equal(root.children.length, 0);
  assert.equal(textureDisposals, 1, 'shared metallic/roughness texture is disposed once');
});

test('a loader failure is propagated so the engine retains its original visual', async (t) => {
  t.mock.method(GLTFLoader.prototype, 'loadAsync', async () => { throw new Error('test load failure'); });
  await assert.rejects(loadPlayerModel(), /test load failure/);
  assert.doesNotThrow(() => disposePlayerModel(null));
});
