import { Dumbbell, Salad, Sparkles, Trophy, type LucideIcon } from 'lucide-react';
import { BrandMark } from '@/app/layout/BrandMark';
import { cn } from '@/lib/cn';

const CHIPS: { icon: LucideIcon; label: string; place: string; delay: string }[] = [
  { icon: Dumbbell, label: 'Workouts', place: 'left-[6%] top-[14%]', delay: '0s' },
  { icon: Salad, label: 'Indian food', place: 'right-[5%] top-[22%]', delay: '-1.6s' },
  { icon: Sparkles, label: 'Macrotrophy AI', place: 'left-[9%] bottom-[14%]', delay: '-3.1s' },
  { icon: Trophy, label: 'Leaderboards', place: 'right-[8%] bottom-[10%]', delay: '-4.4s' },
];

/**
 * The picture on sign-up and sign-in: the mark in a soft lime light, with what the app does
 * floating around it. Decorative only; it drifts slowly and stays still with reduced motion.
 */
export function AuthArt({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative isolate h-52 overflow-hidden rounded-panel bg-surface lg:h-full lg:min-h-[32rem]',
        className,
      )}
      data-auth-art
    >
      <div className="auth-art-glow absolute inset-0 -z-10" />
      <div className="auth-art-rings absolute top-1/2 left-1/2 size-56 -translate-x-1/2 -translate-y-1/2 lg:size-80" />
      <div className="absolute top-1/2 left-1/2 flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.6rem] bg-bg shadow-[0_0_60px_-10px_var(--lime)] lg:size-28">
        <BrandMark className="size-12 lg:size-16" />
      </div>
      {CHIPS.map(({ icon: Icon, label, place, delay }) => (
        <span
          key={label}
          className={cn(
            'auth-art-chip type-caption absolute flex items-center gap-1.5 rounded-full bg-surface-2/90 px-3 py-1.5 font-semibold text-text-1 backdrop-blur',
            place,
          )}
          style={{ animationDelay: delay }}
        >
          <Icon className="size-3.5 text-lime" />
          {label}
        </span>
      ))}
    </div>
  );
}
