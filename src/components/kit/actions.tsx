import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronRight, ExternalLink, Info } from 'lucide-react';
import { cn } from '@/lib/cn';

/** 16px inline spinner in the label's own colour, for buttons that submit (UI Part 8). */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent',
        className,
      )}
    />
  );
}

type ButtonTone = 'primary' | 'secondary' | 'destructive';

interface KitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 52 high by default; compact is 44. */
  compact?: boolean;
  /** Stretch to the container width. */
  block?: boolean;
  /** Shows a spinner and blocks repeat presses while an action runs. */
  loading?: boolean;
  /** Leading icon, 20px. */
  icon?: ReactNode;
}

const toneClass: Record<ButtonTone, string> = {
  primary: 'bg-lime text-on-lime',
  secondary: 'bg-surface-2 text-text-1',
  destructive: 'bg-surface-2 text-danger-text',
};

const BaseButton = forwardRef<HTMLButtonElement, KitButtonProps & { tone: ButtonTone }>(
  function BaseButton(
    {
      tone,
      compact,
      block,
      loading,
      icon,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref,
  ) {
    const inactive = disabled || loading;
    return (
      <button
        ref={ref}
        type={type}
        disabled={inactive}
        aria-busy={loading || undefined}
        className={cn(
          'pressable chrome type-headline inline-flex shrink-0 items-center justify-center gap-2 px-5 whitespace-nowrap',
          compact ? 'h-11 rounded-field' : 'h-13 rounded-nested',
          block && 'w-full',
          // Disabled reads as inactive surface with a muted label, never a faded lime.
          disabled && !loading ? 'bg-surface-2 text-text-3' : toneClass[tone],
          loading && 'cursor-progress',
          className,
        )}
        {...props}
      >
        {loading ? (
          <Spinner />
        ) : icon ? (
          <span className="inline-flex size-5 [&>svg]:size-5">{icon}</span>
        ) : null}
        {children}
      </button>
    );
  },
);

/** The lime action. At most one visible per screen region. */
export const PrimaryButton = forwardRef<HTMLButtonElement, KitButtonProps>(
  function PrimaryButton(props, ref) {
    return <BaseButton ref={ref} tone="primary" {...props} />;
  },
);

/** Neutral action on surface-2. */
export const SecondaryButton = forwardRef<HTMLButtonElement, KitButtonProps>(
  function SecondaryButton(props, ref) {
    return <BaseButton ref={ref} tone="secondary" {...props} />;
  },
);

/** Destructive action: danger text on surface-2. Always confirmed with a ConfirmSheet. */
export const DestructiveButton = forwardRef<HTMLButtonElement, KitButtonProps>(
  function DestructiveButton(props, ref) {
    return <BaseButton ref={ref} tone="destructive" {...props} />;
  },
);

interface TextLinkProps {
  children: ReactNode;
  /** In-app route. */
  to?: string;
  /** External address; opens in a new tab with an external icon. */
  href?: string;
  onClick?: () => void;
  /** Adds a chevron, for links that navigate. */
  chevron?: boolean;
  /** Leading icon, 16px. */
  icon?: ReactNode;
  /** Meta size instead of Body. */
  small?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Neutral text link in --text-1. Never lime. Touch area at least 44px. */
export function TextLink({
  children,
  to,
  href,
  onClick,
  chevron,
  icon,
  small,
  className,
  ...aria
}: TextLinkProps) {
  const cls = cn(
    'pressable tap-target inline-flex items-center gap-1 rounded-tile font-medium text-text-1 hover:underline underline-offset-4',
    small ? 'type-meta font-medium' : 'type-body font-medium',
    className,
  );
  const inner = (
    <>
      {icon ? <span className="inline-flex size-4 [&>svg]:size-4">{icon}</span> : null}
      {children}
      {chevron ? <ChevronRight className="size-4 text-text-2" aria-hidden /> : null}
      {href ? (
        <>
          <ExternalLink className="size-3.5 text-text-2" aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </>
      ) : null}
    </>
  );
  if (to) {
    return (
      <Link to={to} onClick={onClick} className={cls} {...aria}>
        {inner}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer noopener" className={cls} {...aria}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} {...aria}>
      {inner}
    </button>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Required: icon buttons have no visible text. */
  label: string;
  icon: ReactNode;
  /** 40 by default; 32 for sheet close buttons (hit area stays 44). 48 for steppers. */
  size?: 32 | 40 | 48;
}

/** Neutral circular icon button on surface-2. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 40, className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'pressable chrome tap-target inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-1 disabled:text-text-3',
        size === 32 && 'size-8 [&_svg]:size-4',
        size === 40 && 'size-10 [&_svg]:size-5',
        size === 48 && 'size-12 [&_svg]:size-5',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});

/** 24px neutral info button beside a section title. Opens that section's explanation. */
export function InfoButton({
  label,
  onClick,
  className,
}: {
  /** What it explains, read as "About {label}". */
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`About ${label}`}
      className={cn(
        'pressable chrome tap-target inline-flex size-6 shrink-0 items-center justify-center rounded-full text-text-2 hover:text-text-1',
        className,
      )}
    >
      <Info className="size-5" strokeWidth={1.75} aria-hidden />
    </button>
  );
}
