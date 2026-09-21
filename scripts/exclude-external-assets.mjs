import { rm } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const assetBaseUrl = (process.env.VITE_ASSET_BASE_URL || env.VITE_ASSET_BASE_URL || '').trim();

if (assetBaseUrl) {
  await rm(path.resolve('dist/client/assets/models'), { recursive: true, force: true });
  console.log(`External assets enabled: omitted local models from the hosted build (${assetBaseUrl})`);
}
