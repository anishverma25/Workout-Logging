import type { ReactElement } from 'react';

/*
 * The five primary navigation icons, drawn as outline and filled pairs (lucide has no filled
 * variants). 24px grid, 1.75 stroke on every outline, so the set reads as one family.
 * Filled shapes cut their details out in --bar, the colour behind the tab bar and sidebar.
 */

interface TabIconProps {
  filled?: boolean;
  className?: string;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const cut = {
  fill: 'none',
  stroke: 'var(--bar)',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function Svg({
  className,
  children,
}: {
  className?: string;
  children: ReactElement[] | ReactElement;
}) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden className={className}>
      {children}
    </svg>
  );
}

export function HomeIcon({ filled, className }: TabIconProps) {
  const d = 'M3.5 10.4 12 3.6l8.5 6.8V19a1.6 1.6 0 0 1-1.6 1.6H15v-6H9v6H5.1A1.6 1.6 0 0 1 3.5 19z';
  return (
    <Svg className={className}>
      <path d={d} {...stroke} fill={filled ? 'currentColor' : 'none'} />
    </Svg>
  );
}

export function RoutinesIcon({ filled, className }: TabIconProps) {
  return filled ? (
    <Svg className={className}>
      <rect
        x="3.5"
        y="5"
        width="17"
        height="15.5"
        rx="2.6"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.75}
      />
      <path d="M3.5 9.6h17" {...cut} />
      <path d="M8 3v4M16 3v4" {...stroke} />
      <path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01" {...cut} strokeWidth={2.4} />
    </Svg>
  ) : (
    <Svg className={className}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.6" {...stroke} />
      <path d="M3.5 9.6h17M8 3v4M16 3v4" {...stroke} />
      <path
        d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01"
        {...stroke}
        strokeWidth={2.4}
      />
    </Svg>
  );
}

export function WorkoutIcon({ filled, className }: TabIconProps) {
  const fill = filled ? 'currentColor' : 'none';
  return (
    <Svg className={className}>
      <rect x="2.5" y="9" width="3" height="6" rx="1" {...stroke} fill={fill} />
      <rect x="5.5" y="6.5" width="3" height="11" rx="1" {...stroke} fill={fill} />
      <path d="M8.5 12h7" {...stroke} />
      <rect x="15.5" y="6.5" width="3" height="11" rx="1" {...stroke} fill={fill} />
      <rect x="18.5" y="9" width="3" height="6" rx="1" {...stroke} fill={fill} />
    </Svg>
  );
}

export function ProgressIcon({ filled, className }: TabIconProps) {
  const fill = filled ? 'currentColor' : 'none';
  return (
    <Svg className={className}>
      <rect x="4" y="12.5" width="4" height="8" rx="1.2" {...stroke} fill={fill} />
      <rect x="10" y="8" width="4" height="12.5" rx="1.2" {...stroke} fill={fill} />
      <rect x="16" y="3.5" width="4" height="17" rx="1.2" {...stroke} fill={fill} />
    </Svg>
  );
}

export function HistoryIcon({ filled, className }: TabIconProps) {
  return filled ? (
    <Svg className={className}>
      <circle
        cx="12"
        cy="12"
        r="8.6"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.75}
      />
      <path d="M12 7.6V12l3 2" {...cut} />
    </Svg>
  ) : (
    <Svg className={className}>
      <path d="M3.6 12a8.4 8.4 0 1 0 2.46-5.94" {...stroke} />
      <path d="M3.6 3.8v4.4H8" {...stroke} />
      <path d="M12 7.6V12l3 2" {...stroke} />
    </Svg>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const TAB_ICONS = {
  '/': HomeIcon,
  '/routines': RoutinesIcon,
  '/workout': WorkoutIcon,
  '/progress': ProgressIcon,
  '/history': HistoryIcon,
} as const;
