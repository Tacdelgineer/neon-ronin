const configuredAssetBaseUrl =
  typeof import.meta.env === 'object' && typeof import.meta.env.VITE_ASSET_BASE_URL === 'string'
    ? import.meta.env.VITE_ASSET_BASE_URL.trim()
    : '';

export const ASSET_BASE_URL = configuredAssetBaseUrl.replace(/\/+$/, '');

export function assetUrl(path) {
  const relativePath = path.replace(/^\/+/, '');
  return ASSET_BASE_URL ? `${ASSET_BASE_URL}/${relativePath}` : `/${relativePath}`;
}
