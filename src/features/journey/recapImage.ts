import type { Recap } from '@/domain/analytics/recap';
import { APP_NAME } from '@/app/navigation';
import { formatWeightValue, toDisplayWeight, type WeightUnit } from '@/lib/units';

const W = 1080;
const H = 1350;
const DISPLAY = "ui-rounded, 'SF Pro Rounded', 'Rubik Variable', system-ui, sans-serif";
const TEXT = "-apple-system, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif";

export function recapTitle(recap: Recap): string {
  return recap.kind === 'year'
    ? `${recap.start.getFullYear()} in review`
    : recap.start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * Draws the recap as a 1080 × 1350 image for sharing (the 4:5 shape social apps use). Only
 * numbers from the recap appear on it; nothing about the person beyond what they choose to share.
 */
export async function renderRecapImage(recap: Recap, unit: WeightUnit): Promise<Blob> {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);
  // Three soft rings in the corner, in the app's ring colours.
  const rings = [
    ['#b4f000', '#e2ff6b'],
    ['#ff5a2e', '#ff9a5a'],
    ['#7d7bff', '#b3a6ff'],
  ];
  rings.forEach(([a, b], i) => {
    const r = 210 - i * 62;
    const g = ctx.createLinearGradient(W - 420, 0, W, 420);
    g.addColorStop(0, a!);
    g.addColorStop(1, b!);
    ctx.strokeStyle = g;
    ctx.lineWidth = 46;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(W - 200, 200, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (0.92 - i * 0.14));
    ctx.stroke();
  });

  ctx.fillStyle = '#a1a1a6';
  ctx.font = `600 40px ${TEXT}`;
  ctx.fillText(APP_NAME, 80, 130);
  ctx.fillStyle = '#f5f5f7';
  ctx.font = `700 96px ${DISPLAY}`;
  wrap(ctx, recapTitle(recap), 80, 250, 620, 104);

  const stats: [string, string][] = [
    ['Workouts', String(recap.workouts)],
    ['Training days', String(recap.days)],
    ['Working sets', recap.workingSets.toLocaleString()],
    [`Volume (${unit})`, Math.round(toDisplayWeight(recap.volumeKg, unit)).toLocaleString()],
    ['Hours', (recap.minutes / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })],
    ['Records', String(recap.records)],
  ];
  stats.forEach(([label, value], i) => {
    const x = 80 + (i % 2) * 470;
    const y = 520 + Math.floor(i / 2) * 200;
    ctx.fillStyle = '#1c1c1e';
    roundRect(ctx, x, y - 70, 440, 170, 36);
    ctx.fillStyle = '#a1a1a6';
    ctx.font = `500 32px ${TEXT}`;
    ctx.fillText(label, x + 36, y - 10);
    ctx.fillStyle = '#f5f5f7';
    ctx.font = `700 72px ${DISPLAY}`;
    ctx.fillText(value, x + 36, y + 70);
  });

  if (recap.topLift) {
    ctx.fillStyle = '#c6f432';
    ctx.font = `600 34px ${TEXT}`;
    ctx.fillText('Biggest gain', 80, 1170);
    ctx.fillStyle = '#f5f5f7';
    ctx.font = `600 44px ${DISPLAY}`;
    const t = recap.topLift;
    ctx.fillText(
      `${t.name}: ${formatWeightValue(t.fromKg, unit)} to ${formatWeightValue(t.toKg, unit)} ${unit}`,
      80,
      1230,
      W - 160,
    );
    ctx.fillStyle = '#a1a1a6';
    ctx.font = `400 28px ${TEXT}`;
    ctx.fillText('Estimated 1RM', 80, 1275);
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not draw the image.'))),
      'image/png',
    ),
  );
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  max: number,
  line: number,
) {
  const words = text.split(' ');
  let current = '';
  let row = 0;
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > max && current) {
      ctx.fillText(current, x, y + row * line);
      current = word;
      row++;
    } else current = next;
  }
  ctx.fillText(current, x, y + row * line);
}

/** Opens the share sheet with the image where supported, otherwise downloads it. */
export async function shareImage(
  blob: Blob,
  name: string,
  title: string,
): Promise<'shared' | 'saved'> {
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'saved';
}
