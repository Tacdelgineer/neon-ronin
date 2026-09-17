# Step 02 — Forge3D humanoid rig

The existing Forge3D player now loads as a skinned character with a small humanoid skeleton. It still holds its standing pose in the game: **there are no animation clips**. Gameplay, input, attacks, effects, enemies, hitboxes, camera, audio, arena, and encounter rules are unchanged.

## Durable checkpoint and source safety

- Original known-good commit: `fb795c78c984cc63faf29abf39b022d041080958`.
- LFS-equivalent checkpoint: `5496dedf3ab893b79c297dcd08c67de60169a31e`. Only that unpublished commit was rewritten; parent `4e31e189dd71bf526aed28cdf7f9bc2cf5f61c95` was preserved.
- `origin` is [Tacdelgineer/neon-ronin](https://github.com/Tacdelgineer/neon-ronin). The old managed `git.chatgpt-team.site` remote remains named `sites`.
- Both `*.glb` and `*.gltf` use Git LFS. The old 41,501,728-byte Git blob became a 133-byte LFS pointer on the published branch. Original history also has a local safety bundle at `.git/checkpoint-backup/pre-lfs-fb795c7.bundle`.
- The checkpoint was pushed normally, with upstream tracking. GitHub and local HEAD matched. Downloading the object into a fresh LFS storage directory independently verified the remote bytes before Blender work began.
- Repository-local author identity: `Tacdelgineer <181770435+Tacdelgineer@users.noreply.github.com>`. Repository-local Git credential selection uses Tacdelgineer. No other account credentials were edited, erased, or reauthenticated; the account list remained unchanged.
- The source is **`public/assets/models/neon-ronin-forge3d.glb`**, served at `/assets/models/neon-ronin-forge3d.glb`. It was never overwritten or re-exported.
- Source SHA-256 remains `fa5d87a1fd477b8b95aa3fa0f68e712c3f20498baaf6dd4baa62fa2ffafb3cbd`.

The checkout is currently accessible at `D:\1MDrive\ProjectsM\AIGame`; the former `M:` drive mapping is unavailable in this session.

## Game audit before changing the model

| State | Existing visible behavior |
| --- | --- |
| Idle | Fixed imported standing pose; no breathing, limb movement, or skeletal motion. |
| Movement/run | The imported scene translates and turns with the existing player root. It does not run or swing its limbs. |
| Attack | Simulation timing, attack movement, slash effects, particles, sound, and hit detection work; the imported arms and sheathed sword remain fixed. |
| Dodge | Existing movement burst, root lift of 0.05, and effects remain visible. The imported body does not lean or articulate. |
| Legacy procedural body | 54 meshes under torso, arm, leg, shin, and cloth groups. `animateActor()` individually transforms limbs/torso and edits cloth vertices. That body is hidden after GLB loading and retained as the loading/error fallback. |
| Motion ownership | Imported visual: root transforms only. Whole game: root motion plus procedural fallback/enemy mesh transforms and effects. Collision and combat are independent of the visual. |

## Source GLB audit

| Property | Source |
| --- | --- |
| Scene objects / meshes / primitives / materials | 1 / 1 / 1 / 1 |
| Vertices / indexed triangles | 780,237 / **981,577** |
| Size | 41,501,728 bytes (39.58 MiB) |
| Textures | Two embedded 4096 × 4096 WebP images; base color and packed metallic/roughness |
| PBR | Original opaque, single-sided material; metalness and roughness factors 1; no normal/emissive map |
| Skeleton / skin / animation clips | None / none / none |
| GLB bounds, Y-up | Min (-0.31264663, -0.50083935, -0.18560249); max (0.31338167, 0.50081593, 0.17066550) |
| Transforms | Identity node transform; object location/rotation zero, scale one after Blender import |
| Origin / forward | Origin near overall model center, not the feet; +Z forward in glTF/Three.js |
| Blender coordinates | Z-up, -Y forward; same physical positions after glTF axis conversion |
| Geometry organization | One joined mesh. Scarf, hair, sword, armor, body, and clothing are not separate named objects/material regions. |
| Normals / UVs | Custom split normals and one UV layer. Original texture mapping retained. |

Blender imported 981,558 faces, dropping 19 source indexed triangles during import. The imported mesh had three effectively zero-area faces and many seam-split boundary edges. A diagnostic weld at 0.000001 source units reduced 780,237 vertices to 478,170 coincident-position vertices: 98 connected components, 1,193 boundary edges, and 11,096 non-manifold edges. The largest component had 464,189 vertices. Small islands include hair and accessory fragments; object count does not imply these surfaces are watertight or independently articulated.

Inspection also found fused contacts around gloves, clothing, and accessories. Those contacts made simple regional weights stretch triangles between otherwise independent parts. This is generated, irregular triangle geometry, not animation-ready edge-loop topology. No full retopology was attempted.

## Blender and repeatable scripts

Used the already installed **Blender 4.3.2**, executable **`D:\Blender\blender.exe`**. Nothing was installed, and startup defaults were not changed.

These scripts are specific to this character and its existing coordinate system:

| Script in `tools/forge3d-step02/` | Purpose |
| --- | --- |
| `inspect_source.py` | Read source, audit topology/materials, save reference views and an inspectable source blend. Shared rendering helpers. |
| `optimize.py` | Duplicate source mesh, weld coincident vertices, collapse-decimate separate 300k/150k trials, render comparisons. |
| `rig.py` | Fit a 20-bone humanoid to the asymmetric source stance; attempt Blender automatic weights; define temporary validation poses. |
| `proxy_weights.py` | Optional recorded experiment: automatic weights on a temporary voxel proxy. The trial failed; it is not part of the chosen build sequence. |
| `skin.py` | Apply explicit anatomical weights, accessory corrections, contact cleanup, normalization, and five pose checks. |
| `export_rigged.py` | Export selected mesh/armature; repack the exact original WebP payloads and PBR material into the final GLB. |
| `validate_export.py` | Independently import final GLB, check skin/bones/textures, render a pose and recording views. |
| `browser-smoke.cjs` | Playwright/Edge browser regression and comparable 240-frame samples using real keyboard/mouse input. |

Local intermediate blends, full-resolution PNGs, logs, and reports are under ignored `work/forge3d-step02/`. Open `neon-ronin-rigged.blend` there to inspect the final neutral rig; its armature is selected and drawn in front. Intermediate blends are deliberately excluded from Git history. Committed scripts recreate them. No keyframes or animation actions are authored.

Run from the repository root in PowerShell:

```powershell
$blenderExe = 'D:\Blender\blender.exe'
foreach ($script in @('inspect_source.py','optimize.py','rig.py','skin.py','export_rigged.py','validate_export.py')) {
    & $blenderExe --background --python-exit-code 1 --python "tools/forge3d-step02/$script"
    if ($LASTEXITCODE -ne 0) { throw "Blender stage failed: $script" }
}
```

Blender's heat solver can print a warning without raising a Python exception; `rig.py` explicitly records the weight coverage. A failed initial heat pass is expected for this asset, and `skin.py` supplies the chosen weights.

## Optimization and topology corrections

Both trials used Blender collapse decimation on copied geometry, after merging only coincident vertices at 1e-6 and dissolving negligible degenerate edges at 1e-8. UVs and material assignment were retained. No texture downsampling, rebaking, or remeshing was used in the deliverable.

- **300,000-triangle trial chosen:** retained face/hair silhouette, armor contours, sword, scarf edges, and clothing relief.
- **150,000-triangle trial rejected:** usable at game distance, but visibly softened/faceted the long sash, cloth folds, and boot detail in close views. The higher-quality trial was retained.
- During skin validation, removed **785 fused contact faces** below the elbows and **503 small face scraps newly disconnected by those cuts**. Original small source islands were distinguished from new scraps and retained. The pre-export mesh has 298,712 triangles.
- The glTF exporter omitted a further 214 degenerate triangles. The authoritative shipped GLB count is **298,498 triangles**, a **69.59% reduction** from the original indexed source.
- Contact cleanup leaves small open seams around the original fused contacts. This is intentional local repair, not a claim of manifold topology.

## Armature and weights

20 bones, including a non-deforming root bone retained in the exported skeleton:

```text
root
└─ hips
   ├─ spine → chest → neck → head
   │           ├─ clavicle.L → upper_arm.L → lower_arm.L → hand.L
   │           └─ clavicle.R → upper_arm.R → lower_arm.R → hand.R
   ├─ upper_leg.L → lower_leg.L → foot.L
   └─ upper_leg.R → lower_leg.R → foot.R
```

The native relaxed stance is the rest pose; it was not forced into a T-pose. No Rigify controls, fingers, facial bones, IK/FK systems, physics, or cloth simulation were added. Two clavicles allow shoulder movement without a large control rig.

Automatic bone-heat weighting failed on the processed mesh. A temporary 32,102-vertex voxel proxy also failed to produce weights. The final method uses explicit anatomical chains with smooth hip, spine, neck, shoulder, elbow, wrist, knee, and ankle transitions, fitted to this asset's coordinates. Every exported vertex is weighted; weights are normalized and limited to four influences.

Major corrections:

- Repositioned wrist/hand and elbow joints to the asymmetric mesh instead of assuming perfectly mirrored limbs.
- Removed torso/leg weight leakage into gloves and forearms.
- Detached source contact triangles that bridged hands and waist clothing.
- Excluded the rear scarf from nearby arm weights.
- Fixed the entire selected sword region, including bright fittings, to hips with one influence. Armor color selection cannot override the sword.
- Kept hair/face on head, scarf tails on chest, and the hanging center sash on hips.
- Assigned shoulder armor to upper arm, forearm plates to lower arms, hand plates to hands, and the shin plate to lower leg. Adjacent soft clothing retains blended weights.

Three.js GLTFLoader sanitizes periods in bone names: for example, glTF/Blender `upper_arm.L` is runtime `upper_armL`. Future animation integration should account for that mapping, or use GLTFLoader's clip bindings.

## Deformation validation and limits

Rendered neutral standing, arms raised about 70°, one leg forward, bent knees, and an upper-body attack-like pose. Front/oblique and side views are preserved. These are temporary validation poses, reset before saving/export, not clips.

The large hand-to-waist stretches and detached seam scraps found in initial passes were corrected. The final tests have finite vertex positions, no unweighted vertices, intact materials, articulated joints, and a rigid sheathed sword. The final GLB was independently re-imported and posed again.

This is a practical first rig, **not a polished animation-production mesh**. Visible limitations remain:

- Deep elbow flexion and wide shoulder raises expose creases, some local underarm stretching, and imperfect transitions around fused armor/cloth.
- Deep knee/hip flexion distorts loose trousers and can intersect the static waist cloth. The sash and scarf have no secondary motion.
- Cut contact seams and the source's small irregular fragments can be noticeable in close-ups.
- No corrective shape keys, dedicated cloth bones, retopology, finger motion, or foot IK. Temporary crouch tests are not grounded animation poses.
- Wide/extreme animation poses will need local weight or topology refinement during clip authoring. The game still displays only the neutral pose.

Measured 99th-percentile edge-length ratios were approximately 1.00 neutral, 1.07 raised, 1.20 step, 1.24 knees, and 1.27 attack. These help detect gross failures but do not replace visual inspection or prove every triangle is artifact-free. Full measurements are in [the companion validation JSON](step-02-forge3d-validation.json).

## Export and material preservation

Deliverable: **`public/assets/models/neon-ronin-forge3d-rigged.glb`**.

| Property | Final GLB |
| --- | --- |
| Triangles | **298,498** |
| Exported vertices | 322,421 (UV/normal seams split vertices at export) |
| File size | **25,108,936 bytes**, approximately 23.95 MiB |
| Meshes / materials / skins | 1 / 1 / 1 |
| Skeleton | 20 joints, including root; inverse bind matrices and vertex joint/weight attributes |
| Animation clips | **0** |
| Textures | Original two embedded 4096 × 4096 WebP payloads, byte-for-byte identical |
| PBR material / texture JSON | Identical to original; original `EXT_texture_webp` preserved |
| GLB bounds, Y-up | Min (-0.31262761, -0.50086546, -0.18555155); max (0.31339413, 0.50082815, 0.17069772) |

Blender's temporary texture encoding is discarded by an asset-specific repack step. Geometry/skin buffer views remain from Blender, while the original material, texture definitions, and exact encoded WebP image bytes are copied from the source. This prevents recompression, format changes, or an unnecessary texture-size increase.

Original image SHA-256 values, also verified after export:

- Base color: `c0e3b8af67008afda8640d23dd4f248ad9c8c1935b0d1dbbf80cfb16c9f0678f`
- Metallic/roughness: `2abb13936e0cf8710d26ac1c3b09060684b6eabc11e2e97abf66a0f09c2931c0`

Independent verification used binary GLB tests, a fresh Blender import, and actual Three.js GLTFLoader in the browser.

## Game integration and regression

Only `lib/game/player-model.js` changes at runtime: load the rigged URL and dispose shared skeleton GPU textures when the visual is released. The existing procedural fallback remains intact.

Unchanged tuning:

- `PLAYER_MODEL_SCALE = 2.6`
- `PLAYER_MODEL_Y_OFFSET = 1.3021823167800903`
- `PLAYER_MODEL_ROTATION_Y = 0`
- Existing player-root scale remains 1.04.

Runtime feet are at approximately Y = -0.000071 and height is approximately 2.7085 world units; no offset correction was needed. Source +Z still faces gameplay +Z.

The controller, player root, simulation, hitboxes, combat, camera, enemies, arena, effects, sound, and game UI files are byte-for-byte unchanged from the pushed checkpoint. No animation mixer or procedural animation controller was added.

Checks completed:

| Check | Result |
| --- | --- |
| Existing gameplay tests | PASS, all 9 unchanged tests |
| Model tests | PASS, 5 tests including source integrity, loader/fallback, exported hierarchy/weights/textures, and shared skeleton disposal |
| Typecheck | PASS |
| Production build | PASS; existing chunk-size and route-classification warnings remain |
| Browser startup and asset load | PASS |
| Runtime skin/skeleton | PASS, 1 SkinnedMesh, 20 bones, skinIndex and skinWeight attributes |
| Materials, scale, orientation, grounding | PASS, inspected and asserted |
| WASD movement, light/heavy attack, Space dodge | PASS using browser keyboard/mouse input |
| Hit detection and enemies | PASS, first-wave drone damage and kill registered |
| Pause/resume | PASS |
| Browser console/model errors | None on final run |
| Full simulation encounter | Same victory at 145.6 simulation seconds, 26 kills, 59 vitality |

An initial baseline browser run exposed old generated font-cache URLs pointing to the unavailable M: drive. The ignored `.vinext/fonts` cache was moved to `work/forge3d-step02/old-font-cache` and regenerated. No font or game source was changed; the repeated baseline and final browser runs had no console errors.

Commands:

```powershell
npm test
node --test lib/game/player-model.test.js
npx --no-install tsc --noEmit --incremental false
npm run build
# With the local game running and Playwright available through NODE_PATH:
node tools/forge3d-step02/browser-smoke.cjs rigged
```

The smoke script uses the installed Microsoft Edge browser. Its temporary network-response instrumentation exposes the existing game instance only inside the test browser; it does not edit the engine or gameplay.

## Performance

| Metric | Original static | Processed rigged |
| --- | ---: | ---: |
| Player triangles | 981,577 | 298,498 |
| Asset bytes | 41,501,728 | 25,108,936 |
| 240-frame mean interval | 4.17 ms | 4.17 ms |
| Approximate observed FPS | 240 | 240 |
| 95th-percentile interval | 4.3 ms | 4.3 ms |

Same 1280 × 720 viewport and device scale 1, headless Edge, ready-state warmup, then 240 requestAnimationFrame intervals. The samples are refresh-limited and too short to establish a GPU-bound speedup. **No measurable FPS difference** in this environment. Triangle load decreased 69.59%; download size decreased 39.50%. Skinning adds work, and no low-end-device benchmark was performed.

## Recording checkpoints

The original PNG captures and inspectable blends stay in ignored `work/forge3d-step02/`. Smaller JPEG copies are committed for convenient review:

- A — [Original static character in game](images/step-02-forge3d/original-in-game.jpg)
- B — [High-poly source front](images/step-02-forge3d/source-front.jpg), [back](images/step-02-forge3d/source-back.jpg), [side](images/step-02-forge3d/source-side.jpg)
- C — [Chosen 300k trial](images/step-02-forge3d/optimized-300000-front.jpg), [150k comparison](images/step-02-forge3d/optimized-150000-front.jpg), [final wireframe](images/step-02-forge3d/optimized-wireframe.jpg)
- D — [Imported armature endpoints projected over the model](images/step-02-forge3d/armature-front.jpg); the actual armature is inspectable in the blend
- E — [Raised arms](images/step-02-forge3d/pose-raised.jpg), [step](images/step-02-forge3d/pose-step.jpg), [knees](images/step-02-forge3d/pose-knees.jpg), [knees from the side](images/step-02-forge3d/pose-knees-side.jpg), [attack-like pose after GLB re-import](images/step-02-forge3d/exported-attack.jpg)
- F — [Rigged player in game](images/step-02-forge3d/rigged-in-game.jpg), [combat](images/step-02-forge3d/rigged-combat.jpg)

## NEXT MILESTONE

**Author and integrate the four basic animation clips: idle, run, attack, and dodge**, as one separate animation milestone. All four are still needed. Start with moderate motion ranges on this rig, refine the documented local deformation issues as needed while posing, and keep the existing controller/combat timing/hitboxes authoritative.

No part of that animation milestone was implemented here.
