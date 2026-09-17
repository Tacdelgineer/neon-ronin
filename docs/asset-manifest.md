# Character asset manifest

Audited in place on 2026-09-17 with Blender 4.3.2. `incoming-assets/` and reference PNGs were absent; the supplied batch is eight untracked GLBs in `docs/`. Originals are preserved byte-for-byte, with existing Git LFS rules. Filenames were not used to infer roles.

Machine-readable checksums, byte sizes, bounds/dimensions, object/mesh counts, triangles, material JSON, texture dimensions, skeleton/skin presence and clips: [inventory.json](../artifacts/asset-audit/inventory.json).

Standardized front, three-quarter and rear renders use the previous milestone's neutral studio, identical orthographic framing, lighting, and normalized longest dimension. [Contact sheet](../artifacts/asset-audit/contact-sheet.png). Inspectable raw scenes: `work/forge3d-step04/asset-01-raw.blend` through `asset-08-raw.blend` (preview normalization only).

| ID | Original file (under docs/) | Identified role | Source triangles | Evidence |
| --- | --- | --- | ---: | --- |
| 01 | ChatGPT Image Sep 16 2026 04_51_53 PM (1).glb | Enemy B melee weapon | 949,360 | Large mechanical sword, white/red armor and powered hilt matching B |
| 02 | ChatGPT Image Sep 16 2026 04_51_56 PM.glb | Enemy A cannon | 976,607 | Heavy mechanical barrel, circular mount and armor matching A |
| 03 | ChatGPT Image Sep 16 2026 04_51_57 PM.glb | Enemy A shield / armor accessory | 966,776 | White/red rectangular panel with mechanical rear mounts |
| 04 | ChatGPT Image Sep 16 2026 04_55_07 PM.glb | Hero sheath | 958,449 | Black scabbard with katana guard/mouth detail |
| 05 | ChatGPT Image Sep 16 2026 04_55_11 PM.glb | Hero red katana | 990,187 | Curved red blade, black wrapped grip, circular guard |
| 06 | ChatGPT Image Sep 16 2026 05_15_40 PM.glb | Upgraded hero | 997,783 | Ronin, red scarf/sash, asymmetric white armor; clearer separated stance/accessories |
| 07 | enemy1.glb | Enemy A: ranged mechanical humanoid | 966,995 | Broad circular torso, optical core, heavy legs; same mechanical family as cannon |
| 08 | enemy2.glb | Enemy B: melee mechanical humanoid | 935,198 | Taller humanoid, red core, articulated arms; matches mechanical sword |

All assets are single unrigged meshes with one material, two embedded 4096-square textures, no skin and no animation clips. Classification confidence is high. The extra shield is useful as Enemy A's secondary attachment; it does not introduce equipment mechanics.
