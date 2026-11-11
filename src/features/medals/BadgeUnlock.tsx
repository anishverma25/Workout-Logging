import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Share } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/kit';
import type { Badge } from '@/domain/achievements/badges';
import { haptic } from '@/lib/haptics';
import { BadgeMedallion } from './BadgeMedallion';

/**
 * The unlock moment (Badges 2.0): a burst of light, the badge flips in with a spring, then its
 * name, what it means and the next goal. Shown once per badge on this phone, right after the
 * workout that earned it. Confetti grows with the tier. Reduced motion shows it still.
 */

const KEY = (account: string) => `overload.badgesSeen.${account}`;

export function seenBadges(account: string | null): Set<string> {
  if (!account) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY(account)) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

export function markBadgesSeen(account: string | null, ids: string[]) {
  if (!account || !ids.length) return;
  try {
    const seen = seenBadges(account);
    for (const id of ids) seen.add(id);
    localStorage.setItem(KEY(account), JSON.stringify([...seen].slice(-500)));
  } catch {
    // Not remembered in a private window; it would show again, which does no harm.
  }
}

/** What is left for a locked badge, in its own unit: "32.5 kg to go", "2 weeks to go". */
export function toGo(b: Badge): string {
  const left = Math.max(0, Math.round((b.target - b.current) * 10) / 10);
  if (b.target <= 1) return 'Locked';
  const n = left.toLocaleString('en-IN');
  const one = left === 1;
  switch (b.group) {
    case 'plates':
      return `${n} kg to go`;
    case 'tonnage':
      return `${n} ${one ? 'tonne' : 'tonnes'} to go`;
    case 'streaks':
      return `${n} ${one ? 'week' : 'weeks'} to go`;
    case 'medals':
      return `${n} ${one ? 'medal' : 'medals'} to go`;
    case 'habits':
      return b.id === 'weekend-warrior' ? `${n} ${one ? 'weekend' : 'weekends'} to go` : `${n} ${one ? 'workout' : 'workouts'} to go`;
    default:
      return `${n} ${one ? 'workout' : 'workouts'} to go`;
  }
}

/** The badge's line: the same family and, for strength badges, the same lift. */
const lineOf = (b: Badge) => b.id.replace(/-[\d.]+$/, '');

/** The next badge on the same line to chase, with how far along it is. */
export function nextGoal(badge: Badge, all: Badge[]): { label: string; left: string; frac: number } | null {
  const next = all
    .filter((b) => b.group === badge.group && !b.earnedAt && b.target > badge.target && lineOf(b) === lineOf(badge))
    .sort((a, b) => a.target - b.target)[0];
  if (!next) return null;
  const left = toGo(next);
  return {
    label: `Next: ${next.title}`,
    left: left === 'Locked' ? '' : left,
    frac: Math.min(1, next.current / Math.max(1, next.target)),
  };
}

const TIER_LABEL = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', legend: 'Legend' } as const;
const CONFETTI = { bronze: 26, silver: 44, gold: 90, legend: 130 } as const;

function confettiColours(tier: Badge['tier']): string[] {
  const css = getComputedStyle(document.documentElement);
  const v = (n: string) => css.getPropertyValue(n).trim();
  const lime = v('--lime');
  const white = v('--text-1');
  switch (tier) {
    case 'bronze':
      return [v('--tier-bronze-text'), lime, white];
    case 'silver':
      return [white, v('--tier-silver-b'), lime];
    case 'gold':
      return [v('--tier-gold-text'), lime, white, v('--report-food')];
    default:
      return [v('--tier-legend-a'), v('--tier-legend-b'), v('--tier-legend-c'), v('--tier-legend-d'), white];
  }
}

function Confetti({ tier, run }: { tier: Badge['tier']; run: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    const c = cv.getContext('2d');
    if (!c) return;
    c.scale(dpr, dpr);
    const cols = confettiColours(tier);
    let seed = 11 + run;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const cx = r.width / 2;
    const cy = r.height * 0.36;
    const ps = Array.from({ length: CONFETTI[tier] }, () => {
      const a = rnd() * Math.PI * 2;
      const v = 3 + rnd() * 7;
      return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, w: 4 + rnd() * 5, h: 6 + rnd() * 8, r: rnd() * 6, vr: (rnd() - 0.5) * 0.4, c: cols[Math.floor(rnd() * cols.length)]!, life: 0 };
    });
    const start = performance.now() + 700;
    let raf = 0;
    const frame = (now: number) => {
      c.clearRect(0, 0, r.width, r.height);
      if (now < start) {
        raf = requestAnimationFrame(frame);
        return;
      }
      let alive = false;
      for (const p of ps) {
        p.life++;
        p.vy += 0.18;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        const o = Math.max(0, 1 - p.life / 150);
        if (o > 0 && p.y < r.height + 20) alive = true;
        c.save();
        c.globalAlpha = o;
        c.translate(p.x, p.y);
        c.rotate(p.r);
        c.fillStyle = p.c;
        c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        c.restore();
      }
      if (alive) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [tier, run]);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 size-full" aria-hidden />;
}

export function BadgeUnlock({
  queue,
  all,
  onDone,
  onShare,
}: {
  /** Badges to celebrate, in order; shown one at a time. */
  queue: Badge[];
  all: Badge[];
  onDone: () => void;
  onShare: (badge: Badge) => void;
}) {
  const [i, setI] = useState(0);
  const badge = queue[i];
  const nice = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!badge) return;
    haptic('success');
    nice.current?.focus({ preventScroll: true });
  }, [badge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  if (!badge) return null;
  const next = nextGoal(badge, all);
  const style = { '--glow': `var(--tier-${badge.tier}-glow)` } as CSSProperties;
  const more = i < queue.length - 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unlock-name"
      aria-describedby="unlock-meaning"
      className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-bg/95 px-6 backdrop-blur-sm"
      style={style}
      data-badge-unlock={badge.id}
    >
      <div key={badge.id} className="relative flex h-full w-full max-w-sm flex-col items-center justify-center text-center">
        <div className="unlock-halo pointer-events-none absolute top-[36%] left-1/2 aspect-square w-[110%] -translate-x-1/2 -translate-y-1/2 rounded-full" aria-hidden />
        <div className="unlock-rays pointer-events-none absolute top-[36%] left-1/2 aspect-square w-[180%] -translate-x-1/2 -translate-y-1/2" aria-hidden />
        <div className="relative w-[58%] max-w-[240px] [perspective:900px]">
          <div className="unlock-flip">
            <BadgeMedallion badge={badge} className="block size-full" />
          </div>
        </div>
        <p className="unlock-up relative mt-4 text-[14px] font-bold" style={{ color: `var(--tier-${badge.tier}-text)`, animationDelay: '1.05s' }}>
          {TIER_LABEL[badge.tier]} badge unlocked
        </p>
        <h2 id="unlock-name" className="type-title-1 unlock-up relative mt-1.5 text-balance text-text-1" style={{ animationDelay: '1.15s' }}>
          {badge.title}
        </h2>
        <p id="unlock-meaning" className="type-body unlock-up relative mt-2 max-w-[28ch] text-text-2" style={{ animationDelay: '1.25s' }}>
          {badge.goal}.
        </p>
        {next ? (
          <div className="unlock-up relative mt-5 w-[80%] text-left" style={{ animationDelay: '1.35s' }}>
            <div className="type-footnote flex justify-between gap-3 text-text-2">
              <span className="min-w-0">{next.label}</span>
              {next.left ? <span className="tabular shrink-0">{next.left}</span> : null}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-track">
              <i className="unlock-fill block h-full rounded-full bg-lime" style={{ '--w': `${Math.round(next.frac * 100)}%` } as CSSProperties} />
            </div>
          </div>
        ) : null}
        <div className="unlock-up relative mt-8 grid w-full gap-2.5" style={{ animationDelay: '1.5s' }}>
          <PrimaryButton block icon={<Share aria-hidden />} onClick={() => onShare(badge)} data-unlock-share>
            Share as story card
          </PrimaryButton>
          <SecondaryButton
            ref={nice}
            block
            onClick={() => (more ? setI(i + 1) : onDone())}
            data-unlock-next
          >
            {more ? `Nice, next badge (${queue.length - i - 1} more)` : 'Nice'}
          </SecondaryButton>
        </div>
        <Confetti tier={badge.tier} run={i} />
      </div>
    </div>,
    document.body,
  );
}
