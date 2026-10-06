import { cn } from '@/lib/cn';

export type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold select-none transition-[transform,background-color,border-color,color,opacity] duration-150 ease-[var(--ease-snap)] active:scale-[0.97] disabled:opacity-45 disabled:active:scale-100';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-[1.04]',
  secondary: 'bg-surface-2 text-text hover:bg-surface-3',
  ghost: 'text-accent-text hover:bg-accent-soft',
  danger: 'bg-danger-soft text-danger hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm rounded-full',
  md: 'h-11 px-5 text-[0.95rem] rounded-full',
  lg: 'h-[3.25rem] px-6 text-[1.05rem] rounded-full',
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
