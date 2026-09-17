import { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createEnemyAnimation } from './player-animation.js';
import { loadWeaponAttachments, disposePlayerModel, PLAYER_MODEL_Y_OFFSET } from './player-model.js';

// Templates share immutable geometry/textures; instances own bones, mixers and flash materials.
export async function loadEnemyTemplate(type) {
  const name = type === 'ranged' ? 'enemy-a' : 'enemy-b';
  const gltf = await new GLTFLoader().loadAsync(`/assets/models/${name}-final.glb`);
  const template = new Group(); template.name = name;
  template.add(gltf.scene); template.animations = gltf.animations;
  template.scale.setScalar(type === 'ranged' ? 2.15 : 2.65);
  template.position.y = PLAYER_MODEL_Y_OFFSET * template.scale.x / 2.6;
  template.traverse(object => { if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; } });
  try {
    await loadWeaponAttachments(template, type === 'ranged' ? [
      ['weapon_hand_r','enemy-a-cannon','weapon'], ['weapon_sheath','enemy-a-shield','shield'],
    ] : [['weapon_hand_r','enemy-b-blade','weapon']]);
  } catch(error) { disposePlayerModel(template); throw error; }
  return template;
}

export function instantiateEnemyModel(template) {
  const visual = clone(template);
  visual.userData = {};
  const materialClones = new Map();
  visual.traverse(object => {
    if (!object.isMesh) return;
    const copy = material => {
      if (!materialClones.has(material)) {
        const instance = material.clone();
        instance.userData.baseEmissive = instance.emissive?.clone();
        instance.userData.baseIntensity = instance.emissiveIntensity;
        materialClones.set(material, instance);
      }
      return materialClones.get(material);
    };
    object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
  });
  visual.userData.materials = [...materialClones.values()];
  visual.userData.enemyAnimation = createEnemyAnimation(visual, template.animations);
  return visual;
}

export function disposeEnemyModel(visual) {
  if (!visual) return;
  visual.userData.enemyAnimation.dispose();
  const skeletons = new Set();
  visual.traverse(object => { if (object.isSkinnedMesh) skeletons.add(object.skeleton); });
  for (const skeleton of skeletons) skeleton.dispose();
  for (const material of visual.userData.materials) material.dispose();
  visual.removeFromParent();
}
