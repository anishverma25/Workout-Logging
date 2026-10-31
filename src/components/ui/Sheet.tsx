import type { ReactNode } from 'react';
import { BottomSheet, ConfirmSheet as KitConfirmSheet } from '@/components/kit';

/*
 * The original sheet API, kept so existing screens need no changes, drawn by the kit's
 * BottomSheet and ConfirmSheet (UI Part 9 sheet audit): every sheet, menu and confirm in the
 * app is one of the kit's overlays.
 */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Short line under the title. */
  description?: ReactNode;
  children: ReactNode;
  /** Sticky action row at the bottom (save, delete...). */
  footer?: ReactNode;
  /** Wider sheet on desktop, for pickers and forms with columns. */
  size?: 'md' | 'lg';
  className?: string;
}

export function Sheet({ description, size = 'md', className, ...props }: SheetProps) {
  return (
    <BottomSheet {...props} subtitle={description} wide={size === 'lg'} className={className} />
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive confirm button. */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmSheet({ danger, ...props }: ConfirmProps) {
  return <KitConfirmSheet {...props} destructive={danger} />;
}
