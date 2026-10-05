import { useId, useMemo, useState } from 'react';
import { ChartTable, Legend, Tooltip } from './ChartParts';
import { useWidth } from './useWidth';
import { linearScale, nearestIndex, niceDomain, spacedIndices } from './scale';

export interface LinePoint {
  /** Usually a timestamp in ms. */
  x: number;
  y: number;
}

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  points: LinePoint[];
  /** line: connected; dots: raw measurements; both: line with markers. */
  style?: 'line' | 'dots' | 'both';
}

interface Props {
  series: LineSeries[];
  /** What the chart shows, read by screen readers. */
  label: string;
  height?: number;
  formatY: (v: number) => string;
  formatX: (x: number) => string;
  /** Longer form for the tooltip title and table, defaults to formatX. */
  formatXLong?: (x: number) => string;
  zeroBased?: boolean;
  /** Label the last value of the first series at the line end. */
  endLabel?: boolean;
}

const M = { top: 12, right: 14, bottom: 26 };

/**
 * Responsive SVG line chart.
 * - 2px lines, 8px markers with a 2px surface ring, recessive hairline grid.
 * - A crosshair snaps to the nearest x on hover or touch, and arrow keys step through points.
 *   The tooltip lists every series at that x.
 * - Legend for two or more series and a table view, so nothing depends on hover or colour.
 */
export function LineChart({
  series,
  label,
  height = 220,
  formatY,
  formatX,
  formatXLong = formatX,
  zeroBased = false,
  endLabel = false,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    if (all.length === 0) return null;
    const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
    const ys = all.map((p) => p.y);
    const { domain, ticks } = niceDomain(
      Math.min(...ys),
      Math.max(...ys),
      4,
      zeroBased,
      ys.every((y) => Number.isInteger(y)),
    );
    const left = Math.max(...ticks.map((t) => formatY(t).length)) * 7 + 12;
    return { xs, domain, ticks, left };
  }, [series, formatY, zeroBased]);

  if (!model) return null;
  const { xs, domain, ticks, left } = model;
  const plotW = Math.max(0, width - left - M.right);
  const plotH = height - M.top - M.bottom;
  const x0 = xs[0]!;
  const x1 = xs[xs.length - 1]!;
  const xScale = linearScale(x0 === x1 ? [x0 - 1, x1 + 1] : [x0, x1], [left, left + plotW]);
  const yScale = linearScale(domain, [M.top + plotH, M.top], ticks);
  const xPositions = xs.map(xScale);
  const labelCount = Math.max(2, Math.min(6, Math.floor(plotW / 84)));
  const xLabels = spacedIndices(xs.length, labelCount);

  const valueAt = (s: LineSeries, x: number) => s.points.find((p) => p.x === x);
  const activeX = active !== null ? xs[active] : undefined;

  const pathFor = (pts: LinePoint[]) =>
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`)
      .join('');

  const first = series[0];
  const last = first?.points[first.points.length - 1];

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
            onPointerMove={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setActive(nearestIndex(xPositions, e.clientX - box.left));
            }}
            onPointerDown={(e) => {
              const box = e.currentTarget.getBoundingClientRect();
              setActive(nearestIndex(xPositions, e.clientX - box.left));
            }}
            onPointerLeave={(e) => e.pointerType === 'mouse' && setActive(null)}
            onBlur={() => setActive(null)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const d = e.key === 'ArrowRight' ? 1 : -1;
                setActive((a) =>
                  Math.min(xs.length - 1, Math.max(0, (a ?? (d > 0 ? -1 : xs.length)) + d)),
                );
              } else if (e.key === 'Escape') setActive(null);
            }}
          >
            <title id={titleId}>{label}</title>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={left}
                  x2={left + plotW}
                  y1={yScale(t)}
                  y2={yScale(t)}
                  stroke="var(--chart-grid)"
                  strokeWidth={1}
                />
                <text
                  x={left - 8}
                  y={yScale(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="tabular fill-faint text-[11px]"
                >
                  {formatY(t)}
                </text>
              </g>
            ))}
            {xLabels.map((i) => (
              <text
                key={xs[i]}
                x={xPositions[i]}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : i === xs.length - 1 ? 'end' : 'middle'}
                className="fill-faint text-[11px]"
              >
                {formatX(xs[i]!)}
              </text>
            ))}

            {activeX !== undefined ? (
              <line
                x1={xScale(activeX)}
                x2={xScale(activeX)}
                y1={M.top}
                y2={M.top + plotH}
                stroke="var(--line-strong)"
                strokeWidth={1}
              />
            ) : null}

            {series.map((s) => {
              const style = s.style ?? 'line';
              const showDots = style !== 'line' || s.points.length <= 12;
              return (
                <g key={s.id}>
                  {style !== 'dots' && s.points.length > 1 ? (
                    <path
                      d={pathFor(s.points)}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  ) : null}
                  {showDots || s.points.length === 1
                    ? s.points.map((p) => (
                        <circle
                          key={p.x}
                          cx={xScale(p.x)}
                          cy={yScale(p.y)}
                          r={style === 'dots' ? 3.5 : 4}
                          fill={s.color}
                          stroke="var(--surface)"
                          strokeWidth={2}
                          opacity={style === 'dots' ? 0.75 : 1}
                        />
                      ))
                    : null}
                  {activeX !== undefined && valueAt(s, activeX) ? (
                    <circle
                      cx={xScale(activeX)}
                      cy={yScale(valueAt(s, activeX)!.y)}
                      r={5.5}
                      fill={s.color}
                      stroke="var(--surface)"
                      strokeWidth={2}
                    />
                  ) : null}
                </g>
              );
            })}

            {endLabel && last && first ? (
              <text
                x={Math.min(xScale(last.x), left + plotW)}
                y={yScale(last.y) - 12}
                textAnchor="end"
                className="tabular fill-text text-[12px] font-semibold"
              >
                {formatY(last.y)}
              </text>
            ) : null}
          </svg>
        ) : null}
        {activeX !== undefined ? (
          <Tooltip
            x={xScale(activeX)}
            y={0}
            width={width}
            title={formatXLong(activeX)}
            rows={series.flatMap((s) => {
              const p = valueAt(s, activeX);
              return p
                ? [
                    {
                      label: s.label,
                      value: formatY(p.y),
                      color: s.color,
                      shape: s.style === 'dots' ? ('dot' as const) : ('line' as const),
                    },
                  ]
                : [];
            })}
          />
        ) : null}
      </div>
      <figcaption className="mt-2">
        <Legend
          items={series.map((s) => ({
            label: s.label,
            color: s.color,
            shape: s.style === 'dots' ? 'dot' : 'line',
          }))}
        />
        <ChartTable
          caption={label}
          columns={['Date', ...series.map((s) => s.label)]}
          rows={[...xs].reverse().map((x) => [
            formatXLong(x),
            ...series.map((s) => {
              const p = valueAt(s, x);
              return p ? formatY(p.y) : '';
            }),
          ])}
        />
      </figcaption>
    </figure>
  );
}
