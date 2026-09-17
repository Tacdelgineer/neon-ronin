# Forge3D Step 03 animation

These scripts author and validate four clips for the existing checked-in Step 02 rigged GLB. They reuse Step 02's rendering and exact-texture export helpers. No earlier public GLB is overwritten.

Run `animate.py`, then `validate.py`, using Blender 4.3.2 with `--background --python-exit-code 1 --python`. Run `browser-smoke.cjs` against the existing local game with Playwright and Microsoft Edge available. See [the milestone report](../../docs/step-03-forge3d-animation.md) for commands and limitations.

Intermediate blends, PNGs, JSON measurements, and logs go to ignored `work/forge3d-step03/`. The only public output is `public/assets/models/neon-ronin-forge3d-animated.glb`. Actions are real exported skeletal clips; the leg placement calculation runs only during authoring.
