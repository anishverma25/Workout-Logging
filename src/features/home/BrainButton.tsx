import { Brain, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { brainSummary } from '@/domain/brain/homeEntry';
import type { useBrain } from '../brain/useBrain';

const R = 12;
const C = 2 * Math.PI * R;

/**
 * Macrotrophy Brain on Home, for everyone: a labelled pill above the greeting with a small ring
 * that fills as it learns the person. Opens the Brain page.
 */
export function BrainButton({ brain }: { brain: ReturnType<typeof useBrain> }) {
  if (brain.status !== 'success') return null;
  const s = brainSummary({
    stage: brain.model?.stage ?? null,
    changes: brain.decision ? brain.decision.changes.length : null,
    decided: brain.record?.outcome ?? null,
    pro: true,
  });
  const stage = brain.model?.stage;
  const short =
    s.stage === 'learning' && stage
      ? `Week ${Math.max(1, Math.min(stage.week, stage.of))} of ${stage.of}`
      : 'Knows you';
  return (
    <Link
      to="/brain"
      className="pressable chrome brain-button inline-flex h-9 max-w-full items-center gap-2 rounded-full py-1 pr-2.5 pl-1"
      aria-label={`Macrotrophy Brain: ${s.badge}`}
      data-brain-home={s.stage}
    >
      <span className="relative grid size-7 shrink-0 place-items-center" aria-hidden>
        <svg viewBox="0 0 28 28" className="absolute inset-0 size-full -rotate-90">
          <circle cx="14" cy="14" r={R} fill="none" stroke="var(--fill)" strokeWidth="2" />
          <circle
            cx="14"
            cy="14"
            r={R}
            fill="none"
            stroke="var(--lime)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={`${s.progress * C} ${C}`}
            className="score-arc"
          />
        </svg>
        <Brain className="size-3.5 text-lime" />
      </span>
      <span className="type-footnote truncate font-semibold text-text-1">Macrotrophy Brain</span>
      <span className="type-caption tabular shrink-0 text-text-2">{short}</span>
      <ChevronRight className="size-3.5 shrink-0 text-text-3" aria-hidden />
    </Link>
  );
}
