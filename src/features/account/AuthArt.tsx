import { Star } from 'lucide-react';
import { averageRating } from '@/app/marketing';
import { cn } from '@/lib/cn';

/** Real screens from the app (the same ones as the home page), drawn in phone frames. */
const SCREENS = [
  {
    key: 'logger',
    src: '/landing/screen-logger',
    place: 'auth-phone-left',
    alt: 'The workout logger with last time beside each set',
  },
  {
    key: 'food',
    src: '/landing/screen-food',
    place: 'auth-phone-right',
    alt: 'The food screen with calories and macros for the day',
  },
  {
    key: 'home',
    src: '/landing/screen-home',
    place: 'auth-phone-center',
    alt: 'The home screen with today’s workout and the week in rings',
  },
] as const;

/**
 * The picture on sign-up and sign-in: three real screens of the app, fanned out in a soft lime
 * light, so the first thing a new person sees is what they are signing up for. On phones the
 * frames rise from the bottom edge; on wide screens they stand in the panel beside the form.
 * Decorative: the screens carry no information the page needs, so they are hidden from
 * assistive technology. They drift a little and stay still with reduced motion.
 */
export function AuthArt({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'auth-art relative isolate overflow-hidden rounded-panel bg-surface',
        'h-60 sm:h-72 lg:h-full lg:min-h-[36rem]',
        className,
      )}
      data-auth-art
    >
      <div className="auth-art-glow absolute inset-0 -z-10" />
      <div className="auth-art-grid absolute inset-0 -z-10" />
      {SCREENS.map((s) => (
        <div key={s.key} className={cn('auth-phone', s.place)}>
          <img
            src={`${s.src}-390.webp`}
            srcSet={`${s.src}-390.webp 390w, ${s.src}-780.webp 780w`}
            sizes="(min-width: 64rem) 240px, 160px"
            width={390}
            height={794}
            alt=""
            decoding="async"
            className="block h-full w-full object-cover object-top"
          />
        </div>
      ))}
      {/* Phones fade into the panel at the bottom edge, like a product shot. */}
      <div className="auth-art-fade pointer-events-none absolute inset-x-0 bottom-0 h-16 lg:h-28" />
      <span className="auth-art-chip auth-chip-rating type-caption absolute flex items-center gap-1.5 rounded-full bg-surface-2/90 px-3 py-1.5 font-semibold text-text-1 backdrop-blur">
        <Star className="size-3.5 fill-gold text-gold" strokeWidth={0} />
        {averageRating()} from members
      </span>
      <span className="auth-art-chip auth-chip-made type-caption absolute hidden items-center gap-1.5 rounded-full bg-surface-2/90 px-3 py-1.5 font-semibold text-text-1 backdrop-blur lg:flex">
        <span className="size-1.5 rounded-full bg-lime" />
        Workouts and Indian food in one app
      </span>
    </div>
  );
}
