import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Link, type LinkProps } from 'react-router';
import { buttonClasses, type ButtonStyleProps } from './buttonStyles';

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
  icon: ReactNode;
  size?: 'sm' | 'md';
  tone?: 'default' | 'danger' | 'accent';
}

/** Square icon-only button. The label is announced and shown as a tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = 'md', tone = 'default', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'pressable chrome inline-flex shrink-0 items-center justify-center rounded-full disabled:text-text-3',
        size === 'md' ? 'size-11' : 'size-9',
        tone === 'danger' ? 'text-danger hover:bg-surface-2' : 'text-text-1 hover:bg-surface-2',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
});
