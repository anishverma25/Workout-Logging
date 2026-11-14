import { useEffect, useState } from 'react';
import { Quote, Star } from 'lucide-react';
import { averageRating, REVIEWS, SURVEY_RATINGS, type Review } from '@/app/marketing';
import { cn } from '@/lib/cn';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** How long each quote stays before the next one. */
const QUOTE_MS = 5200;
/** Quotes short enough to read at a glance in the large size. */
const SPOTLIGHT = REVIEWS.filter((r) => r.quote.length <= 190).slice(0, 5);

/** Five stars, filled to any fraction (4.9 fills the last one 90%). */
export function StarRow({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'size-5' : size === 'md' ? 'size-4' : 'size-3.5';
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className={cn('relative inline-block', cls)} aria-hidden>
            <Star className={cn('absolute inset-0 fill-track text-track', cls)} strokeWidth={0} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className={cn('fill-gold text-gold', cls)} strokeWidth={0} />
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * One laurel branch: leaves in pairs along an arc, larger at the base. The right one is the
 * left mirrored, so together they frame the rating like an award.
 */
function Laurel({ side }: { side: 'left' | 'right' }) {
  // The stem is an arc of a circle centred to the right of the branch.
  const cx = 62;
  const cy = 46;
  const r = 44;
  const from = (150 * Math.PI) / 180;
  const to = (232 * Math.PI) / 180;
  const at = (a: number) => ({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) });
  const stemFrom = at(from);
  const stemTo = at(to);
  const leaves: { x: number; y: number; rot: number; s: number }[] = [];
  const count = 7;
  for (let i = 0; i < count; i++) {
    const a = to - ((to - from) * (i + 0.5)) / count;
    const p = at(a);
    // Tangent direction of the arc, pointing up the branch.
    const tangent = (-a * 180) / Math.PI - 90;
    const s = 1 - (i / count) * 0.45;
    leaves.push({ x: p.x, y: p.y, rot: tangent - 38, s });
    leaves.push({ x: p.x, y: p.y, rot: tangent + 38, s: s * 0.9 });
  }
  return (
    <svg
      viewBox="-6 -4 50 100"
      className={cn('h-24 w-12 shrink-0 text-gold', side === 'right' && '-scale-x-100')}
      aria-hidden
    >
      <path
        d={`M ${stemFrom.x} ${stemFrom.y} A ${r} ${r} 0 0 0 ${stemTo.x} ${stemTo.y}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.7"
        transform="translate(0 0)"
      />
      {leaves.map((l, i) => (
        <path
          key={i}
          d="M0 0 C 3.2 -3, 3.2 -9, 0 -12 C -3.2 -9, -3.2 -3, 0 0 Z"
          transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.s * 1.45})`}
          fill="currentColor"
          opacity={0.6 + 0.4 * l.s}
        />
      ))}
    </svg>
  );
}

/** The award-style rating: the average between two laurels, the stars, and how many rated. */
export function RatingLaurel({ active = true }: { active?: boolean }) {
  const avg = averageRating();
  const fives = SURVEY_RATINGS.filter((r) => r === 5).length;
  return (
    <div
      className={cn('flex flex-col items-center text-center', active && 'laurel-in')}
      data-rating-summary
    >
      <div className="flex items-center gap-2">
        <Laurel side="left" />
        <div>
          <p
            className="font-display text-[3.75rem] leading-none font-bold tracking-[-0.04em] text-text-1 tabular"
            aria-label={`${avg} out of 5`}
          >
            {avg}
          </p>
          <div className="mt-2 flex justify-center">
            <StarRow value={avg} size="md" />
          </div>
        </div>
        <Laurel side="right" />
      </div>
      <p className="type-caption mt-3 font-semibold tracking-[0.02em] text-text-1">
        {SURVEY_RATINGS.length} member ratings · {fives} gave five stars
      </p>
    </div>
  );
}

/**
 * One member's words at a time, large, the way a magazine pulls a quote. It moves on by itself
 * with a story-style bar for each quote, and a tap shows the next. Still with reduced motion
 * (tap to move on), and paused while the page is not on screen.
 */
export function QuoteSpotlight({
  active,
  reviews = SPOTLIGHT,
}: {
  active: boolean;
  reviews?: Review[];
}) {
  const [at, setAt] = useState(0);
  const still = reduceMotion();
  useEffect(() => {
    if (!active || still || reviews.length < 2) return;
    const t = window.setTimeout(() => setAt((i) => (i + 1) % reviews.length), QUOTE_MS);
    return () => window.clearTimeout(t);
  }, [active, at, still, reviews.length]);
  const r = reviews[at];
  if (!r) return null;
  return (
    <figure
      className="quote-spot relative isolate overflow-hidden rounded-panel px-6 pt-5 pb-6"
      data-tour-quote
    >
      <div className="flex gap-1.5" aria-hidden>
        {reviews.map((q, i) => (
          <span key={q.name} className="h-[3px] flex-1 overflow-hidden rounded-full bg-text-1/15">
            <span
              key={i === at ? `run-${at}` : 'idle'}
              className={cn(
                'block h-full rounded-full bg-text-1',
                i < at && 'w-full',
                i > at && 'w-0',
                i === at && (active && !still ? 'quote-run' : 'w-full'),
              )}
              style={i === at ? { animationDuration: `${QUOTE_MS}ms` } : undefined}
            />
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setAt((i) => (i + 1) % reviews.length)}
        className="mt-6 block min-h-[16.5rem] w-full text-left outline-none"
        aria-label="Show another review"
      >
        <span key={at} className="quote-in block">
          <Quote aria-hidden className="size-8 rotate-180 fill-gold text-gold" strokeWidth={0} />
          <blockquote className="mt-2 font-display text-[1.375rem] leading-[1.3] font-semibold tracking-[-0.015em] text-text-1 [text-wrap:pretty]">
            {r.quote}
          </blockquote>
          <figcaption className="mt-5 flex items-center justify-between gap-3">
            <span className="type-headline text-text-1">{r.name}</span>
            <StarRow value={r.rating} size="sm" />
          </figcaption>
        </span>
      </button>
    </figure>
  );
}

/** The tour's reviews page: the rating as an award, then members in their own words. */
export function ReviewsShowcase({ active }: { active: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-7" data-tour-reviews>
      <RatingLaurel active={active} />
      <QuoteSpotlight active={active} />
      <p className="type-caption mt-auto text-center text-text-3">
        From our November member survey. First names only, nothing edited but spelling.
      </p>
    </div>
  );
}
