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
    assert.equal(url, '/assets/models/neon-ronin-forge3d-animated.glb');
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


function parseGlb(data) {
  assert.equal(data.readUInt32LE(0), 0x46546c67);
  assert.equal(data.readUInt32LE(8), data.length);
  const length = data.readUInt32LE(12);
  return {json: JSON.parse(data.subarray(20, 20 + length).toString()), bin: data.subarray(28 + length)};
}

function imagePayload(asset, index) {
  const view = asset.json.bufferViews[asset.json.images[index].bufferView];
  return asset.bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
}

test('rigged deliverable has valid skin weights, the humanoid hierarchy, and exact source textures', () => {
  const data = readFileSync(new URL('../../public/assets/models/neon-ronin-forge3d-rigged.glb', import.meta.url));
  const asset = parseGlb(data), source = parseGlb(bytes), j = asset.json;
  assert.equal(j.skins.length, 1);
  assert.equal(j.animations?.length || 0, 0, 'rigging must not be described as animation');
  assert.equal(j.meshes.length, 1);
  const jointNames = j.skins[0].joints.map(index => j.nodes[index].name);
  assert.deepEqual(new Set(jointNames), new Set([
    'root', 'hips', 'spine', 'chest', 'neck', 'head', 'clavicle.L', 'clavicle.R',
    ...['L', 'R'].flatMap(side => ['upper_arm', 'lower_arm', 'hand', 'upper_leg', 'lower_leg', 'foot'].map(name => name + '.' + side))
  ]));
  const parents = new Map();
  j.nodes.forEach((node, i) => node.children?.forEach(child => parents.set(child, i)));
  const nodeByName = new Map(j.nodes.map((n, i) => [n.name, i]));
  for (const [child, parent] of [['hips','root'],['spine','hips'],['chest','spine'],['neck','chest'],['head','neck'],
      ...['L','R'].flatMap(s=>[['upper_arm.'+s,'clavicle.'+s],['lower_arm.'+s,'upper_arm.'+s],
        ['hand.'+s,'lower_arm.'+s],['upper_leg.'+s,'hips'],['lower_leg.'+s,'upper_leg.'+s],['foot.'+s,'lower_leg.'+s]])]) {
    assert.equal(parents.get(nodeByName.get(child)), nodeByName.get(parent), child + ' parent');
  }
  assert.deepEqual(j.materials, source.json.materials);
  assert.deepEqual(j.textures, source.json.textures);
  assert.equal(j.images.length, 2);
  for (let i = 0; i < 2; i++) {
    assert.equal(j.images[i].mimeType, 'image/webp');
    assert.deepEqual(imagePayload(asset, i), imagePayload(source, i), 'embedded texture bytes');
  }
  function accessor(index) {
    const a=j.accessors[index],v=j.bufferViews[a.bufferView];
    const components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
    const size={5121:1,5123:2,5125:4,5126:4}[a.componentType];
    assert.ok(size && components);
    const read={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'}[a.componentType];
    return {count:a.count,components,at:(i,k)=>asset.bin[read]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||components*size)+k*size)};
  }
  let triangleCount=0;
  for (const mesh of j.meshes) for (const primitive of mesh.primitives) {
    triangleCount += j.accessors[primitive.indices].count / 3;
    const positions=accessor(primitive.attributes.POSITION),normals=accessor(primitive.attributes.NORMAL);
    const weights=accessor(primitive.attributes.WEIGHTS_0),joints=accessor(primitive.attributes.JOINTS_0);
    assert.equal(positions.count, weights.count);
    const limits=j.accessors[primitive.attributes.POSITION];
    assert.ok(Math.abs(limits.min[1]*2.6+1.3021823167800903)<.002, 'existing feet offset remains valid');
    for (let i=0;i<weights.count;i++) {
      let total=0;
      for (let k=0;k<4;k++) {
        const w=weights.at(i,k),joint=joints.at(i,k);
        assert.ok(Number.isFinite(w)&&w>=0&&w<=1);
        assert.ok(joint>=0&&joint<jointNames.length);
        total+=w;
      }
      assert.ok(Math.abs(total-1)<.0001, 'normalized weights for every exported vertex');
      for(let k=0;k<3;k++)assert.ok(Number.isFinite(positions.at(i,k))&&Number.isFinite(normals.at(i,k)));
    }
    assert.ok(j.nodes.some(n=>n.mesh===j.meshes.indexOf(mesh)&&n.skin===0));
  }
  assert.ok(triangleCount<350000 && triangleCount>150000, 'conservative optimization retained');
  assert.ok(data.length<bytes.length, 'rigged download is smaller than source');
});

test('disposal releases the shared skeleton GPU texture once', () => {
  const skeleton = new T.Skeleton([new T.Bone()]);
  skeleton.computeBoneTexture();
  let disposed = 0;
  skeleton.boneTexture.addEventListener('dispose', () => disposed++);
  const visual = new T.Group();
  for(let i=0;i<2;i++) {
    const mesh = new T.SkinnedMesh(new T.BufferGeometry(), new T.MeshStandardMaterial());
    mesh.skeleton = skeleton; visual.add(mesh);
  }
  disposePlayerModel(visual);
  assert.equal(disposed,1);
});
