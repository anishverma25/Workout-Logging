import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface LegendItem {
  label: string;
  color: string;
  shape: 'line' | 'dot' | 'bar';
}

/** Present for two or more series, so identity never depends on colour alone. */
export function Legend({ items, className }: { items: LegendItem[]; className?: string }) {
  if (items.length < 2) return null;
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <svg width="16" height="10" aria-hidden className="shrink-0">
            {item.shape === 'line' ? (
              <line
                x1="1"
                x2="15"
                y1="5"
                y2="5"
                stroke={item.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
            ) : item.shape === 'dot' ? (
              <circle cx="8" cy="5" r="4" fill={item.color} />
            ) : (
              <rect x="2" y="0" width="12" height="10" rx="2" fill={item.color} />
            )}
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** Every value in the chart, reachable without hovering. */
export function ChartTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center rounded-md text-xs font-medium text-faint hover:text-text [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Show as table</span>
        <span className="hidden group-open:inline">Hide table</span>
      </summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-line">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface-2 text-xs text-faint">
            <tr>
              {columns.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="tabular divide-y divide-line">
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((cell, j) => (
                  <td key={j} className={cn('px-3 py-1.5', j > 0 && 'text-muted')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Floating readout. Values lead; series names follow, keyed by a short line of the series colour. */
export function Tooltip({
  x,
  y,
  width,
  title,
  rows,
}: {
  x: number;
  y: number;
  width: number;
  title: string;
  rows: { label: string; value: string; color: string; shape?: 'line' | 'dot' | 'bar' }[];
}) {
  const left = Math.min(Math.max(8, x - 80), Math.max(8, width - 168));
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 w-40 rounded-xl border border-line-strong bg-surface-3 px-3 py-2 shadow-[0_10px_30px_-12px_rgb(0_0_0/0.55)]"
      style={{ left, top: Math.max(0, y) }}
    >
      <p className="text-xs text-faint">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="mt-0.5 flex items-center gap-2">
          <svg width="12" height="8" aria-hidden className="shrink-0">
            {r.shape === 'dot' ? (
              <circle cx="6" cy="4" r="3.5" fill={r.color} />
            ) : r.shape === 'bar' ? (
              <rect x="1" y="0" width="10" height="8" rx="2" fill={r.color} />
            ) : (
              <line
                x1="1"
                x2="11"
                y1="4"
                y2="4"
                stroke={r.color}
                strokeWidth="2"
                strokeLinecap="round"
              />
            )}
          </svg>
          <span className="tabular font-semibold text-text">{r.value}</span>
          <span className="truncate text-xs text-muted">{r.label}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartEmpty({ children, height }: { children: ReactNode; height: number }) {
  return (
    <div
      className="type-meta flex items-center justify-center rounded-nested bg-surface-2 px-6 text-center text-text-2"
      style={{ height }}
    >
      <p className="max-w-[36ch]">{children}</p>
    </div>
  );
}
