const MOTION_ATTR = 'data-lp-motion';

/**
 * The home page's motion (src/styles/landing.css): sections rise in as they scroll into view,
 * and the hero phones drift apart with scroll. Only transform and opacity change, from one
 * passive scroll listener batched per frame. Without IntersectionObserver, or with reduced
 * motion, the page simply stays still and fully visible.
 */
export function startLandingMotion(html: HTMLElement): () => void {
  const root = document.getElementById('landing');
  if (!root || typeof IntersectionObserver === 'undefined') return () => {};
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  html.setAttribute(MOTION_ATTR, '');
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('lp-in');
        seen.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
  );
  root.querySelectorAll('.lp-reveal').forEach((el) => seen.observe(el));

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
  if (!reduced && stage) window.addEventListener('scroll', onScroll, { passive: true });

  return () => {
    seen.disconnect();
    window.removeEventListener('scroll', onScroll);
    if (frame) cancelAnimationFrame(frame);
    html.removeAttribute(MOTION_ATTR);
  };
}
