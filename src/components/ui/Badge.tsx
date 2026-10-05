import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'warn' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-muted border border-line',
  accent: 'bg-accent-soft text-accent-text',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold leading-none',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
