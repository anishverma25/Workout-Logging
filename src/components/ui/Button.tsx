import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold select-none transition-[transform,background-color,border-color,color,opacity] duration-150 ease-[var(--ease-snap)] active:scale-[0.97] disabled:opacity-45 disabled:active:scale-100';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-[1.04]',
  secondary: 'bg-surface-2 text-text border border-line hover:border-line-strong',
  ghost: 'text-muted hover:text-text hover:bg-surface-2',
  danger: 'bg-danger-soft text-danger hover:brightness-110',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-[0.75rem]',
  md: 'h-11 px-4 text-[0.95rem] rounded-[var(--radius-control)]',
  lg: 'h-14 px-6 text-[1.05rem] rounded-[1rem]',
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

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleProps {
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, icon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, block }, className)}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps, ButtonStyleProps {
  icon?: ReactNode;
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link className={buttonClasses({ variant, size, block }, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({
  label,
  className,
  children,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text active:scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
