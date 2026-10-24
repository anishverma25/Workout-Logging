/**
 * Photos for the AI: resized on the phone to at most 1,280 px on the long side and saved as
 * JPEG, so an upload is about 150 to 300 KB instead of several MB, and the AI sees enough
 * detail to count rotis and judge a katori. The photo is never stored.
 */

export const PHOTO_MAX_SIDE = 1280;
/** Labels keep more detail: the small print has to stay readable. */
export const LABEL_MAX_SIDE = 2000;

export interface PreparedPhoto {
  /** Base64 JPEG without the data: prefix. */
  data: string;
  mime: 'image/jpeg';
  /** For showing on screen; revoke with URL.revokeObjectURL when done. */
  url: string;
  width: number;
  height: number;
}

export async function preparePhoto(
  file: Blob,
  maxSide = PHOTO_MAX_SIDE,
  quality = 0.82,
): Promise<PreparedPhoto> {
  // createImageBitmap applies the photo's EXIF rotation, so portrait shots stay upright.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This phone cannot prepare photos.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not read the photo.'))),
      'image/jpeg',
      quality,
    ),
  );
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read the photo.'));
    reader.readAsDataURL(blob);
  });
  return { data, mime: 'image/jpeg', url: URL.createObjectURL(blob), width, height };
}
