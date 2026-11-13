import { cn } from '@/lib/cn';

export type HeaderArtKind =
  'science' | 'strength' | 'training' | 'body' | 'app' | 'food' | 'workout' | 'leaderboard';

/**
 * The picture at the top of a science section or a guide: the lime light, a faint grid, and one
 * drawing of what the section measures, with its rule written beside it. Drawn in SVG from the
 * colour tokens, so it is sharp at any size, weighs almost nothing and reads in the static HTML
 * search engines see.
 */
export function HeaderArt({
  kind,
  caption,
  className,
}: {
  kind: HeaderArtKind;
  /** The rule or formula written on the picture, e.g. "e1RM = w × (1 + r / 30)". */
  caption?: string;
  className?: string;
}) {
  return (
    <figure
      aria-hidden
      className={cn(
        'relative isolate h-36 overflow-hidden rounded-panel bg-surface tab:h-44',
        className,
      )}
      data-header-art={kind}
    >
      <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_85%_100%,var(--lime-dim),transparent_70%)]" />
      <svg
        className="absolute inset-0 size-full text-divider"
        preserveAspectRatio="none"
        viewBox="0 0 400 160"
      >
        {Array.from({ length: 9 }, (_, i) => (
          <line
            key={`v${i}`}
            x1={i * 50}
            x2={i * 50}
            y1="0"
            y2="160"
            stroke="currentColor"
            strokeWidth="0.5"
          />
        ))}
        {Array.from({ length: 4 }, (_, i) => (
          <line
            key={`h${i}`}
            x1="0"
            x2="400"
            y1={i * 50 + 5}
            y2={i * 50 + 5}
            stroke="currentColor"
            strokeWidth="0.5"
          />
        ))}
      </svg>
      <svg
        className="absolute right-0 bottom-0 h-full w-[68%] text-lime"
        viewBox="0 0 280 160"
        preserveAspectRatio="xMaxYMax meet"
        fill="none"
      >
        <Motif kind={kind} />
      </svg>
      {caption ? (
        <figcaption className="absolute top-4 left-5 max-w-[60%] font-serif text-[1.05rem] text-text-1 italic tab:top-5 tab:left-6 tab:text-[1.35rem]">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function Motif({ kind }: { kind: HeaderArtKind }) {
  switch (kind) {
    case 'strength':
    case 'workout':
      // A lift's estimated best, climbing session by session.
      return (
        <>
          <path
            d="M20 132 L60 120 L100 124 L140 98 L180 92 L220 64 L260 44"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20 132 L60 120 L100 124 L140 98 L180 92 L220 64 L260 44 L260 160 L20 160Z"
            fill="currentColor"
            opacity="0.12"
          />
          {[
            [20, 132],
            [60, 120],
            [100, 124],
            [140, 98],
            [180, 92],
            [220, 64],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="3.5" fill="currentColor" opacity="0.7" />
          ))}
          <circle cx="260" cy="44" r="7" fill="currentColor" />
          <circle cx="260" cy="44" r="14" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
        </>
      );
    case 'training':
      // Hard sets per muscle for a week, the busiest one lit.
      return (
        <>
          {[52, 78, 96, 64, 118, 86, 70].map((h, i) => (
            <rect
              key={i}
              x={40 + i * 32}
              y={150 - h}
              width="20"
              height={h}
              rx="5"
              fill="currentColor"
              opacity={h === 118 ? 1 : 0.28}
            />
          ))}
          <line
            x1="30"
            x2="270"
            y1="62"
            y2="62"
            stroke="currentColor"
            strokeDasharray="4 6"
            opacity="0.6"
          />
        </>
      );
    case 'body':
    case 'food':
      // Daily weigh-ins scattered, the 7-day mean drawn smooth through them.
      return (
        <>
          {[
            [24, 70],
            [48, 92],
            [72, 66],
            [96, 88],
            [120, 78],
            [144, 102],
            [168, 86],
            [192, 108],
            [216, 96],
            [240, 116],
            [264, 104],
          ].map(([x, y]) => (
            <circle key={x} cx={x} cy={y} r="3" fill="currentColor" opacity="0.4" />
          ))}
          <path
            d="M24 76 C 80 80, 120 84, 160 92 S 230 106, 266 108"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      );
    case 'leaderboard':
      // A podium.
      return (
        <>
          <rect x="70" y="86" width="48" height="74" rx="6" fill="currentColor" opacity="0.3" />
          <rect x="124" y="56" width="48" height="104" rx="6" fill="currentColor" />
          <rect x="178" y="106" width="48" height="54" rx="6" fill="currentColor" opacity="0.18" />
          <circle cx="148" cy="34" r="10" stroke="currentColor" strokeWidth="2.5" />
        </>
      );
    case 'app':
    case 'science':
      // Three rings of a week, one closed.
      return (
        <>
          {[
            [54, 1],
            [40, 0.72],
            [26, 0.45],
          ].map(([r, share]) => (
            <g key={r}>
              <circle cx="190" cy="88" r={r} stroke="currentColor" strokeWidth="9" opacity="0.15" />
              <circle
                cx="190"
                cy="88"
                r={r}
                stroke="currentColor"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * r! * share!} 999`}
                transform="rotate(-90 190 88)"
              />
            </g>
          ))}
        </>
      );
  }
}
