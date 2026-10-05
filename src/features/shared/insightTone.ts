import { CircleAlert, Info, TrendingUp } from 'lucide-react';

/** Icon and colour for each insight tone. Colour is never the only signal: each has its own icon. */
export const INSIGHT_TONE = {
  positive: { icon: TrendingUp, ring: 'bg-accent-soft text-accent-text', label: 'Positive' },
  attention: { icon: CircleAlert, ring: 'bg-warn-soft text-warn', label: 'Worth a look' },
  neutral: { icon: Info, ring: 'bg-surface-3 text-muted', label: 'Note' },
} as const;
