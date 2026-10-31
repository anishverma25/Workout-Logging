import { cn } from '@/lib/cn';

/** The gold medal: a ribbon and a disc with a star. Decorative unless given a label. */
export function MedalIcon({ className, label }: { className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d="M7 2h4l2 6H9z" fill="var(--gold)" opacity="0.65" />
      <path d="M17 2h-4l-2 6h4z" fill="var(--gold)" opacity="0.85" />
      <circle cx="12" cy="15" r="7" fill="var(--gold)" />
      <path
        d="M12 11.2l1.1 2.3 2.5.3-1.8 1.7.5 2.5L12 16.8l-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z"
        fill="var(--on-gold)"
      />
    </svg>
  );
}
