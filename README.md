# Neon Ronin

A compact third-person 3D combat game built with Three.js, React, and Vinext. Three ruined techno-temple arenas, a red energy katana, and three escalating waves. Character GLBs use local files during development and a configurable external asset base in hosted builds. The game needs no accounts, gameplay server, or audio downloads.

## Run

```sh
npm install
npm run dev
```

Open the local address printed by the server. Requires a desktop browser with WebGL, a keyboard, and a mouse. Audio starts after entering the shrine. The game pauses when the window loses focus.

For production, host the runtime GLBs in Cloudflare R2 and set `VITE_ASSET_BASE_URL` before building. See [R2 asset deployment](docs/DEPLOYMENT.md) for the exact upload set and setup steps.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move relative to the camera |
| Mouse | Aim toward the cursor; left/right edge gives limited elevated orbit |
| Mouse wheel | Zoom in / out within gameplay bounds |
| Q / E | Orbit left / right within the elevated camera range |
| Left click / hold | Chain the three light sword attacks |
| Right click / hold | Heavy finishing slash |
| Space | Dodge in the movement direction, or toward your aim when stationary |
| Escape | Pause / resume |
| Enter | Start or immediately restart after victory / defeat |

## Encounter

Wave 1 introduces three melee drones. Wave 2 adds a ranged sentinel and one reinforcement group. The final wave has four drones and a sentinel, with two reinforcement groups and quicker pressure. At most five enemies are active. The encounter has 26 enemies in total, with only two enemy types. Each inter-wave break restores some vitality. Enemy destruction also restores a small amount.

Sentinels charge for 1.35 seconds, stop tracking aim in the final 0.28 seconds, then fire a visible projectile. Pillars block projectiles and sword strikes. Dodging provides a short invulnerable window followed by recovery. Enemy damage and telegraphs remain active during player attacks.

## Checks

```sh
npm test
npm run typecheck
npm run build
```

The deterministic combat suite covers normalized movement, arena and pillar collisions, combo damage, heavy cooldown, strike direction and occlusion, dodge invulnerability, sentinel aim lock, defeat/restart, pause, wave counts and concurrency, and a full encounter using normal movement and combat inputs. The scripted perfect-reaction run takes about 2 minutes 26 seconds; normal manual play is intended to take 3–5 minutes. Manual pacing and difficulty feedback are welcome.

Browser checks confirmed the rendered arena, start/restart, movement, attacks, dodge, and defeat presentation. Extended browser playtesting was stopped at the user's request so they can play manually.

## Source

- `lib/game/simulation.js`: renderer-independent combat and wave logic.
- `lib/game/world.js`: fixed arena, articulated models, and animation.
- `lib/game/engine.js`: renderer, camera, input, effects, and lifecycle.
- `lib/game/audio.js`: synthesized action sounds and temple ambience.
- `app/page.tsx`, `app/globals.css`: game interface.

Each completed wave leads through a short fade to the next arena: Silent Shrine, Ember Gates, then Moon Terrace. These reuse the same procedural art with distinct pillar layouts, floor inlays, shrine placement and lighting. Reinforcements remain in the current arena. No reference images are shipped as gameplay backgrounds.
