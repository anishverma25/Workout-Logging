import { ExternalLink } from 'lucide-react';
import { citationUrl } from '@/domain/analytics/citations';
import { regionDetail, shareSource, shortRegion } from '@/data/library/shares';
import type { ExerciseShares } from '@/data/library/muscleShares';
import { cn } from '@/lib/cn';
import { sharesByArea, shareRole } from '@/domain/analytics/bodyMap';
import { ExerciseBody } from './MuscleSplit';
import { ROLE_FILL, ROLE_LABEL, useGrown } from './muscleRoles';

/**
 * Which muscles an exercise works and roughly how much, from EMG and muscle-growth studies. The
 * numbers are estimates of each muscle's share of the work, rounded to 5%, and say so.
 */
export function MuscleShares({ shares, compact }: { shares: ExerciseShares; compact?: boolean }) {
  const grown = useGrown();
  const groups = sharesByArea(shares.regions);
  const roles = (['primary', 'secondary', 'minor'] as const)
    .map((role) => ({
      role,
      items: shares.regions.filter((r, i) => shareRole(i, r.share) === role),
    }))
    .filter((g) => g.items.length > 0);
  return (
    <div data-muscle-shares>
      <div className="flex justify-center gap-6 py-1">
        {(['front', 'back'] as const).map((side) => (
          <figure key={side} className="m-0 flex flex-col items-center">
            <ExerciseBody shares={shares} show={side} className="h-44 w-[5.5rem]" />
            <figcaption className="type-caption mt-1 text-text-2">
              {side === 'front' ? 'Front' : 'Back'}
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="type-caption mt-2 flex justify-center gap-4 text-text-2" aria-hidden>
        {(['primary', 'secondary', 'minor'] as const).map((role) => (
          <span key={role} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: ROLE_FILL[role] }} />
            {ROLE_LABEL[role]}
          </span>
        ))}
      </div>

      {groups.length > 1 ? (
        <div className="mt-4">
          <p className="type-caption mb-1.5 text-text-2">By muscle group</p>
          <div className="flex h-8 gap-0.5 overflow-hidden rounded-nested" data-muscle-groups>
            {groups.map((g, i) => (
              <span
                key={g.area}
                className="score-grow type-caption flex min-w-0 items-center justify-center overflow-hidden font-semibold whitespace-nowrap"
                style={{
                  width: grown ? `${g.share}%` : 0,
                  background:
                    i === 0 ? 'var(--muscle-3)' : i === 1 ? 'var(--muscle-2)' : 'var(--muscle-1)',
                  color: i < 2 ? 'var(--on-lime)' : 'var(--text-1)',
                }}
              >
                {g.share >= 18 ? `${g.label} ${g.share}%` : ''}
              </span>
            ))}
          </div>
          <p className="type-caption tabular mt-1.5 text-text-2">
            {groups.map((g) => `${g.label} ${g.share}%`).join(' · ')}
          </p>
        </div>
      ) : null}

      {roles.map(({ role, items }) => (
        <section key={role} className="mt-4" aria-label={ROLE_LABEL[role]}>
          <h4 className="type-footnote mb-1.5 flex justify-between font-semibold text-text-2">
            <span>{ROLE_LABEL[role]}</span>
            <span className="tabular">{items.reduce((s, r) => s + r.share, 0)}%</span>
          </h4>
          <ul className="rounded-nested bg-surface-2" aria-label="Approximate share of the work">
            {items.map((r, i) => (
              <li
                key={r.region}
                className={cn('px-3 py-2.5', i > 0 && 'shadow-[inset_0_0.5px_0_var(--divider)]')}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="type-body min-w-0 text-text-1">
                    {shortRegion(r.region)}
                    {regionDetail(r.region) ? (
                      <span className="type-footnote text-text-2"> {regionDetail(r.region)}</span>
                    ) : null}
                  </span>
                  <span className="type-headline tabular text-text-1">{r.share}%</span>
                </span>
                <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-fill">
                  <span
                    className="score-grow block h-full rounded-full"
                    style={{ width: grown ? `${r.share}%` : 0, background: ROLE_FILL[role] }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {shares.note ? (
        <p className={cn('type-footnote text-text-2', compact ? 'mt-2' : 'mt-3')}>{shares.note}</p>
      ) : null}
      {!compact ? (
        <>
          <p className="type-caption mt-2 text-text-3">
            Estimated share of the work, not measured muscle activation.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {shares.sources.map((id) => {
              const c = shareSource(id);
              if (!c) return null;
              const url = citationUrl(c);
              const many = c.authors.includes(',') && !/ et al\.?$| & /.test(c.authors);
              const who = many ? `${c.authors.split(',')[0]} et al.` : c.authors;
              const text = `${who} ${c.year ?? ''}`.trim();
              return (
                <li key={id} className="text-xs">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-accent-text"
                    >
                      {text}, {c.journal.split(/\s\d/)[0]}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ) : (
                    <span className="text-faint">
                      {text}, {c.journal}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}
