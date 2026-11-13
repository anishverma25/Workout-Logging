const MOTION_ATTR = 'data-lp-motion';

/** The day the thali's rings are drawn against (the same numbers as THALI_DAY in marketing.ts). */
const DAY = { kcal: 1800, proteinG: 90 };
const MAX_EACH = 6;

/**
 * The home page's motion and its one interactive part (src/styles/landing.css):
 *
 * - sections rise in as they scroll into view, and numbers count up once;
 * - the hero phones drift with scroll;
 * - the light on a card follows the pointer;
 * - the thali counter adds up the foods tapped onto the plate.
 *
 * Only transform and opacity animate, from one passive scroll listener batched per frame. The
 * page reads in full without any of this: with no IntersectionObserver the page stays still and
 * fully visible, and with reduced motion nothing slides or counts (the thali still works).
 */
export function startLandingMotion(html: HTMLElement): () => void {
  const root = document.getElementById('landing');
  if (!root) return () => {};
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const stops: (() => void)[] = [];

  html.setAttribute(MOTION_ATTR, '');
  stops.push(() => html.removeAttribute(MOTION_ATTR));
  stops.push(startThali(root));

  if (typeof IntersectionObserver === 'undefined') {
    // No way to know what is in view: show everything, as without scripts.
    root.querySelectorAll('.lp-reveal').forEach((el) => el.classList.add('lp-in'));
    return () => stops.forEach((s) => s());
  }

  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('lp-in');
        if (!reduced) e.target.querySelectorAll<HTMLElement>('[data-lp-count]').forEach(countUp);
        seen.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  root.querySelectorAll('.lp-reveal').forEach((el) => seen.observe(el));
  stops.push(() => seen.disconnect());

  const stage = root.querySelector<HTMLElement>('[data-lp-stage]');
  let frame = 0;
  const move = () => {
    frame = 0;
    if (!stage) return;
    const p = Math.min(1, Math.max(0, window.scrollY / Math.max(1, window.innerHeight)));
    stage.style.setProperty('--lp-p', p.toFixed(3));
  };
  const onScroll = () => {
    if (!frame) frame = requestAnimationFrame(move);
  };
  if (!reduced && stage) {
    window.addEventListener('scroll', onScroll, { passive: true });
    stops.push(() => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    });
  }

  // The light on a card follows the pointer (mouse only; touch has no hover to light).
  const onPointer = (ev: PointerEvent) => {
    if (ev.pointerType !== 'mouse') return;
    const card = (ev.target as Element | null)?.closest<HTMLElement>('[data-lp-spot]');
    if (!card) return;
    const box = card.getBoundingClientRect();
    card.style.setProperty('--lp-mx', `${ev.clientX - box.left}px`);
    card.style.setProperty('--lp-my', `${ev.clientY - box.top}px`);
  };
  root.addEventListener('pointermove', onPointer, { passive: true });
  stops.push(() => root.removeEventListener('pointermove', onPointer));

  return () => stops.forEach((s) => s());
}

const format = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Counts a number up to the value written in the page, once. The page's own text is the truth. */
function countUp(el: HTMLElement) {
  if (el.dataset.lpCounted) return;
  el.dataset.lpCounted = '1';
  const written = el.textContent ?? '';
  const target = Number(written.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(target) || target <= 0) return;
  const start = performance.now();
  const duration = 1100;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 4);
    // Ends on exactly what was written, whatever the formatting.
    el.textContent = t < 1 ? format(target * eased) : written;
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** The plate: each food's numbers are written on its row in the page; this only adds them up. */
function startThali(root: HTMLElement): () => void {
  const box = root.querySelector<HTMLElement>('[data-lp-thali]');
  if (!box) return () => {};
  const kcalEl = box.querySelector<HTMLElement>('[data-lp-kcal]');
  const proteinEl = box.querySelector<HTMLElement>('[data-lp-protein]');
  const lineEl = box.querySelector<HTMLElement>('[data-lp-line]');
  const ring = box.querySelector<SVGElement>('[data-lp-ring]');
  const ringProtein = box.querySelector<SVGElement>('[data-lp-ring-protein]');

  const draw = () => {
    let kcal = 0;
    let protein = 0;
    const parts: string[] = [];
    box.querySelectorAll<HTMLElement>('[data-food]').forEach((row) => {
      const n = Number(row.dataset.n) || 0;
      kcal += n * Number(row.dataset.kcal);
      protein += n * Number(row.dataset.protein);
      if (n > 0) parts.push(`${n} ${n === 1 ? row.dataset.one : row.dataset.many}`);
    });
    if (kcalEl) kcalEl.textContent = format(kcal);
    if (proteinEl) proteinEl.textContent = String(Math.round(protein));
    if (lineEl) lineEl.textContent = parts.length ? parts.join(', ') : 'An empty plate';
    const left = (share: number) => String(100 - Math.min(100, Math.round(share * 100)));
    ring?.setAttribute('stroke-dashoffset', left(kcal / DAY.kcal));
    ringProtein?.setAttribute('stroke-dashoffset', left(protein / DAY.proteinG));
  };

  const onClick = (ev: MouseEvent) => {
    const button = (ev.target as Element | null)?.closest<HTMLButtonElement>('[data-step]');
    const row = button?.closest<HTMLElement>('[data-food]');
    if (!button || !row) return;
    const next = Math.min(
      MAX_EACH,
      Math.max(0, (Number(row.dataset.n) || 0) + Number(button.dataset.step)),
    );
    row.dataset.n = String(next);
    const out = row.querySelector('output');
    if (out) out.textContent = String(next);
    draw();
  };
  box.addEventListener('click', onClick);
  return () => box.removeEventListener('click', onClick);
}
