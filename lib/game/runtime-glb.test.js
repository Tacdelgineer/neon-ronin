import test from 'node:test';
import assert from 'node:assert/strict';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadRuntimeGlb } from './runtime-glb.js';

test('Sites model chunks are reassembled byte-for-byte before parsing', async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = {};
  const requested = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    requested.push(url);
    const data = url.endsWith('part-0') ? new Uint8Array([1, 2, 3]) : new Uint8Array([4, 5]);
    return { ok: true, arrayBuffer: async () => data.buffer };
  });
  t.mock.method(GLTFLoader.prototype, 'parseAsync', async (buffer, path) => {
    assert.deepEqual([...new Uint8Array(buffer)], [1, 2, 3, 4, 5]);
    assert.equal(path, '/assets/models/');
    return { scene: 'parsed' };
  });
  try {
    assert.deepEqual(await loadRuntimeGlb('/assets/models/hero-final.glb'), { scene: 'parsed' });
    assert.deepEqual(requested, [
      '/assets/models/hero-final.glb.part-0',
      '/assets/models/hero-final.glb.part-1',
    ]);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
