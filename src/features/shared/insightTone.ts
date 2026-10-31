import { CircleAlert, Info, TrendingUp } from 'lucide-react';

/**
 * Icon for each insight tone, on a neutral tile. Colour is never the only signal: each tone has
 * its own icon. Only real warnings use --warning.
 */
export const INSIGHT_TONE = {
  positive: { icon: TrendingUp, ring: 'bg-surface-2 text-text-2', label: 'Positive' },
  attention: { icon: CircleAlert, ring: 'bg-surface-2 text-warning', label: 'Worth a look' },
  neutral: { icon: Info, ring: 'bg-surface-2 text-text-2', label: 'Note' },
} as const;
