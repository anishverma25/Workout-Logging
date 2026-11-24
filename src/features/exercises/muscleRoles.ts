import { useEffect, useState } from 'react';
import { useProfile } from '@/data/hooks';
import type { ShareRole } from '@/domain/analytics/bodyMap';

/** Primary is full lime, secondary and minor lighter: the same shades as the muscle map. */
export const ROLE_FILL: Record<ShareRole, string> = {
  primary: 'var(--muscle-3)',
  secondary: 'var(--muscle-2)',
  minor: 'var(--muscle-1)',
};
export const ROLE_LABEL: Record<ShareRole, string> = {
  primary: 'Primary',
  secondary: 'Secondary',
  minor: 'Minor',
};

/** True on the frame after mount, so bars grow in once (CSS turns this off with reduced motion). */
export function useGrown() {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return grown;
}

export function useBodySex(): 'male' | 'female' {
  return useProfile().data?.sex === 'female' ? 'female' : 'male';
}
