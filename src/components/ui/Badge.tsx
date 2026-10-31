import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'warn' | 'danger';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-text-2',
  accent: 'bg-lime-dim text-text-1',
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
        'chrome type-caption inline-flex h-6 items-center gap-1 rounded-full px-2.5 font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
