import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

interface ScreenProps {
  children: ReactNode;
  /** Max content width on desktop: 720 for lists, forms and settings; 1120 for grids. */
  width?: 'list' | 'grid';
  className?: string;
}

/**
 * Page content column. Margins 16 below 600px, 24 to 1023px, 32 from 1024px (UI rules 3.4).
 * Header to first card 24, sections 32 apart.
 */
export function Screen({ children, width = 'list', className }: ScreenProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 pb-8 tab:px-6 lg:px-8',
        // Content width plus the side margins at each breakpoint.
        width === 'list'
          ? 'max-w-[calc(45rem+2rem)] tab:max-w-[calc(45rem+3rem)] lg:max-w-[calc(45rem+4rem)]'
          : 'max-w-[calc(70rem+2rem)] tab:max-w-[calc(70rem+3rem)] lg:max-w-[calc(70rem+4rem)]',
        className,
      )}
    >
      {children}
    </div>
  );
}

interface LargeTitleHeaderProps {
  title: string;
  /** One short factual line, Body --text-2. */
  subtitle?: ReactNode;
  /** Meta line above the title (the date on Home). */
  eyebrow?: ReactNode;
  /** Right side: the avatar on top-level tabs. */
  trailing?: ReactNode;
}

/**
 * Header for top-level tabs. The Display title scrolls away and a centred 17px title fades into
 * a compact bar. The bar blurs the content under it, never its own text.
 */
export function LargeTitleHeader({ title, subtitle, eyebrow, trailing }: LargeTitleHeaderProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => setCollapsed(!(entries[0]?.isIntersecting ?? true)),
      {
        threshold: 0,
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        aria-hidden={!collapsed}
        className={cn(
          'chrome pointer-events-none fixed inset-x-0 top-0 z-30 flex h-[calc(2.75rem+env(safe-area-inset-top))] items-end justify-center border-b pt-safe pb-2.5 transition-opacity duration-[var(--dur-move)] lg:left-60',
          collapsed
            ? 'border-divider bg-bg/80 opacity-100 backdrop-blur-xl'
            : 'border-transparent opacity-0',
        )}
      >
        <span className="type-headline truncate px-16 text-text-1">{title}</span>
      </div>
      <header className="chrome flex items-end justify-between gap-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-6 lg:pt-8">
        <div className="min-w-0">
          {eyebrow ? <p className="type-meta mb-1 text-text-2">{eyebrow}</p> : null}
          <h1 className="type-display text-text-1">{title}</h1>
          {subtitle ? (
            <p className="type-body mt-1 truncate text-text-2 [text-wrap:balance]">{subtitle}</p>
          ) : null}
          <div ref={sentinel} aria-hidden className="h-px" />
        </div>
        {trailing ? <div className="shrink-0 pb-1">{trailing}</div> : null}
      </header>
    </>
  );
}

interface PushedHeaderProps {
  /** The parent screen's name, shown beside the back chevron. */
  backLabel: string;
  /** Route to go back to. Use onBack instead for history-based back. */
  backTo?: string;
  onBack?: () => void;
  /** Screen title under the back row. */
  title?: string;
  subtitle?: ReactNode;
  trailing?: ReactNode;
}

/** Header for pushed screens: back chevron with the parent's name, no avatar. */
export function PushedHeader({
  backLabel,
  backTo,
  onBack,
  title,
  subtitle,
  trailing,
}: PushedHeaderProps) {
  const backCls =
    'pressable chrome tap-target -ml-2 inline-flex h-11 items-center gap-0.5 rounded-field pr-2 type-body font-medium text-text-1';
  const back = (
    <>
      <ChevronLeft className="size-6" strokeWidth={1.75} aria-hidden />
      {backLabel}
    </>
  );
  return (
    <header className="chrome pt-[calc(0.25rem+env(safe-area-inset-top))] pb-6 lg:pt-6">
      <div className="flex h-11 items-center justify-between gap-3">
        {backTo ? (
          <Link to={backTo} className={backCls} aria-label={`Back to ${backLabel}`}>
            {back}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onBack}
            className={backCls}
            aria-label={`Back to ${backLabel}`}
          >
            {back}
          </button>
        )}
        {trailing}
      </div>
      {title ? <h1 className="type-display mt-2 text-text-1">{title}</h1> : null}
      {subtitle ? (
        <p className="type-body mt-1 text-text-2 [text-wrap:balance]">{subtitle}</p>
      ) : null}
    </header>
  );
}

interface CardProps {
  children: ReactNode;
  as?: ElementType;
  /** Removes the 20px padding (for cards that hold full-width rows). */
  flush?: boolean;
  /** 1px --border-strong, for the active exercise. */
  emphasis?: boolean;
  className?: string;
  'aria-labelledby'?: string;
  id?: string;
}

/** Surface card: radius 24, 1px border, padding 20, no shadow. */
export function Card({ children, as: As = 'div', flush, emphasis, className, ...rest }: CardProps) {
  return (
    <As
      className={cn(
        'rounded-panel border bg-surface',
        emphasis ? 'border-border-strong' : 'border-border',
        !flush && 'p-5',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  );
}

interface SectionHeaderProps {
  title: string;
  id?: string;
  /** Meta line under the title, max two lines. */
  description?: ReactNode;
  /** InfoButton, TextLink or both, on the right. */
  info?: ReactNode;
  action?: ReactNode;
  /** h2 by default. */
  level?: 2 | 3;
  className?: string;
}

/** Section title (Title style) with an optional info button and link on the right. */
export function SectionHeader({
  title,
  id,
  description,
  info,
  action,
  level = 2,
  className,
}: SectionHeaderProps) {
  const H = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <H id={id} className="type-title text-text-1">
            {title}
          </H>
          {info}
        </div>
        {description ? (
          <p className="type-meta mt-0.5 line-clamp-2 text-text-2">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 pt-0.5">{action}</div> : null}
    </div>
  );
}
