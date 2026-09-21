# Step 03 — Forge3D character animation

The player now plays four skeletal animation clips: **idle, run, attack, and dodge**. The existing simulation remains authoritative for movement, facing, attack timing, damage, collisions, invulnerability, and dodge travel. The original source and the Step 02 rigged GLB are preserved unchanged.

## Starting checkpoint and deliverable

- Starting commit: `39c14e509ca784cdfb9bcb540ed6c4ebacbb275f`.
- New LFS asset: `public/assets/models/neon-ronin-forge3d-animated.glb`.
- Source checksum remains `fa5d87a1fd477b8b95aa3fa0f68e712c3f20498baaf6dd4baa62fa2ffafb3cbd`.
- Step 02 rigged checksum remains `f1a44209392393f353e6eb0051fd208355b083c0e3e61c0471e782a614448d8e`.
- Animated checksum: `c1ad91e82bcd28965f32bd105fb0fa8af76e877b14716e443c69feba17351655`.
- 298,498 triangles, one skinned mesh, 20 joints, one material, four clips.
- Two original embedded 4096 × 4096 WebP textures and material JSON are unchanged. No texture rebake or recompression.
- File size: **25,344,968 bytes**, 236,032 bytes / 0.94% larger than the rig-only GLB.

## Clips and authoring

Asset processing used **Blender 4.3.2** with no extra Blender plugins or startup-setting changes.

| Clip | Authored duration | Behavior |
| --- | ---: | --- |
| `idle` | 2.4 s | Subtle spine/chest breathing, head compensation, relaxed arm motion; seamless loop. |
| `run` | 0.667 s | Alternating legs and arm swing, small pelvis bounce, torso lean; seamless loop. |
| `attack` | 0.6 s | Windup, upper-body sweep, recovery. Strike pose at 30% of the clip. |
| `dodge` | 0.3 s | Short crouch/lean with guarded arms, then recovery. |

`tools/forge3d-step03/animate.py` imports the checked-in rigged GLB and authors Blender actions at 30 fps. Quaternion and location keys are baked into the GLB. A small two-bone leg calculation is used **offline** to position the feet while posing; no IK solver runs in the game. Keys use linear interpolation between dense authored samples, with identical first/last loop keys.

All tracks target skeleton bones. The root has no motion; hips have only vertical translation. Existing player/root transforms and model scale 2.6, Y offset 1.3021823167800903, and yaw 0 are unchanged. The build reuses Step 02's exact-texture repack function without overwriting either earlier asset.

The first run pass lifted the foot too high and exaggerated the loose trousers. Lowering the foot lift from 0.075 to 0.03 model units and adjusting pelvis height reduced that distortion. No weights or topology were changed in this milestone. Extreme shoulder raises were avoided, and attack elbow angles are more restrained than the Step 02 stress pose.

## Runtime integration

- `player-model.js` loads the animated URL, retains the clips, constructs the animation player, and releases its mixer on disposal.
- `player-animation.js` owns one Three.js `AnimationMixer` and four actions. Its state order is dodge, attack, run, idle. Short blends smooth state changes; missing clips degrade to an available clip or the unchanged static visual.
- `engine.js` adds one visual update call and its import. It does not change simulation stepping, controls, combat, camera, or any enemy behavior.
- Idle/run advance from simulation time during play, so hit-stop freezes the animation. The ready and victory states use render time for idle. Pause freezes all bones. A new player object or reset simulation clock resets playback.
- Attacks sample their clip from the existing attack timer. Each light combo's 0.085-second hit and the heavy attack's 0.27-second hit map to the same authored strike pose. This supports the existing 0.32/0.36/0.46-second light attacks and 0.66-second heavy attack without modifying their timing. Each queued combo seeks back to its new attack start.
- Dodge samples from its existing 0.29-second countdown. It still cancels attack according to the simulation, and the existing root lift/travel/invulnerability remain unchanged.
- The same attack clip is reused with different timing; distinct combo/heavy choreography is not part of this milestone.

Simulation, world/enemy definitions, effects, sound, UI, and controls are unchanged. The default `npm test` now includes all gameplay, model, and animation tests.

## Validation

- **19 automated tests pass**: the 14 previous tests plus five animation tests.
- Tests verify both preserved checkpoints, material bytes, triangle/joint counts, valid key data, loop closure, no root motion, actual GLTFLoader bone bindings, visible movement in all four states, combo restart, matching heavy/light strike poses, pause/hit-stop/reset, non-mutating playback, and the no-clips fallback.
- Full unchanged simulation encounter: victory at 145.6 seconds, 26 kills, 59 vitality.
- Typecheck passes: `npx --no-install tsc --noEmit --incremental false`.
- Production build passes: `npm run build`. Existing large-chunk and route-classification warnings remain. The Sites build wrapper failed to resolve its npm launcher on Windows; the project's normal build command succeeded without changing the environment.
- Headless Edge browser smoke passes with real keyboard/mouse input: model/textures load, four runtime clips, idle bone movement, run/attack/heavy/dodge transitions, movement, enemy damage/kill, pause/resume with frozen bones, and no console/model errors.
- Fresh Blender re-import sampled nine poses per clip. All vertices have normalized weights; sampled deformed coordinates are finite and bounded. Bone/mesh counts match the deliverable.

| Clip | Worst sampled 99th-percentile edge stretch | Lowest mesh point, game Y (excluding gameplay root lift) |
| --- | ---: | ---: |
| Idle | 1.015 | -0.000071 |
| Run | 1.272 | 0.0115 to 0.0348 |
| Attack | 1.195 | -0.000124 to -0.000071 |
| Dodge | 1.352 | -0.00146 to -0.000071 |

These measurements supplement visual inspection; they do not imply every triangle deforms perfectly. Full data is in [the validation record](step-03-forge3d-validation.json).

## Performance and limitations

The same 1280 × 720, device scale 1, headless Edge ready-state sample measured approximately **240 FPS** before and after animation, with mean frame interval 4.17 ms and 95th percentile 4.3 ms. This is a short refresh-limited sample, not evidence of a GPU-bound speedup. Geometry and textures have not grown; animation adds about 231 KiB and a small mixer/bone update cost.

These are basic authored clips suitable for the current game, with limits inherited from the generated mesh:

- Underarm/elbow creases and loose trouser/sash intersections remain visible in close-ups. No full retopology or corrective shapes were added.
- Run uses one in-place cycle for all movement directions. It has slight foot clearance, and foot sliding can occur at the game's travel speed or while strafing/backpedaling; no directional blend tree or runtime foot locking was added.
- Dodge is a crouched dash, not a full acrobatic roll.
- The sword stays rigid in its sheath. The attack is an arm/torso gesture synchronized to existing slash effects; it does not draw a separate blade or close individual fingers.
- Scarf and sash follow their existing bone weights without cloth simulation or independent secondary motion.

## Reproduction and review

```powershell
$blenderExe = 'blender' # Or the Blender executable on your system.
& $blenderExe --background --python-exit-code 1 --python tools/forge3d-step03/animate.py
& $blenderExe --background --python-exit-code 1 --python tools/forge3d-step03/validate.py
npm test
npx --no-install tsc --noEmit --incremental false
npm run build
# With the existing local server running and Playwright available through NODE_PATH:
node tools/forge3d-step03/browser-smoke.cjs
```

The saved `work/forge3d-step03/neon-ronin-animated.blend` opens on idle. Choose an action in Blender's Action Editor to inspect the other clips and set the playback range to that action. This blend, PNGs, and logs remain ignored, avoiding large intermediate binary history. The scripts recreate them from the checked-in rigged GLB.

Review images: [idle](images/step-03-forge3d/idle.jpg), [run side view](images/step-03-forge3d/run-side.jpg), [attack](images/step-03-forge3d/attack.jpg), [dodge](images/step-03-forge3d/dodge.jpg), [run in game](images/step-03-forge3d/game-run.jpg), [attack in game](images/step-03-forge3d/game-attack.jpg), [dodge in game](images/step-03-forge3d/game-dodge.jpg).

## Scope boundary

This completes the four-clip animation milestone. Further directional movement polish, cloth/weight refinement, and a separated drawable sword would require a separately scoped follow-up. No further milestone was started.
