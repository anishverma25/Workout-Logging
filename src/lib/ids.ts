import type { Rng } from './random';

/** New random record id. Generated on the device so offline-created records sync idempotently. */
export function newId(): string {
  return crypto.randomUUID();
}

function toUuid(bytes: number[]): string {
  // Set version 4 and RFC 4122 variant bits so ids validate as UUIDs.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Deterministic UUID from a seeded generator (demo data). */
export function seededId(rng: Rng): string {
  return toUuid(Array.from({ length: 16 }, () => Math.floor(rng.next() * 256)));
}

/**
 * Stable UUID derived from a string (built-in exercises).
 * The same key yields the same id on every device, which keeps future cloud sync consistent.
 */
export function stableId(key: string): string {
  const bytes: number[] = [];
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let round = 0; bytes.length < 16; round++) {
    for (let i = 0; i < key.length; i++) {
      const c = key.charCodeAt(i) + round * 31;
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ (c + h1), 2246822519) >>> 0;
    }
    bytes.push(h1 & 0xff, (h1 >>> 8) & 0xff, h2 & 0xff, (h2 >>> 8) & 0xff);
  }
  return toUuid(bytes.slice(0, 16));
}
