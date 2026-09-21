# Forge3D Step 02 tools

These scripts are fitted to this one Neon Ronin asset. See [the milestone report](../../docs/step-02-forge3d-rigging.md) for the audit, commands, limitations, and recording checkpoints.

Run with the existing Blender 4.3.2 executable and `--python-exit-code 1`, in order:
`inspect_source.py`, `optimize.py`, `rig.py`, `skin.py`, `export_rigged.py`, `validate_export.py`.

`proxy_weights.py` preserves an unsuccessful optional experiment; skip it in the chosen workflow.

All intermediate data goes to ignored `work/forge3d-step02/`. Only `export_rigged.py` writes the processed public GLB. No script writes the source GLB or Blender startup settings. Validation poses are never exported as clips.

`browser-smoke.cjs` needs the existing Playwright Node package and installed Microsoft Edge. Set `NODE_PATH` to the directory containing Playwright if it is outside the project's dependencies. Optional `GAME_URL` overrides `http://localhost:3000`. Pass `original` only while the original visual is loaded; pass `rigged` for runtime bone/skin assertions. The benchmark records frame intervals rather than the composer's reset render counters.
