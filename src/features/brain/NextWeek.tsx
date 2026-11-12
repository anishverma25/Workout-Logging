import { useState } from 'react';
import { Link } from 'react-router';
import {
  CalendarPlus,
  Check,
  Clock,
  Dumbbell,
  Feather,
  Flame,
  Repeat,
  SlidersHorizontal,
  TriangleAlert,
  Undo2,
  Utensils,
  X,
} from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { PrimaryButton, SecondaryButton, TextButton } from '@/components/kit';
import { Skeleton } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { applyDecision, keepPlan, removePlanItem } from '@/data/repositories/plan';
import type { Change, Text } from '@/domain/brain/engine';
import { EVENT_LABEL } from '@/domain/brain/life';
import { addDays } from '@/lib/dates';
import { ProLock } from '../pro/ProLock';
import { ComingUpSheet } from './ComingUpSheet';
import { useBrain } from './useBrain';
import { WhatIfSheet } from './WhatIfSheet';

export type Lang = 'en' | 'hi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (key: string) => {
  const d = new Date(`${key}T12:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};
const weekRange = (key: string) => {
  const start = new Date(`${key}T12:00:00`);
  const end = addDays(start, 6);
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} to ${end.getDate()} ${MONTHS[end.getMonth()]}`
    : `${start.getDate()} ${MONTHS[start.getMonth()]} to ${end.getDate()} ${MONTHS[end.getMonth()]}`;
};

const COPY = {
  next: { en: 'Next week', hi: 'Agla hafta' },
  now: { en: 'This week', hi: 'Yeh hafta' },
  weekOf: { en: 'Week of', hi: 'Hafta' },
  apply: { en: 'Apply changes', hi: 'Changes apply kijiye' },
  keep: { en: 'Keep my plan', hi: 'Mera plan rakhiye' },
  nothing: {
    en: 'Nothing to change. Your plan stays as it is.',
    hi: 'Kuch badalne ki zaroorat nahi. Aapka plan wahi rahega.',
  },
  staying: { en: 'Staying the same', hi: 'Jo wahi rahega' },
  why: { en: 'Why', hi: 'Kyun' },
  until: { en: 'Until', hi: 'Tak' },
  applied: { en: 'Applied', hi: 'Apply ho gaya' },
  kept: { en: 'You kept your plan for this week.', hi: 'Aapne is hafte apna plan rakha.' },
  notApplied: { en: 'Not applied', hi: 'Apply nahi hua' },
  comingUp: { en: 'Coming up', hi: 'Aane wala' },
  add: { en: 'Add', hi: 'Add' },
  comingUpHint: {
    en: 'Exams, travel, a wedding, a fast? Tell the plan and it works around it.',
    hi: 'Exams, travel, shaadi, vrat? Plan ko bataiye, woh uske hisaab se chalega.',
  },
  tryPlan: { en: 'Try a different plan', hi: 'Alag plan try kijiye' },
  setUp: {
    en: 'Finish your profile to get a plan for each week.',
    hi: 'Har hafte ka plan paane ke liye profile poori kijiye.',
  },
  skipped: {
    en: 'could not be made, because your routine has no exercise for it.',
    hi: 'nahi ho paya, kyunki routine mein uske liye exercise nahi hai.',
  },
} satisfies Record<string, Text>;

const ICON: Record<Change['kind'], typeof Flame> = {
  calories: Flame,
  protein: Utensils,
  sets: Dumbbell,
  deload: Feather,
  swap: Repeat,
  session: Clock,
  restore: Undo2,
};

/**
 * "Your week and next week": the changes the adaptive plan proposes for the week after the
 * report, each with its reason and a Why. Nothing changes until the person taps Apply.
 */
export function NextWeek({ lang, now }: { lang: Lang; now: Date }) {
  const pro = useFeature('adaptive_plan');
  const brain = useBrain(now);
  const toast = useToast();
  const [busy, setBusy] = useState<'apply' | 'keep' | null>(null);
  const [comingUp, setComingUp] = useState(false);
  const [whatIf, setWhatIf] = useState(false);
  const [skipped, setSkipped] = useState<string[]>([]);
  const t = (text: Text) => text[lang];

  if (brain.status === 'loading') return <Skeleton className="mt-6 h-40 rounded-panel" />;
  if (brain.status === 'error' || !brain.nextWeekStart) return null;
  const { decision, record, nextWeekStart } = brain;
  const changes = decision?.changes ?? [];

  const apply = async () => {
    if (!decision) return;
    setBusy('apply');
    try {
      const r = await applyDecision(db, decision);
      setSkipped(r.skipped);
      toast(lang === 'hi' ? 'Hafta set ho gaya' : 'Your week is set');
    } finally {
      setBusy(null);
    }
  };
  const keep = async () => {
    if (!decision) return;
    setBusy('keep');
    try {
      await keepPlan(db, decision);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="mt-8 flex flex-col gap-3" data-next-week aria-labelledby="next-week-title">
      <header className="flex flex-col gap-1">
        <span className="type-meta text-lime">
          {t(COPY.weekOf)} {weekRange(nextWeekStart)}
        </span>
        <h2 id="next-week-title" className="type-title text-text-1">
          {t(brain.started ? COPY.now : COPY.next)}
        </h2>
      </header>

      {!pro ? (
        <ProLock
          feature="adaptive_plan"
          lead={
            changes.length
              ? `${changes.length} ${changes.length === 1 ? 'change is' : 'changes are'} ready for this week.`
              : undefined
          }
        />
      ) : !decision ? (
        <div className="rounded-panel bg-surface p-5">
          <p className="type-body text-text-2">{t(COPY.setUp)}</p>
          <TextButton to="/profile" className="mt-2">
            Profile
          </TextButton>
        </div>
      ) : (
        <>
          {decision.warnings.map((w) => (
            <div
              key={w.area}
              role="alert"
              className="flex gap-3 rounded-panel bg-danger-soft p-4"
              data-plan-warning={w.area}
            >
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger-text" aria-hidden />
              <p className="type-subhead text-text-1">{t(w.text)}</p>
            </div>
          ))}

          {record ? (
            <div className="rounded-panel bg-surface p-5" data-plan-answered={record.outcome}>
              {record.outcome === 'kept' ? (
                <p className="type-body text-text-1">{t(COPY.kept)}</p>
              ) : (
                <>
                  <p className="type-headline text-text-1">
                    {t(COPY.applied)} {dayMonth(record.at.slice(0, 10))}
                  </p>
                  <ul className="mt-3 flex flex-col gap-2.5">
                    {record.changes.map((c) => (
                      <li key={c.id} className="flex items-start gap-2.5">
                        {c.applied ? (
                          <Check className="mt-0.5 size-4 shrink-0 text-lime" aria-hidden />
                        ) : (
                          <X className="mt-0.5 size-4 shrink-0 text-text-3" aria-hidden />
                        )}
                        <span className={c.applied ? 'type-subhead text-text-1' : 'type-subhead text-text-3'}>
                          {t(c.title)}
                          {c.applied ? '' : ` (${t(COPY.notApplied).toLowerCase()})`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {skipped.length ? (
                    <p className="type-footnote mt-3 text-text-3" role="status">
                      {skipped.length === 1 ? 'One change' : `${skipped.length} changes`} {t(COPY.skipped)}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : changes.length ? (
            <>
              <ul className="flex flex-col overflow-hidden rounded-panel bg-surface" data-plan-changes>
                {changes.map((c, i) => {
                  const Icon = ICON[c.kind];
                  return (
                    <li
                      key={c.id}
                      className={i ? 'border-t border-divider p-4' : 'p-4'}
                      data-plan-change={c.kind}
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-fill text-lime">
                          <Icon className="size-[18px]" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="type-headline text-text-1">{t(c.title)}</p>
                          <p className="type-subhead mt-0.5 text-text-2">{t(c.reason)}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <Link
                              to={`/science#${c.topic}`}
                              className="pressable type-footnote font-semibold text-lime"
                            >
                              {t(COPY.why)}
                            </Link>
                            {c.until ? (
                              <span className="type-footnote text-text-3">
                                {t(COPY.until)} {dayMonth(c.until)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row">
                <PrimaryButton block loading={busy === 'apply'} disabled={!!busy} onClick={() => void apply()} data-plan-apply>
                  {t(COPY.apply)}
                </PrimaryButton>
                <SecondaryButton block loading={busy === 'keep'} disabled={!!busy} onClick={() => void keep()} data-plan-keep>
                  {t(COPY.keep)}
                </SecondaryButton>
              </div>
            </>
          ) : (
            <div className="rounded-panel bg-surface p-5" data-plan-nothing>
              <p className="type-body text-text-1">{t(COPY.nothing)}</p>
            </div>
          )}

          {!record && decision.holds.length ? (
            <div className="rounded-panel bg-surface p-5" data-plan-holds>
              <p className="type-footnote font-semibold text-text-3">{t(COPY.staying)}</p>
              <ul className="mt-2 flex flex-col gap-2">
                {decision.holds.map((h) => (
                  <li key={h.kind} className="type-subhead text-text-2">
                    {t(h.reason)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {decision.notes.length ? (
            <ul className="flex flex-col gap-2 px-1" data-plan-notes>
              {decision.notes.map((n) => (
                <li key={n.en} className="type-footnote text-text-3">
                  {t(n)}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="rounded-panel bg-surface p-5" data-coming-up>
            <div className="flex items-center justify-between gap-3">
              <p className="type-headline text-text-1">{t(COPY.comingUp)}</p>
              <SecondaryButton compact icon={<CalendarPlus />} onClick={() => setComingUp(true)} data-coming-up-add>
                {t(COPY.add)}
              </SecondaryButton>
            </div>
            {brain.events.length ? (
              <ul className="mt-3 flex flex-col gap-2">
                {brain.events.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3">
                    <span className="type-subhead text-text-1">
                      {t(EVENT_LABEL[e.kind])}
                      <span className="text-text-3">
                        {' '}
                        · {e.start === e.end ? dayMonth(e.start) : `${dayMonth(e.start)} to ${dayMonth(e.end)}`}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="pressable tap-target -mr-2 flex size-9 items-center justify-center rounded-full text-text-3"
                      aria-label={`Remove ${EVENT_LABEL[e.kind].en}`}
                      onClick={() => void removePlanItem(db, e.id)}
                    >
                      <X className="size-4" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="type-subhead mt-1 text-text-2">{t(COPY.comingUpHint)}</p>
            )}
          </div>

          {brain.model?.maintenance && brain.input?.person.weightKg ? (
            <TextButton icon={<SlidersHorizontal />} onClick={() => setWhatIf(true)} data-what-if-open>
              {t(COPY.tryPlan)}
            </TextButton>
          ) : null}
        </>
      )}

      <ComingUpSheet open={comingUp} onClose={() => setComingUp(false)} now={now} />
      {brain.model && brain.input ? (
        <WhatIfSheet open={whatIf} onClose={() => setWhatIf(false)} brain={brain} />
      ) : null}
    </section>
  );
}
