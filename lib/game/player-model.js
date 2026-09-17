import { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createPlayerAnimation } from './player-animation.js';

// Local visual adjustments; the existing player root retains its 1.04 scale.
export const PLAYER_MODEL_SCALE = 2.6;
export const PLAYER_MODEL_Y_OFFSET = 1.3021823167800903;
export const PLAYER_MODEL_ROTATION_Y = 0;

export async function loadPlayerModel() {
  const gltf = await new GLTFLoader().loadAsync('/assets/models/hero-final.glb');
  const visual = new Group();
  visual.name = 'NeonRoninForge3DVisual';
  visual.scale.setScalar(PLAYER_MODEL_SCALE);
  visual.position.y = PLAYER_MODEL_Y_OFFSET;
  visual.rotation.y = PLAYER_MODEL_ROTATION_Y;
  visual.add(gltf.scene);
  visual.animations = gltf.animations || [];
  visual.userData.playerAnimation = createPlayerAnimation(gltf.scene, visual.animations);

  // GLTFLoader preserves PBR values and assigns sRGB to the base-color texture,
  // while the packed metallic/roughness texture remains in data color space.
  gltf.scene.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  try {
    await loadWeaponAttachments(visual, [
      ['weapon_hand_r', 'hero-katana', 'katana'],
      ['weapon_sheath', 'hero-sheath', 'sheath'],
    ]);
  } catch (error) { disposePlayerModel(visual); throw error; }
  return visual;
}

export function updatePlayerModel(visual, sim, dt) {
  visual?.userData.playerAnimation?.update(sim, dt);
  if (!visual || sim.mode === 'paused') return;
  const drawn = sim.mode === 'playing' && !!sim.player.attack;
  if (visual.userData.katana) visual.userData.katana.visible = drawn;
  if (visual.userData.sheath) visual.userData.sheath.visible = !drawn;
}

// Small named-socket convention, shared by the two enemy visuals.
export async function loadWeaponAttachments(visual, bindings) {
  const available = bindings.filter(([socket]) => visual.getObjectByName(socket));
  const results = await Promise.allSettled(available.map(([, name]) =>
    new GLTFLoader().loadAsync(`/assets/models/${name}-final.glb`)));
  const failure = results.find(result => result.status === 'rejected');
  if (failure) {
    for (const result of results) if (result.status === 'fulfilled') disposePlayerModel(result.value.scene);
    throw failure.reason;
  }
  for (let i = 0; i < results.length; i++) {
    const scene = results[i].value.scene;
    scene.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
    visual.getObjectByName(available[i][0]).add(scene);
    visual.userData[available[i][2]] = scene;
    if (available[i][2] === 'katana') scene.visible = false;
  }
}

export function disposePlayerModel(visual) {
  if (!visual) return;
  visual.userData.playerAnimation?.dispose();
  visual.removeFromParent();
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const images = new Set();
  const skeletons = new Set();
  visual.traverse((object) => {
    if (!object.isMesh) return;
    if (object.isSkinnedMesh) skeletons.add(object.skeleton);
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) {
        if (value?.isTexture) {
          textures.add(value);
          images.add(value.source?.data);
        }
      }
    }
  });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  for (const image of images) image?.close?.();
}
