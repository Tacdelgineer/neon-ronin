# R2 asset deployment

The game loads model URLs from `VITE_ASSET_BASE_URL` when it is set at build time. With no value, local development continues to use `public/assets/models`.

## One-time Cloudflare setup

1. Authenticate Wrangler and create a bucket. The bucket name below is an example and can be changed.

   ```powershell
   npx wrangler login
   npx wrangler r2 bucket create neon-ronin-assets
   ```

2. Allow public browser reads from the bucket using [Cloudflare's R2 CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/).

   ```powershell
   npx wrangler r2 bucket cors set neon-ronin-assets --file docs/r2-cors.json
   npx wrangler r2 bucket cors list neon-ronin-assets
   ```

   The supplied rule allows cross-origin `GET` requests because these are public game files and no credentials are sent.

3. In the Cloudflare dashboard, open **R2 > neon-ronin-assets > Settings > Custom Domains**, connect a production asset hostname such as `assets.example.com`, and wait for it to become **Active**. Cloudflare's [public bucket guide](https://developers.cloudflare.com/r2/buckets/public-buckets/) describes the same flow; the `r2.dev` URL is suitable only for a temporary check.

4. Upload the eight runtime models under the `neon-ronin/assets/models/` prefix. This preserves the URL paths expected by the game.

   ```powershell
   $models = @(
     'hero-final.glb',
     'hero-energy-katana-final.glb',
     'hero-sheath-final.glb',
     'enemy-a-final.glb',
     'enemy-a-cannon-final.glb',
     'enemy-a-shield-final.glb',
     'enemy-b-final.glb',
     'enemy-b-blade-final.glb'
   )

   foreach ($model in $models) {
     npx wrangler r2 object put "neon-ronin-assets/neon-ronin/assets/models/$model" `
       --file "public/assets/models/$model" `
       --content-type "model/gltf-binary" `
       --remote
   }
   ```

5. Copy `.env.example` to the ignored `.env.production.local` file and replace the placeholder with the active public domain. Do not add a trailing `/`.

   ```dotenv
   VITE_ASSET_BASE_URL=https://assets.example.com/neon-ronin
   ```

6. Verify one object and its CORS response before building.

   ```powershell
   curl.exe -I -H "Origin: https://neon-ronin-temple.alireza96.chatgpt.site" `
     "https://assets.example.com/neon-ronin/assets/models/hero-final.glb"
   ```

   Expect `200 OK` and an `Access-Control-Allow-Origin` response header.

7. Build the site. When the asset base is configured, the build references R2 and omits `dist/client/assets/models`; it never splits or repackages a GLB.

   ```powershell
   npm run build
   ```

## Hosting-limit audit

The Sites per-file limit encountered by this project is 25 MiB (26,214,400 bytes). These files in `public/assets/models` exceed it or are within roughly 3 MiB:

| Asset | Size | Runtime upload? |
| --- | ---: | --- |
| `neon-ronin-forge3d.glb` | 39.58 MiB | No; preserved source checkpoint |
| `hero-final.glb` | 27.16 MiB | Yes |
| `enemy-b-final.glb` | 26.13 MiB | Yes |
| `neon-ronin-forge3d-animated.glb` | 24.17 MiB | No; preserved development checkpoint |
| `neon-ronin-forge3d-rigged.glb` | 23.95 MiB | No; preserved development checkpoint |
| `enemy-a-final.glb` | 22.36 MiB | Yes |

Only the eight runtime files in step 4 need to be uploaded. Source and development checkpoints remain local and in Git LFS; the hosted build excludes the entire local model directory when R2 is configured.
