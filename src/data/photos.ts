import Dexie, { type EntityTable } from 'dexie';
import { newId } from '@/lib/ids';

/**
 * Progress photos. They stay on this device only: never synced, never uploaded, and kept in a
 * database of their own, so signing out (which can clear an account's local copy) never
 * deletes them. Each photo belongs to the account that took it ('guest' without an account).
 */

export type Pose = 'front' | 'side' | 'back';

export interface ProgressPhoto {
  id: string;
  owner: string;
  takenAt: string;
  pose: Pose;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
}

class PhotoDatabase extends Dexie {
  photos!: EntityTable<ProgressPhoto, 'id'>;
  constructor() {
    super('overload-photos');
    this.version(1).stores({ photos: 'id, owner, takenAt' });
  }
}

let instance: PhotoDatabase | null = null;
export const photoDb = () => (instance ??= new PhotoDatabase());

export const MAX_PHOTO_SIDE = 1440;

/** Scales a picture down to at most 1440 px on its longer side and re-encodes it as JPEG. */
export async function compressPhoto(
  file: Blob,
): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not read the photo.'))),
      'image/jpeg',
      0.85,
    ),
  );
  return { blob, width, height };
}

export async function addPhoto(
  owner: string,
  file: Blob,
  pose: Pose,
  takenAt: Date = new Date(),
): Promise<ProgressPhoto> {
  const { blob, width, height } = await compressPhoto(file);
  const photo: ProgressPhoto = {
    id: newId(),
    owner,
    takenAt: takenAt.toISOString(),
    pose,
    blob,
    width,
    height,
    createdAt: new Date().toISOString(),
  };
  await photoDb().photos.put(photo);
  return photo;
}

export const listPhotos = async (owner: string) =>
  (await photoDb().photos.where('owner').equals(owner).toArray()).sort((a, b) =>
    b.takenAt.localeCompare(a.takenAt),
  );

export const deletePhoto = (id: string) => photoDb().photos.delete(id);
