import { cn } from '@/lib/cn';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="chrome inline-flex gap-0.5 rounded-full bg-surface-2 p-0.5"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'type-meta tabular h-8 min-w-14 rounded-full px-4 font-semibold transition-colors duration-[var(--dur-press)]',
              selected ? 'bg-text-1 text-bg' : 'text-text-1',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
