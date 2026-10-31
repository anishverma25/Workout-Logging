import type { LabelReading } from '../../supabase/functions/_shared/coach.ts';
import { isBarcode, labelFromOff } from '@/domain/nutrition/off';

/**
 * Packaged foods by barcode, free for everyone: the barcode is read from a photo on the phone
 * (no camera permission, the same on iPhone and Android), then looked up in Open Food Facts, a
 * free and open database of food labels. Only the barcode leaves the phone, never the photo.
 */

export const OFF_ORIGIN = 'https://world.openfoodfacts.org';

/** The barcode in a photo, or null when none could be read. The decoder loads only when used. */
export async function readBarcode(file: Blob): Promise<string | null> {
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  const reader = new BrowserMultiFormatReader(hints);
  const url = URL.createObjectURL(file);
  try {
    const result = await reader.decodeFromImageUrl(url);
    const code = result.getText().trim();
    return isBarcode(code) ? code : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export class BarcodeError extends Error {
  constructor(
    message: string,
    readonly code: 'not_found' | 'network',
  ) {
    super(message);
  }
}

/** The product for a barcode, as a label reading to check, or a clear reason why not. */
export async function lookupBarcode(code: string): Promise<LabelReading> {
  let json: unknown;
  try {
    const res = await fetch(
      `${OFF_ORIGIN}/api/v2/product/${encodeURIComponent(code.trim())}.json?fields=product_name,product_name_en,brands,serving_size,serving_quantity,nutriments`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (res.status === 404) json = { status: 0 };
    else if (!res.ok) throw new Error(String(res.status));
    else json = await res.json();
  } catch {
    throw new BarcodeError(
      'The product database could not be reached. Check your connection, or read the label instead.',
      'network',
    );
  }
  const label = labelFromOff(json);
  if (!label)
    throw new BarcodeError(
      'This product is not in the database yet. Read the label instead.',
      'not_found',
    );
  return label;
}
