# Neon Ronin

A compact third-person 3D combat game built with Three.js, React, and Vinext. One ruined techno-temple courtyard, an energy katana, and three escalating waves. All models, materials, animation, effects, and sound are generated locally; the game needs no accounts, gameplay server, external assets, or audio downloads.

## Run

```sh
npm install
npm run dev
```

Open the local address printed by the server. Requires a desktop browser with WebGL, a keyboard, and a mouse. Audio starts after entering the shrine. The game pauses when the window loses focus.

## Controls

| Input | Action |
| --- | --- |
| WASD | Move relative to the camera |
| Mouse | Aim toward the cursor; move to the left/right edge to orbit the elevated camera |
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
npx tsc --noEmit
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

The environment is a fixed authored arena. Seeded variation is only used for surface wear, vegetation, and particles; it does not generate levels. No reference images are shipped as gameplay backgrounds.
