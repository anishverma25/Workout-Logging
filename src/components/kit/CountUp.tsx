import { useEffect, useState } from 'react';
import { firstPlay } from '@/components/charts/motion';

/**
 * A hero number that counts up once per session over 400 ms (D11). Digits stay tabular while
 * counting so the width never jitters; at rest the number takes the surrounding style. Text that
 * is not a plain number ("None yet", "6 to 8") is shown as it is.
 */
export function CountUp({ value, playKey }: { value: string; playKey: string }) {
  const parsed = /^\d{1,3}(,\d{3})*(\.\d+)?$|^\d+(\.\d+)?$/.test(value)
    ? Number(value.replace(/,/g, ''))
    : null;
  const decimals = value.includes('.') ? value.split('.')[1]!.length : 0;
  const [animate] = useState(() => parsed !== null && parsed > 0 && firstPlay(`count:${playKey}`));
  const [shown, setShown] = useState<number | null>(animate ? 0 : null);

  useEffect(() => {
    if (!animate || parsed === null) return;
    const start = performance.now();
    let frame = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 400);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p >= 1 ? null : parsed * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [animate, parsed]);

  if (shown === null) return <>{value}</>;
  return (
    <span className="tabular">
      {shown.toLocaleString('en-GB', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </span>
  );
}
