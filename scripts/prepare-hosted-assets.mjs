import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const modelDir = path.resolve('dist/client/assets/models');
const chunkSize = 16 * 1024 * 1024;
const chunked = ['hero-final.glb', 'enemy-b-final.glb'];
const developmentOnly = [
  'neon-ronin-forge3d.glb',
  'neon-ronin-forge3d-animated.glb',
  'neon-ronin-forge3d-rigged.glb',
];

for (const name of chunked) {
  const source = path.join(modelDir, name);
  const bytes = await readFile(source);
  const parts = Math.ceil(bytes.byteLength / chunkSize);
  if (parts !== 2) throw new Error(`${name} no longer fits the two-part runtime contract`);
  for (let index = 0; index < parts; index++) {
    await writeFile(`${source}.part-${index}`, bytes.subarray(index * chunkSize, (index + 1) * chunkSize));
  }
  await rm(source);
}

for (const name of developmentOnly) await rm(path.join(modelDir, name), { force: true });

const limit = 25 * 1024 * 1024;
for (const entry of await readdir(modelDir, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const bytes = await readFile(path.join(modelDir, entry.name));
  if (bytes.byteLength > limit) throw new Error(`${entry.name} exceeds the Sites 25 MiB file limit`);
}
