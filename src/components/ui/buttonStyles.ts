import { cn } from '@/lib/cn';

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type Size = 'sm' | 'md' | 'lg';

/*
 * Legacy button API, drawn in the kit style (UI rules 3.3 and 3.4): lime only for the primary
 * action, neutral surface-2 for the rest, danger text on surface-2, press = opacity and scale.
 * Disabled reads as surface-2 with a muted label, never a faded lime.
 */
const base =
  'pressable chrome inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap disabled:bg-surface-2 disabled:text-text-3';

const variants: Record<Variant, string> = {
  primary: 'bg-lime text-on-lime',
  secondary: 'bg-surface-2 text-text-1',
  ghost: 'text-text-1 hover:bg-surface-2',
  danger: 'bg-surface-2 text-danger-text',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 type-meta font-semibold rounded-full',
  md: 'h-11 px-5 type-headline rounded-field',
  lg: 'h-13 px-6 type-headline rounded-nested',
};

export interface ButtonStyleProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
}

export function buttonClasses(
  { variant = 'primary', size = 'md', block }: ButtonStyleProps,
  className?: string,
) {
  return cn(base, variants[variant], sizes[size], block && 'w-full', className);
}
