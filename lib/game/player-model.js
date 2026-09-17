import { Group, Quaternion, DoubleSide } from 'three';
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
  // Exaggerate the existing bone tracks once; keep the mixer and clip timing.
  visual.animations = (gltf.animations || []).map(source => {
    const clip = source.clone();
    const strength = { idle: 1.8, run: 1.3, attack: 1.22, dodge: 1.25 }[clip.name] || 1;
    for (const track of clip.tracks) {
      if (!track.name.endsWith('.quaternion') || track.name === 'root.quaternion') continue;
      const bone = gltf.scene.getObjectByName(track.name.slice(0, -11));
      if (!bone) continue;
      const rest = bone.quaternion.clone(), inverse = rest.clone().invert();
      const delta = new Quaternion(), identity = new Quaternion(), amplified = new Quaternion();
      for (let i = 0; i < track.values.length; i += 4) {
        delta.fromArray(track.values, i).premultiply(inverse);
        amplified.slerpQuaternions(identity, delta, strength).premultiply(rest).normalize().toArray(track.values, i);
      }
    }
    return clip;
  });
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
      ['weapon_sheath', 'hero-energy-katana', 'katana'],
      ['weapon_sheath', 'hero-sheath', 'sheath'],
    ]);
  } catch (error) { disposePlayerModel(visual); throw error; }
  // The supplied sword has one material. Keep the grip dark and let only the
  // blade bloom, using two index groups rather than extra rendering passes.
  visual.userData.katana?.traverse(object => {
    if (!object.isMesh) return;
    const geometry = object.geometry, positions = geometry.attributes.position;
    const index = geometry.index, grip = [], blade = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
      const z = (positions.getZ(a) + positions.getZ(b) + positions.getZ(c)) / 3;
      (z > .085 ? blade : grip).push(a, b, c);
    }
    const base = object.material, energy = base.clone();
    energy.color.set(0xff5365); energy.emissive.set(0xff082b);
    energy.emissiveIntensity = 3.8; energy.metalness = .25; energy.roughness = .3;
    energy.side = DoubleSide;
    geometry.setIndex([...grip, ...blade]); geometry.clearGroups();
    geometry.addGroup(0, grip.length, 0); geometry.addGroup(grip.length, blade.length, 1);
    object.material = [base, energy];
  });
  if (visual.userData.katana) visual.userData.katana.visible = true;
  return visual;
}

export function updatePlayerModel(visual, sim, dt) {
  visual?.userData.playerAnimation?.update(sim, dt);
  if (!visual || sim.mode === 'paused') return;
  const p = sim.player;
  const t = sim.mode === 'playing' ? sim.time : (visual.userData.motionTime = (visual.userData.motionTime || 0) + dt);
  const run = p.move > 0 && !p.attack && p.dodge <= 0;
  visual.position.y = PLAYER_MODEL_Y_OFFSET + (run ? Math.abs(Math.sin(t * 13)) * .065 : Math.sin(t * 2.6) * .025);
  visual.rotation.set(run ? .13 : Math.sin(t * 2.6) * .018, PLAYER_MODEL_ROTATION_Y, run ? Math.sin(t * 13) * .065 : 0);
  if (p.attack) {
    const sweep = Math.sin(p.attack.t / p.attack.duration * Math.PI);
    visual.rotation.y += Math.sin(p.attack.t / p.attack.duration * Math.PI * 2) * (p.attack.heavy ? .35 : .24);
    visual.rotation.x = sweep * .15;
    visual.rotation.z = sweep * (p.attack.step === 2 ? -.1 : .1);
  }
  if (p.dodge > 0) {
    const burst = Math.sin((1 - p.dodge / .29) * Math.PI);
    visual.rotation.x = ((p.dx || 0) * Math.sin(p.angle || 0) + (p.dz || 0) * Math.cos(p.angle || 0)) * .48 * burst;
    visual.rotation.z = -((p.dx || 0) * Math.cos(p.angle || 0) - (p.dz || 0) * Math.sin(p.angle || 0)) * .38 * burst;
    visual.position.y = PLAYER_MODEL_Y_OFFSET + .07 * burst;
  }
  const drawn = sim.mode === 'playing' && !!sim.player.attack;
  const katana = visual.userData.katana;
  if (katana) {
    const socket = visual.getObjectByName(drawn ? 'weapon_hand_r' : 'weapon_sheath');
    if (socket && katana.parent !== socket) socket.add(katana);
    katana.visible = true;
  }
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
