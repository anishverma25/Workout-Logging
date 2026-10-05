import { useId, useMemo, useState } from 'react';
import { cn } from '@/lib/cn';
import { ChartTable, Tooltip } from './ChartParts';
import { useWidth } from './useWidth';
import { linearScale, niceDomain, spacedIndices } from './scale';

export interface Bar {
  key: string;
  /** Short axis label. */
  label: string;
  /** Tooltip and table label, defaults to label. */
  longLabel?: string;
  value: number;
  /** Drawn in the accent; for example the current week. */
  highlight?: boolean;
  /** Optional second line in the tooltip. */
  note?: string;
}

interface Props {
  bars: Bar[];
  label: string;
  formatValue: (v: number) => string;
  valueName: string;
  orientation?: 'vertical' | 'horizontal';
  /** Table header for the categories of horizontal bars (Exercise, Muscle group...). */
  categoryName?: string;
  height?: number;
  color?: string;
  /** Muted colour for bars that are not highlighted, when some are. */
  baseColor?: string;
}

const BAR_MAX = 24;
const RADIUS = 4;

/** Rectangle rounded only at the data end, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number, horizontal: boolean): string {
  if (w <= 0 || h <= 0) return '';
  const r = Math.min(RADIUS, horizontal ? w : h, horizontal ? h / 2 : w / 2);
  if (horizontal) {
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function BarChart(props: Props) {
  return props.orientation === 'horizontal' ? (
    <HorizontalBars {...props} />
  ) : (
    <Columns {...props} />
  );
}

function Columns({
  bars,
  label,
  formatValue,
  valueName,
  height = 200,
  color = 'var(--chart-1)',
  baseColor,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const { domain, ticks } = useMemo(
    () =>
      niceDomain(
        0,
        Math.max(0, ...bars.map((b) => b.value)),
        4,
        true,
        bars.every((b) => Number.isInteger(b.value)),
      ),
    [bars],
  );
  const left = Math.max(...ticks.map((t) => formatValue(t).length)) * 7 + 12;
  const top = 18;
  const bottom = 26;
  const plotW = Math.max(0, width - left - 6);
  const plotH = height - top - bottom;
  const band = bars.length ? plotW / bars.length : 0;
  const barW = Math.min(BAR_MAX, Math.max(4, band - 2));
  const y = linearScale(domain, [top + plotH, top], ticks);
  const labels = new Set(spacedIndices(bars.length, Math.max(2, Math.floor(plotW / 56))));
  const anyHighlight = bars.some((b) => b.highlight);
  const emphasised = bars.findIndex((b) => b.highlight);
  const labelled = emphasised >= 0 ? emphasised : bars.length - 1;

  return (
    <figure className="m-0">
      <div ref={ref} className="relative w-full select-none" style={{ height }}>
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            style={{ position: 'absolute', inset: 0 }}
            role="img"
            aria-labelledby={titleId}
            tabIndex={0}
            className="touch-pan-y overflow-visible rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent-text"
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const d = e.key === 'ArrowRight' ? 1 : -1;
                setActive((a) =>
                  Math.min(bars.length - 1, Math.max(0, (a ?? (d > 0 ? -1 : bars.length)) + d)),
                );
              } else if (e.key === 'Escape') setActive(null);
            }}
          >
            <title id={titleId}>{label}</title>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={left} x2={left + plotW} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
                <text
                  x={left - 8}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="tabular fill-faint text-[11px]"
                >
                  {formatValue(t)}
                </text>
              </g>
            ))}
            {bars.map((b, i) => {
              const cx = left + band * i + band / 2;
              const h = y(0) - y(b.value);
              const fill = anyHighlight && !b.highlight ? (baseColor ?? color) : color;
              return (
                <g key={b.key}>
                  <rect
                    x={left + band * i}
                    y={top}
                    width={band}
                    height={plotH}
                    fill="transparent"
                    onPointerEnter={() => setActive(i)}
                    onPointerDown={() => setActive(i)}
                  />
                  <path
                    d={barPath(cx - barW / 2, y(b.value), barW, h, false)}
                    fill={fill}
                    opacity={active !== null && active !== i ? 0.55 : 1}
                    className="pointer-events-none transition-opacity"
                  />
                  {i === labelled && b.value > 0 ? (
                    <text
                      x={cx}
                      y={y(b.value) - 6}
                      textAnchor="middle"
                      className="tabular fill-text text-[11px] font-semibold"
                    >
                      {formatValue(b.value)}
                    </text>
                  ) : null}
                  {labels.has(i) ? (
                    <text
                      x={cx}
                      y={height - 6}
                      textAnchor="middle"
                      className={cn(
                        'text-[11px]',
                        b.highlight ? 'fill-text font-semibold' : 'fill-faint',
                      )}
                    >
                      {b.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}
        {active !== null && bars[active] ? (
          <Tooltip
            x={left + band * active + band / 2}
            y={0}
            width={width}
            title={bars[active].longLabel ?? bars[active].label}
            rows={[
              { label: valueName, value: formatValue(bars[active].value), color, shape: 'bar' },
              ...(bars[active].note
                ? [{ label: bars[active].note!, value: '', color: 'transparent' }]
                : []),
            ]}
          />
        ) : null}
      </div>
      <ChartTable
        caption={label}
        columns={['Period', valueName]}
        rows={bars.map((b) => [b.longLabel ?? b.label, formatValue(b.value)])}
      />
    </figure>
  );
}

/** Ranked horizontal bars: category on the left, value at the tip of each bar. */
function HorizontalBars({
  bars,
  label,
  formatValue,
  valueName,
  categoryName = 'Category',
  color = 'var(--chart-1)',
}: Props) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <figure className="m-0">
      <ul aria-label={label} className="flex flex-col gap-3">
        {bars.map((b) => {
          const pct = max > 0 ? (b.value / max) * 100 : 0;
          return (
            <li key={b.key} className="flex flex-col gap-1 text-sm" title={b.note}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-muted">{b.label}</span>
                <span className="tabular shrink-0 font-semibold">
                  {formatValue(b.value)}
                  <span className="sr-only"> {valueName}</span>
                </span>
              </span>
              <span className="flex h-2 items-center rounded-full bg-surface-3" aria-hidden>
                {pct > 0 ? (
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${pct}%`, minWidth: 6, background: color }}
                  />
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
      <ChartTable
        caption={label}
        columns={[categoryName, valueName]}
        rows={bars.map((b) => [b.longLabel ?? b.label, formatValue(b.value)])}
      />
    </figure>
  );
}
