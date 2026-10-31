import { cn } from '@/lib/cn';

/** Up to two initials from a name: "Anish Verma" is "AV". */
function initialsOf(name: string | null | undefined): string {
  return (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

const SIZE = {
  36: 'size-9 text-[0.875rem]',
  56: 'size-14 text-[1.0625rem]',
  80: 'size-20 text-[1.75rem]',
} as const;

/**
 * The person's photo in a circle, or their initials when they have not chosen one. Decorative:
 * the name is always written next to it, or the link around it is labelled.
 */
export function ProfileAvatar({
  name,
  avatar,
  size,
  fallback,
  className,
}: {
  name: string | null | undefined;
  avatar: string | null | undefined;
  size: keyof typeof SIZE;
  /** Shown when there is neither a photo nor a name. */
  fallback?: React.ReactNode;
  className?: string;
}) {
  const initials = initialsOf(name);
  return (
    <span
      aria-hidden
      data-avatar={avatar ? 'photo' : 'initials'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-fill font-semibold text-text-1',
        SIZE[size],
        className,
      )}
    >
      {avatar ? (
        <img
          src={avatar}
          alt=""
          className="size-full object-cover"
          draggable={false}
          decoding="async"
        />
      ) : (
        initials || fallback || '?'
      )}
    </span>
  );
}
