/**
 * Community photos (migration 0040): redrawn on the phone into a JPEG, which drops EXIF and GPS
 * because only the pixels are copied, plus a small thumbnail for the feed. The server checks the
 * format and size again (`forum_media` constraints).
 */
import type { NewPhoto } from '@/app/forum';

export class PhotoError extends Error {}

const FULL_PX = 1280;
const THUMB_PX = 560;
/** Characters of the data URL the server accepts (forum_media). */
export const FULL_MAX = 380_000;
export const THUMB_MAX = 76_000;

async function decode(file: Blob): Promise<{ source: CanvasImageSource; w: number; h: number }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, w: bitmap.width, h: bitmap.height };
    } catch {
      // Older Safari: fall back to an image element.
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
    throw new PhotoError('That file is not a photo we can open. Try a JPEG or PNG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(source: CanvasImageSource, w: number, h: number, longSide: number, max: number) {
  const scale = Math.min(1, longSide / Math.max(w, h));
  let cw = Math.max(16, Math.round(w * scale));
  let ch = Math.max(16, Math.round(h * scale));
  for (let attempt = 0; attempt < 4; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PhotoError('This browser cannot prepare photos.');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, cw, ch);
    for (const q of [0.82, 0.72, 0.62, 0.5]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= max && url.startsWith('data:image/jpeg;base64,/9j/'))
        return { url, w: cw, h: ch };
    }
    cw = Math.round(cw * 0.8);
    ch = Math.round(ch * 0.8);
  }
  throw new PhotoError('That photo is too detailed to share. Try another.');
}

export async function preparePhoto(file: File): Promise<NewPhoto> {
  if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name))
    throw new PhotoError('Choose a photo.');
  if (file.size > 15 * 1024 * 1024) throw new PhotoError('That photo is over 15 MB.');
  const { source, w, h } = await decode(file);
  if (!w || !h) throw new PhotoError('That file is not a photo we can open.');
  if (Math.max(w, h) / Math.min(w, h) > 4) throw new PhotoError('That photo is too long and thin.');
  const full = encode(source, w, h, FULL_PX, FULL_MAX);
  const thumb = encode(source, w, h, THUMB_PX, THUMB_MAX);
  if ('close' in source && typeof source.close === 'function') source.close();
  return { full: full.url, thumb: thumb.url, w: full.w, h: full.h };
}
