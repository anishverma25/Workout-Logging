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
