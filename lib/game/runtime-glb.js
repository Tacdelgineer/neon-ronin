import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Sites caps individual deployment files at 25 MiB. The production build splits
// the two larger runtime models byte-for-byte, then the browser rejoins them
// before Three.js parses the GLB. Node tests keep loading the canonical sources.
const CHUNKED_MODELS = new Map([
  ['/assets/models/hero-final.glb', 2],
  ['/assets/models/enemy-b-final.glb', 2],
]);

export async function loadRuntimeGlb(url) {
  const loader = new GLTFLoader();
  const partCount = CHUNKED_MODELS.get(url);
  if (!partCount || typeof window === 'undefined') return loader.loadAsync(url);

  const parts = await Promise.all(Array.from({ length: partCount }, async (_, index) => {
    const response = await fetch(`${url}.part-${index}`);
    if (!response.ok) throw new Error(`Failed to load ${url} part ${index}: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }));
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return loader.parseAsync(joined.buffer, url.slice(0, url.lastIndexOf('/') + 1));
}
