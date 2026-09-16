import { Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Local visual adjustments; the existing player root retains its 1.04 scale.
export const PLAYER_MODEL_SCALE = 2.6;
export const PLAYER_MODEL_Y_OFFSET = 1.3021823167800903;
export const PLAYER_MODEL_ROTATION_Y = 0;

export async function loadPlayerModel() {
  const gltf = await new GLTFLoader().loadAsync('/assets/models/neon-ronin-forge3d.glb');
  const visual = new Group();
  visual.name = 'NeonRoninForge3DVisual';
  visual.scale.setScalar(PLAYER_MODEL_SCALE);
  visual.position.y = PLAYER_MODEL_Y_OFFSET;
  visual.rotation.y = PLAYER_MODEL_ROTATION_Y;
  visual.add(gltf.scene);

  // GLTFLoader preserves PBR values and assigns sRGB to the base-color texture,
  // while the packed metallic/roughness texture remains in data color space.
  gltf.scene.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return visual;
}

export function disposePlayerModel(visual) {
  if (!visual) return;
  visual.removeFromParent();
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  const images = new Set();
  visual.traverse((object) => {
    if (!object.isMesh) return;
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
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) texture.dispose();
  for (const image of images) image?.close?.();
}
