import { useId, useMemo, useState } from 'react';
import { firstPlay } from './motion';
import { ChartTable, Legend, Tooltip } from './ChartParts';
import { useWidth } from './useWidth';
import {
  dateAxisLabels,
  linearScale,
  nearestIndex,
  niceDomain,
  pickAxisLabels,
  splitAtGaps,
} from './scale';

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
  /** Lime area under the line, 18% to 0%. On by default for the main (--chart-1) line. */
  area?: boolean;
}

interface Props {
  series: LineSeries[];
  /** What the chart shows, read by screen readers. */
  label: string;
  height?: number;
  formatY: (v: number) => string;
  /** Axis label. Default: dates, with the year whenever it is not this year. */
  formatX?: (x: number) => string;
  /** Longer form for the tooltip title and table, defaults to formatX. */
  formatXLong?: (x: number) => string;
  zeroBased?: boolean;
  /** Label the last value of the first series at the line end. */
  endLabel?: boolean;
  /** A break longer than this (ms) is drawn as a faint dashed line, not a trend. 4 weeks. */
  maxGap?: number;
}

const FOUR_WEEKS = 28 * 86_400_000;

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
  formatXLong: formatXLongProp,
  maxGap = FOUR_WEEKS,
  zeroBased = false,
  endLabel = false,
}: Props) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const gradientId = useId();
  const [draw] = useState(() => firstPlay(`line:${label}`));

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points);
    if (all.length === 0) return null;
    const xs = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b);
    const ys = all.map((p) => p.y);
    const { domain, ticks } = niceDomain(
      Math.min(...ys),
      Math.max(...ys),
      3,
      zeroBased,
      ys.every((y) => Number.isInteger(y)),
    );
    const left = Math.max(...ticks.map((t) => formatY(t).length)) * 7.5 + 12;
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
  const xTexts = formatX ? xs.map(formatX) : dateAxisLabels(xs);
  const xLabels = pickAxisLabels(xPositions, xTexts);
  const formatXLong =
    formatXLongProp ??
    formatX ??
    ((x: number) =>
      new Date(x).toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }));

  const valueAt = (s: LineSeries, x: number) => s.points.find((p) => p.x === x);
  const activeX = active !== null ? xs[active] : undefined;

  const pathFor = (pts: LinePoint[]) =>
    pts
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`)
      .join('');
  const areaFor = (pts: LinePoint[]) =>
    `${pathFor(pts)}L${xScale(pts[pts.length - 1]!.x).toFixed(1)},${M.top + plotH}L${xScale(pts[0]!.x).toFixed(1)},${M.top + plotH}Z`;
  /** The bridges across long breaks: from the end of one run to the start of the next. */
  const bridgesFor = (runs: LinePoint[][]) =>
    runs
      .slice(1)
      .map((run, i) => pathFor([runs[i]![runs[i]!.length - 1]!, run[0]!]))
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
            className="touch-pan-y overflow-visible rounded-tile"
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
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--lime)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--lime)" stopOpacity={0} />
              </linearGradient>
            </defs>
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
                  className="type-meta tabular fill-text-2"
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
                className="type-meta tabular fill-text-2"
              >
                {xTexts[i]}
              </text>
            ))}

            {activeX !== undefined ? (
              <line
                x1={xScale(activeX)}
                x2={xScale(activeX)}
                y1={M.top}
                y2={M.top + plotH}
                stroke="var(--border-strong)"
                strokeWidth={1}
              />
            ) : null}

            {series.map((s) => {
              const style = s.style ?? 'line';
              const showDots = style !== 'line' || s.points.length <= 12;
              const area = (s.area ?? s.color === 'var(--chart-1)') && style !== 'dots';
              const lastPoint = s.points[s.points.length - 1];
              const runs = splitAtGaps(s.points, maxGap);
              // A point alone between two breaks has no line through it: show it as a dot.
              const lone = new Set(runs.filter((r) => r.length === 1).map((r) => r[0]!.x));
              return (
                <g key={s.id}>
                  {area
                    ? runs
                        .filter((run) => run.length > 1)
                        .map((run) => (
                          <path
                            key={`a${run[0]!.x}`}
                            d={areaFor(run)}
                            fill={`url(#${gradientId})`}
                            className={draw ? 'chart-fade' : undefined}
                          />
                        ))
                    : null}
                  {style !== 'dots' && runs.length > 1 ? (
                    <path
                      d={bridgesFor(runs)}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={1.5}
                      strokeDasharray="2 5"
                      strokeLinecap="round"
                      opacity={0.45}
                    />
                  ) : null}
                  {style !== 'dots'
                    ? runs
                        .filter((run) => run.length > 1)
                        .map((run) => (
                          <path
                            key={`l${run[0]!.x}`}
                            d={pathFor(run)}
                            pathLength={1}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={2}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            className={draw ? 'chart-draw' : undefined}
                          />
                        ))
                    : null}
                  {area && lastPoint && !showDots ? (
                    <circle
                      cx={xScale(lastPoint.x)}
                      cy={yScale(lastPoint.y)}
                      r={4}
                      fill={s.color}
                      stroke="var(--surface)"
                      strokeWidth={3}
                      className={draw ? 'chart-fade' : undefined}
                    />
                  ) : null}
                  {showDots || s.points.length === 1 || lone.size > 0
                    ? s.points
                        .filter((p) => showDots || s.points.length === 1 || lone.has(p.x))
                        .map((p) => (
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
                className="type-meta tabular fill-text-1 font-semibold"
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
