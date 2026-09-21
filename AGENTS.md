# AGENTS.md

This file applies to the entire Neon Ronin repository.

## Project purpose

Neon Ronin is a short, single-player browser combat game built with React, Vinext, Three.js, and WebGL. The renderer, camera, input, effects, and model presentation run in the browser. `lib/game/simulation.js` is the renderer-independent authority for movement, combat, enemies, waves, collisions, and arena transitions.

## Fastest local setup

Prerequisites:

- Git with Git LFS. Every GLB is tracked through LFS.
- Node.js 22.13.0 or newer, as declared in `package.json`, with npm.
- A desktop browser with WebGL enabled, plus a keyboard and mouse.

From a fresh clone:

```sh
git lfs install
git clone https://github.com/Tacdelgineer/neon-ronin.git
cd neon-ronin
git lfs pull
npm ci
npm run dev
```

Open the local URL printed by Vinext, normally `http://localhost:3000`.

The repository contains everything required for local play. No account, cloud service, `.env` file, Cloudflare credentials, Blender install, or asset download outside Git LFS is required. With `VITE_ASSET_BASE_URL` unset, model requests resolve to `/assets/models/...` and Vinext serves the checked-out files in `public/assets/models`.

## Success check

The browser should show the **Neon Ronin** title screen over The Silent Shrine. Select **Enter the Shrine** to see the detailed red-scarfed hero, energy katana, and detailed mechanical enemies. WASD moves, the mouse aims, left click attacks, and Space dodges.

GLB failures do not always stop the game: the engine deliberately keeps low-detail procedural characters as a fallback. If the detailed Forge3D characters never appear, check the browser console for `Forge3D ... could not load` errors and run `git lfs pull`. In development, this console check confirms the player model loaded:

```js
document.querySelector('.world')?.dataset.playerModel === 'forge3d'
```

## Repository tour

| Path | Responsibility |
| --- | --- |
| `app/page.tsx` | Game page, HUD, title/pause/end states, and engine lifecycle |
| `app/globals.css` | Full-screen game and interface styling |
| `lib/game/simulation.js` | Authoritative gameplay, waves, collision, and arena definitions |
| `lib/game/engine.js` | Three.js renderer, input, camera, effects, scene lifecycle, and model fallback |
| `lib/game/world.js` | Procedural arena scenery and procedural fallback actors |
| `lib/game/player-model.js` | Hero GLB, emissive katana, hand/stow socket switching, and visual motion |
| `lib/game/enemy-model.js` | Enemy GLB templates, equipment, cloning, and cleanup |
| `lib/game/player-animation.js` | Existing idle/run/attack/dodge and enemy animation-state playback |
| `lib/game/audio.js` | Synthesized music ambience and combat sounds |
| `lib/game/asset-url.js` | Local or external asset URL resolution |
| `public/assets/models/` | Runtime GLBs and preserved Forge3D checkpoints, stored with Git LFS |
| `lib/game/*.test.js` | Node test suite for simulation, assets, sockets, and animation |
| `docs/DEPLOYMENT.md` | Cloudflare R2 upload set and production deployment setup |
| `docs/step-*.md` | Asset-processing milestone records |
| `tools/forge3d-step02/` | Blender optimization, rigging, skinning, and export scripts |
| `tools/forge3d-step03/` | Blender animation authoring and validation scripts |
| `tools/forge3d-step04/` | Final character, equipment, katana, audit, and smoke-test tools |

## Large assets and hosted builds

Local development and hosted production use the same canonical GLBs but may serve them from different places:

- Unset `VITE_ASSET_BASE_URL`: load `public/assets/models` locally. This is the normal clone-and-run path.
- Set `VITE_ASSET_BASE_URL`: prepend that public base to `assets/models/...`. A production build then omits its local model directory because those URLs point to external storage.
- Cloudflare R2 is needed only for the lightweight hosted deployment, not ordinary development.

Keep `.env.production.local` untracked. Use `.env.example` as the safe template and follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the exact R2 object paths and CORS setup.

## Working rules

- Inspect the existing implementation and nearby tests before editing.
- Treat `simulation.js` as gameplay authority. Preserve timing, damage, movement, AI, waves, and collisions unless the task explicitly changes them.
- Reuse the existing renderer, camera, animation controllers, and `weapon_hand_r` / `weapon_sheath` socket convention.
- Keep model hand and stowed transforms independent and configurable in the existing model-loading code.
- Do not replace working systems with a new framework or introduce an asset backend.
- Keep changes focused. Avoid unrelated refactors and broad formatting churn.
- Do not overwrite source/checkpoint GLBs. Do not run the Blender tools unless the task concerns asset processing.
- Preserve materials and embedded textures when working with GLBs. Keep all GLBs in Git LFS.
- Preserve both local asset fallback and external production asset-base behavior.
- Do not commit `.env*` files other than `.env.example`, credentials, private URLs, machine-specific paths, generated builds, caches, `node_modules`, `work`, or `outputs`.
- Prefer lightweight validation. Do not replay the entire encounter unless the change requires it.

## Validation

After meaningful code or setup changes, run:

```sh
npm test
npm run typecheck
npm run build
```

The current test command runs 23 tests. For rendering, model, input, or camera changes, also do one short browser smoke check. Documentation-only changes need link/path checks plus the canonical commands when reasonable.
