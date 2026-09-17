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

Combat switches directly to the katana attached to `weapon_hand_r`; idle/run/dodge show the stowed asset at `weapon_sheath`. This fixes the previous permanently sheathed attack. Gameplay attack timers, damage, hitboxes and animation timing are retained.

Enemy A uses the same AnimationMixer controller extended to existing enemy states: approach/move → idle/run, charge → attack with short visual recoil after firing, stun → hit, removal after lethal damage → a 0.95-second visual-only death/fade. It shares geometry/textures between instances and clones bones/materials. The simulation removes dead enemies immediately as before. Spawn scaling, flashes, health bars and telegraphs remain. Rigid triangles never blend across bones; sampled 99th-percentile edge stretch is 1.000 for every enemy clip. Low-detail trials were rejected after close-up inspection; final budgets retain armor detail. Run playback is retimed to the existing movement speeds to reduce obvious sliding; directional movement still shares an in-place cycle.

Enemy A Edge fixtures pass idle/run/attack/hit/death, attached weapons, independent instances and death cleanup. Five imported A enemies vs five procedural enemies measured approximately 240 FPS in both 240-frame samples; this is refresh-limited. Evidence: `artifacts/asset-audit/enemy-a-browser.json`.

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
- Game: run `npm run dev`, open `http://127.0.0.1:5173`, Enter to start, WASD/left-click/right-click/Space to demonstrate states.

Select the armature, enter Pose Mode, and use the Dope Sheet's Action Editor to choose a clip; set the frame range to its action and press Space. Intermediate blends are ignored; scripts reproduce them. Inventory/previews/reports and final LFS GLBs are durable.
