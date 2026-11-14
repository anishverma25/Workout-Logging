import { useEffect, useState } from 'react';
import { Quote, Star } from 'lucide-react';
import { averageRating, REVIEWS, SURVEY_RATINGS, type Review } from '@/app/marketing';
import { cn } from '@/lib/cn';

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts up to a number once, in about 0.9 s; shows it at once with reduced motion. */
function useCountUp(to: number, run: boolean, decimals = 1): string {
  const [value, setValue] = useState(() => (run && !reduceMotion() ? 0 : to));
  useEffect(() => {
    if (!run || reduceMotion()) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      // Ease out: quick at first, settling on the number like a dial.
      setValue(to * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, run]);
  return value.toFixed(decimals);
}

/** Five stars, filled to any fraction (4.9 fills the last one 90%). */
export function StarRow({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'size-6' : size === 'md' ? 'size-4' : 'size-3.5';
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
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

/** The person's initial in a soft coloured disc: no photos, first names only. */
function Initial({ name, tone }: { name: string; tone: 'lime' | 'gold' }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full font-display text-[0.95rem] font-bold',
        tone === 'lime' ? 'bg-lime-dim text-lime' : 'bg-gold-dim text-gold',
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** Average, stars and how the ratings spread, from the survey answers. */
export function RatingSummary({ active = true }: { active?: boolean }) {
  const avg = averageRating();
  const shown = useCountUp(avg, active);
  const counts = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    n: SURVEY_RATINGS.filter((r) => r === stars).length,
  }));
  const most = Math.max(...counts.map((c) => c.n), 1);
  return (
    <div
      className="review-hero relative isolate overflow-hidden rounded-panel bg-surface p-5"
      data-rating-summary
    >
      <div className="flex items-center gap-5">
        <div className="shrink-0 text-center">
          <p
            className="font-display text-[3.5rem] leading-none font-bold tracking-[-0.03em] text-text-1 tabular"
            aria-label={`${avg} out of 5`}
          >
            {shown}
          </p>
          <div className="mt-2">
            <StarRow value={avg} size="sm" />
          </div>
          <p className="type-caption mt-1.5 text-text-2">{SURVEY_RATINGS.length} ratings</p>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5" aria-label="How members rated it">
          {counts.map((c, i) => (
            <li key={c.stars} className="flex items-center gap-2">
              <span className="type-caption w-3 text-right text-text-2 tabular">{c.stars}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
                <span
                  className={cn('block h-full rounded-full bg-gold', active && 'review-bar')}
                  style={{ width: `${(c.n / most) * 100}%`, animationDelay: `${i * 70}ms` }}
                />
              </span>
              <span className="type-caption w-4 text-text-2 tabular">{c.n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** One member's words: the first is shown large, the rest as compact cards. */
export function ReviewCard({
  review,
  featured = false,
  index = 0,
}: {
  review: Review;
  featured?: boolean;
  index?: number;
}) {
  return (
    <figure
      className={cn(
        'pro-rise relative overflow-hidden rounded-panel bg-surface',
        featured ? 'p-5' : 'p-4',
      )}
      style={{ animationDelay: `${120 + index * 90}ms` }}
      data-review={review.name}
    >
      {featured ? (
        <Quote
          aria-hidden
          className="absolute -top-1 right-3 size-16 rotate-180 fill-lime/10 text-lime/10"
          strokeWidth={0}
        />
      ) : null}
      <blockquote
        className={cn('relative text-text-1', featured ? 'type-body' : 'type-subhead line-clamp-4')}
      >
        {review.quote}
      </blockquote>
      <figcaption className="mt-3.5 flex items-center gap-3">
        <Initial name={review.name} tone={index % 2 === 0 ? 'lime' : 'gold'} />
        <span className="min-w-0 flex-1">
          <span className="type-headline block text-text-1">{review.name}</span>
          <span className="type-caption block text-text-2">Macrotrophy member</span>
        </span>
        <StarRow value={review.rating} size="sm" />
      </figcaption>
    </figure>
  );
}

/** The tour's reviews page: the rating at a glance, then members in their own words. */
export function ReviewsShowcase({ active, count = 4 }: { active: boolean; count?: number }) {
  const [first, ...rest] = REVIEWS;
  if (!first) return null;
  return (
    // Keyed on being shown, so the count-up and the cards play when the page comes into view.
    <div key={active ? 'on' : 'off'} className="flex flex-col gap-3" data-tour-reviews>
      <RatingSummary active={active} />
      <ReviewCard review={first} featured />
      <div className="grid gap-3 sm:grid-cols-2">
        {rest.slice(0, count - 1).map((r, i) => (
          <ReviewCard key={r.name} review={r} index={i + 1} />
        ))}
      </div>
      <p className="type-caption text-center text-text-3">
        From our November member survey. First names only, nothing edited but spelling.
      </p>
    </div>
  );
}
