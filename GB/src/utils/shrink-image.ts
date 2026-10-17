/**
 * Shrinks a photo in the browser before uploading it: a 4 MB phone photo
 * becomes ~150-300 KB, so it uploads fast on a weak connection and the
 * customer menu loads quickly. Keeps the proportions; never enlarges.
 * Falls back to JPEG where the browser can't encode WEBP.
 */
export async function shrinkImage(file: File, maxSide = 1200, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg');
  if (!blob) return file;

  // Already small and light: the original is as good.
  if (blob.size >= file.size && scale === 1) return file;
  const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${baseName}.${extension}`, { type: blob.type });
}
