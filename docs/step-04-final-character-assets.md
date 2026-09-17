# Step 04 — Final character assets

Starting checkpoint: `5c7f09db94ecaf4885f456c82bff6e0ac8f20978`. Batch identification is in [asset-manifest.md](asset-manifest.md). Originals and all previous public GLBs remain unchanged.

The upgraded hero is used: clearer anatomy, separated stance, longer scarf, and no fused sheathed sword. Step 02's weld/decimation, anatomical weighting/contact cleanup and exact-texture exporter are reused. Step 03's four pose functions are reused on a refitted 20-bone skeleton. Existing simulation remains authoritative.

| Asset | Original file | Role | Source triangles | Final triangles | Rig | Animations | Weapon | Known issue |
| --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
| Hero | docs/ChatGPT Image Sep 16 2026 05_15_40 PM.glb | Player | 997,783 | 298,580 | 20-bone humanoid, anatomical/rigid weights | idle, run, attack, dodge | Red katana + sheath | Small glove/cloth creases; in-place foot sliding |
| Katana | docs/ChatGPT Image Sep 16 2026 04_55_11 PM.glb | Hero combat weapon | 990,187 | 13,759 | Rigid socket | Follows hand | weapon_hand_r | No finger closing or cinematic draw |
| Sheath | docs/ChatGPT Image Sep 16 2026 04_55_07 PM.glb | Hero stowed weapon | 958,449 | 9,231 | Rigid socket | Follows pelvis | weapon_sheath | Whole stowed asset hides during attack |
| Enemy A | docs/enemy1.glb | Existing ranged sentinel | 966,995 | 219,917 | 20 bones; rigid triangles, split joints | idle, run, attack, hit, death | Cannon + shield | Small rigid seams; torso-mounted cannon |
| Cannon | docs/ChatGPT Image Sep 16 2026 04_51_56 PM.glb | Enemy A weapon | 976,607 | 88,640 | Rigid torso socket | Recoil follows chest | weapon_hand_r | No separate trigger/barrel animation |
| Shield | docs/ChatGPT Image Sep 16 2026 04_51_57 PM.glb | Enemy A secondary armor | 966,776 | 37,930 | Rigid torso socket | Follows chest | weapon_sheath | Fixed mount, no shield mechanics |
| Enemy B | docs/enemy2.glb | Existing melee drone | 935,198 | 259,862 | 20 bones; rigid triangles, split joints | idle, run, attack, hit, death | Mechanical sword | Visible hinge seams in close-ups |
| Mechanical sword | docs/ChatGPT Image Sep 16 2026 04_51_53 PM (1).glb | Enemy B weapon | 949,360 | 31,821 | Rigid hand socket | Follows attack | weapon_hand_r | No individually animated fingers |

Combat switches directly to the katana attached to `weapon_hand_r`; idle/run/dodge show the stowed asset at `weapon_sheath`. This fixes the previous permanently sheathed attack. Gameplay attack timers, damage, hitboxes and animation timing are retained.

Enemy A uses the same AnimationMixer controller extended to existing enemy states: approach/move → idle/run, charge → attack with short visual recoil after firing, stun → hit, removal after lethal damage → a 0.95-second visual-only death/fade. It shares geometry/textures between instances and clones bones/materials. The simulation removes dead enemies immediately as before. Spawn scaling, flashes, health bars and telegraphs remain. Rigid triangles never blend across bones; sampled 99th-percentile edge stretch is 1.000 for every enemy clip. Low-detail trials were rejected after close-up inspection; final budgets retain armor detail. Run playback is retimed to the existing movement speeds to reduce obvious sliding; directional movement still shares an in-place cycle.

Enemy A Edge fixtures pass idle/run/attack/hit/death, attached weapons, independent instances and death cleanup. Five imported A enemies vs five procedural enemies measured approximately 240 FPS in both 240-frame samples; this is refresh-limited. Evidence: `artifacts/asset-audit/enemy-a-browser.json`.

Enemy B reuses the same build, rigid weighting, sockets, export, validator and playback controller. Windup/slash sample the same attack clip from existing timers; stun and visual death use the same handling as A. Its sword is permanently held. No enemy AI, health/damage, hitboxes, waves, camera, arena, win/lose logic, audio, or UI was changed. `simulation.js`, `world.js`, `audio.js` and `app/` match the starting checkpoint.

Final checks: **23 tests pass** (all 19 previous tests retained, plus four actual-asset/PBR/socket/state/instance/disposal checks); TypeScript and production build pass. Existing build size/route-analysis warnings remain. Edge smoke uses real movement, light/heavy attack, dodge, damage/kill and pause controls, then isolated visual fixtures for both enemy types. All requested states and attachments pass; death persists only in the visual layer and cleans up. No console/runtime/model errors. Fresh Blender re-import samples nine poses per clip: normalized weights, finite/bounded vertices, exact original materials/textures and rigid enemy geometry pass.

At 1280×720, scale 1, full resolution, 240-frame warm samples:

| Scene | Mean interval | p95 interval | Approximate FPS |
| --- | ---: | ---: | ---: |
| Original checkpoint ready scene | 4.167 ms | 4.3 ms | 240 |
| Final hero + five procedural enemies | 4.166 ms | 4.3 ms | 240 |
| Final hero + one A + four B enemies | 4.167 ms | 4.3 ms | 240 |

Performance is effectively unchanged in these short refresh-limited desktop samples; optimization stops here. This does not establish low-end performance. Final cast assets total approximately 110 MB uncompressed GLB transfer, including shared weapons, with original 4K textures preserved. Enemy instances reuse the two templates' geometry/textures; bones, mixers and flash materials are independent. Attachment references are omitted from template userData to avoid serializing geometry during cloning.

Important limits: generated topology still has glove/cloth creases and occasional small intersections; recorded hero edge-stretch values are high at some contact triangles despite corrected major deformation. No retopology, cloth simulation or corrective shapes. Run is in-place with retimed cadence, so strafing/backpedaling can slide. Rigid robot hinge seams can open under articulation. Dodge remains a crouched dash. Draw/sheath is an immediate visibility switch. The cannon is mounted to the chest; `weapon_hand_r` is its shared primary socket name, not a claim that A has a hand. All hit detection remains simulation-based, independent of visible blades/barrel.

Hero checkpoint checks: 19 existing tests, typecheck, production build and real-input Edge smoke pass. Idle sample remains approximately 240 FPS (refresh-limited, 240 frames at 1280×720). Fresh Blender re-import checks normalized weights, finite/bounded poses, exact material/texture bytes and named sockets. Close-up inspection caught and corrected glove/waist/scarf contacts; the saved first failure is `artifacts/asset-audit/hero-first-pass-deformation.png`. Small close-up creases remain. Edge stretch statistics are recorded rather than claimed perfect.

Recording scenes, relative to the repository root (open with installed Blender 4.3.2):

- Contact sheet: `artifacts/asset-audit/contact-sheet.png`.
- Raw new hero: `work/forge3d-step04/asset-06-raw.blend` (preview-only normalization), or the original GLB listed above.
- Before optimization/wireframe: `work/forge3d-step04/hero-source.blend`, `artifacts/asset-audit/hero-source-wire.png`.
- Optimized wireframe: `work/forge3d-step04/hero-optimized.blend`, `artifacts/asset-audit/hero-optimized-wire.png`.
- Hero armature/actions: `work/forge3d-step04/hero-final.blend`.
- Hero attachment and strike: `work/forge3d-step04/hero-attachments.blend`, `work/forge3d-step04/hero-combat.blend`.
- Enemy A rig: `work/forge3d-step04/enemy-a-final.blend`, `artifacts/asset-audit/enemy-a-armature.png`.
- Enemy A equipped animation: `work/forge3d-step04/enemy-a-attachments.blend`; preselected attack: `work/forge3d-step04/enemy-a-combat.blend`.
- Enemy B rig: `work/forge3d-step04/enemy-b-final.blend`, `artifacts/asset-audit/enemy-b-armature.png`.
- Enemy B equipped animation: `work/forge3d-step04/enemy-b-attachments.blend`; preselected attack: `work/forge3d-step04/enemy-b-combat.blend`.
- All final characters in the actual game renderer: `artifacts/asset-audit/final-cast-in-game.png`.
- Final combat tableau: `artifacts/asset-audit/final-combat-scene.png`; real-input combat capture: `artifacts/asset-audit/animated-combat.png`.
- Both enemy states: `artifacts/asset-audit/cast-idle.png`, `cast-run.png`, `cast-attack.png`, `cast-hit.png`, `cast-death.png`. These are isolated visual fixtures; the HUD retains the preceding real play session.
- Game: run `npm run dev`, open `http://127.0.0.1:5173`, Enter to start, WASD/left-click/right-click/Space to demonstrate states.

Select the armature, enter Pose Mode, and use the Dope Sheet's Action Editor to choose a clip; set the frame range to its action and press Space. Intermediate blends are ignored; scripts reproduce them. Inventory/previews/reports and final LFS GLBs are durable.

For a live recording with all three types, clear Wave 1 and record Wave 2: melee B enemies and the ranged A sentinel appear with the hero. The final wave naturally provides the five-enemy scene. The smoke-test tableaus use a closer test-only camera; production camera code is unchanged. Open any scene directly with `& 'D:\Blender\blender.exe' 'D:\1MDrive\ProjectsM\AIGame\work\forge3d-step04\hero-combat.blend'` (substitute the filename above). In source/optimized blends, select the mesh and press Z → Wireframe. In attachment scenes, katana is hidden on idle; use `hero-combat.blend` for the visible hand-held weapon. For enemy actions use idle 0–72, run/attack 0–30, hit 0–9, death 0–24. Hero uses idle 0–72, run 0–20, attack 0–18, dodge 0–9; scene FPS is 30.

Reproduce from the repository root with existing installed software:

```powershell
& 'D:\Blender\blender.exe' --background --python-exit-code 1 --python tools/forge3d-step04/audit.py
node tools/forge3d-step04/contact-sheet.mjs
& 'D:\Blender\blender.exe' --background --python-exit-code 1 --python tools/forge3d-step04/build.py
& 'D:\Blender\blender.exe' --background --python-exit-code 1 --python tools/forge3d-step04/validate.py
& 'D:\Blender\blender.exe' --background --python-exit-code 1 --python tools/forge3d-step04/assemble.py
node tools/forge3d-step04/armature-overlays.mjs
npm test
npx --no-install tsc --noEmit --incremental false
npm run build
# Existing dev server running; bundled Playwright, installed Edge:
$env:NODE_PATH='C:\Users\nodal\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
node tools/forge3d-step04/browser-smoke.cjs
```

Each build caches normalized source/optimized blends, with selected target budgets recorded in the optimized scene. Do not reuse a cache after changing the source or fitting/normalization parameters. Final report JSONs record original checksums and actual exported triangle counts, which can differ from requested decimation targets. Git checkpoints: inventory `5eec5de`, upgraded hero `4679164`, enemy A `af4a3bd`, then `feat: integrate melee enemy and validate final cast`. All are pushed normally to the existing origin; existing LFS configuration/remotes are retained.

Future `game-3d-asset-pipeline` Skill recommendation, now that the cast is proven (the Skill itself is not built): include `tools/forge3d-step04/audit.py`, `contact-sheet.mjs`, `build.py`, `validate.py`, `assemble.py`, `armature-overlays.mjs`, and `browser-smoke.cjs`; include their proven Step 02 dependencies `inspect_source.py`, `export_rigged.py`, `rig.py` (pose reset) and Step 03 `animate.py` (reused posing/leg placement). Package the anatomical/contact-cleanup and rigid-joint strategies actually used here; retain `character-assets.test.js` as a project integration example. Exclude failed `proxy_weights.py`, temporary trial caches, and diagnostic-only fit/weight/normal experiments.

Recommended concise SKILL.md instructions: audit/checksum originals without moving them; render consistent previews and classify from geometry/reference evidence; record a role manifest; inspect/reuse project scripts before editing; compare conservative simplification against source renders; fit the appropriate humanoid or rigid mechanical rig and verify weights; reuse/retarget existing clips; add primary-hand/stowed sockets; export with exact PBR/texture preservation; fresh-import/sample all usable states and inspect attachments; integrate only the visual layer into the existing animation/controller architecture; run project checks/browser smoke and compare matched performance; checkpoint/push known-good phases and preserve recording scenes.

Do not hardcode this project's filenames/roles, source location, triangle budgets, Blender executable path/version, operating system, dimensions/orientation/forward axis, normalization center, bone fits/joint count, number of meshes/materials/textures or embedded image format, clip names/timings, movement speeds, weapon PCA endpoint signs/pivots, socket parents, Three.js root scales, player/enemy state mappings, test tools, renderer or Git/LFS policy. These must come from the new batch, project conventions and environment. In particular, a different mechanical model may have real articulated arms, and a different supplied GLB may already have a usable rig/skin/clips.
