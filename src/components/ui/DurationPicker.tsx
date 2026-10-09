import { WheelPicker } from './WheelPicker';

const MINUTES = Array.from({ length: 16 }, (_, i) => i); // 0 to 15
const SECONDS = Array.from({ length: 60 }, (_, i) => i); // 0 to 59, every second

/**
 * Minutes and seconds as two scroll wheels, like the iOS timer: any length to the second.
 * `min` keeps the result at or above a floor (the server allows 15 s for the default rest).
 */
export function DurationPicker({
  label,
  value,
  onChange,
  min = 0,
  max = 900,
}: {
  label: string;
  value: number;
  onChange: (seconds: number) => void;
  min?: number;
  max?: number;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-1">
      <WheelPicker
        label={`${label}, minutes`}
        values={MINUTES.filter((m) => m * 60 <= max)}
        value={minutes}
        onChange={(m) => onChange(clamp(m * 60 + seconds))}
        unit="min"
        valueText={(m) => `${m} ${m === 1 ? 'minute' : 'minutes'}`}
      />
      <WheelPicker
        label={`${label}, seconds`}
        values={SECONDS}
        value={seconds}
        onChange={(s) => onChange(clamp(minutes * 60 + s))}
        unit="sec"
        format={(s) => String(s).padStart(2, '0')}
        valueText={(s) => `${s} seconds`}
      />
    </div>
  );
}
