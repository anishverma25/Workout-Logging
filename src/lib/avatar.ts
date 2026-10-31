/**
 * Turns a chosen photo into a small square profile picture: centre-cropped, 256 px, JPEG, as a
 * data URL. Done on the phone, so nothing large is stored or sent, and EXIF data (location) is
 * dropped because only the pixels are redrawn.
 */
export const AVATAR_PX = 256;

export class AvatarError extends Error {}

async function decode(file: Blob): Promise<{ source: CanvasImageSource; w: number; h: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Applies the photo's own rotation, so portrait phone photos stay upright.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, w: bitmap.width, h: bitmap.height };
    } catch {
      // Fall through to an image element (older Safari, HEIC handed over as JPEG).
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, w: img.naturalWidth, h: img.naturalHeight };
  } catch {
    throw new AvatarError('That file is not a photo we can open. Try a JPEG or PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The centre square of the photo, as a JPEG data URL of `px` by `px`. */
export async function avatarFromFile(file: Blob, px = AVATAR_PX): Promise<string> {
  if (!file.type.startsWith('image/')) throw new AvatarError('Choose a photo.');
  if (file.size > 25 * 1024 * 1024) throw new AvatarError('That photo is too large.');
  const { source, w, h } = await decode(file);
  if (!w || !h) throw new AvatarError('That file is not a photo we can open.');
  const side = Math.min(w, h);
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new AvatarError('This browser cannot resize photos.');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, (w - side) / 2, (h - side) / 2, side, side, 0, 0, px, px);
  if ('close' in source && typeof source.close === 'function') source.close();
  // Quality falls until the picture fits comfortably in the profile row.
  for (const quality of [0.85, 0.75, 0.6, 0.45]) {
    const url = canvas.toDataURL('image/jpeg', quality);
    if (url.length <= 60_000) return url;
  }
  return canvas.toDataURL('image/jpeg', 0.35);
}
