import { existsSync, mkdirSync, unlink } from 'node:fs';
import { join } from 'node:path';

/**
 * Mounted as a named Docker volume in production (docker-compose.prod.yml,
 * /app/uploads) so uploaded photos survive a container rebuild.
 */
export const PRODUCT_IMAGES_UPLOADS_DIR =
  process.env.PRODUCT_IMAGES_UPLOADS_DIR ??
  join(process.cwd(), 'uploads', 'product-images');

export const ALLOWED_PRODUCT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

/** The frontend shrinks photos before sending them; this only stops abuse. */
export const MAX_PRODUCT_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function ensureProductImagesUploadsDir(): void {
  if (!existsSync(PRODUCT_IMAGES_UPLOADS_DIR)) {
    mkdirSync(PRODUCT_IMAGES_UPLOADS_DIR, { recursive: true });
  }
}

/** Best-effort delete — a missing file should never block replacing/removing a photo. */
export function deleteProductImageFile(storagePath: string): void {
  unlink(storagePath, () => undefined);
}

/**
 * Where a client loads an uploaded photo from: the public image endpoint,
 * relative to the API's own prefix (which both nginx and the Vite dev server
 * proxy), versioned so a replaced photo never comes from a stale cache.
 */
export function productImagePublicUrl(
  productId: string,
  updatedAt: Date,
): string {
  const prefix = (process.env.API_PREFIX ?? 'api/v1').replace(/^\/+|\/+$/g, '');
  return `/${prefix}/public/product-images/${productId}?v=${updatedAt.getTime()}`;
}
