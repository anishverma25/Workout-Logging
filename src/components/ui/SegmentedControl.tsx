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
      className="chrome inline-flex gap-0.5 rounded-[0.5625rem] bg-fill p-0.5"
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
              'type-meta tabular h-7 min-w-14 rounded-[0.4375rem] px-4 font-semibold transition-colors duration-[var(--dur-press)]',
              // UI v3 (G7): the iOS segmented control.
              selected
                ? 'bg-seg-selected text-text-1 shadow-[0_1px_3px_rgb(0_0_0/0.3)]'
                : 'text-text-1',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
