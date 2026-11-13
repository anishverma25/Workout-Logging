import { useState } from 'react';
import { Link } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { useFeature } from '@/app/entitlement';
import { BottomSheet, ChipGroup, OptionCard, PrimaryButton, SecondaryButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { usePreferences } from '@/data/hooks';
import { applyDecision, PlanError, reportPain } from '@/data/repositories/plan';
import { decideWeek, type Decision } from '@/domain/brain/engine';
import {
  PAIN_AREAS,
  PAIN_LABEL,
  RETURN_WEEKS,
  needsProfessional,
  type PainArea,
  type PainSeverity,
  type RedFlag,
} from '@/domain/brain/life';
import { startOfWeek, toDateKey } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { useBrain } from './useBrain';

const SEVERITY: { value: PainSeverity; title: string; description: string }[] = [
  { value: 'mild', title: 'Mild', description: 'Uncomfortable, but I can train.' },
  { value: 'moderate', title: 'Moderate', description: 'It changes how I move.' },
  { value: 'severe', title: 'Severe', description: 'I cannot train it.' },
];
const FLAGS: { value: RedFlag; label: string }[] = [
  { value: 'sharp', label: 'Sharp or sudden pain' },
  { value: 'numb', label: 'Numbness or tingling' },
  { value: 'swelling', label: 'Swelling' },
  { value: 'lasting', label: 'Has lasted more than a week' },
];

type Step =
  | { kind: 'form' }
  | { kind: 'stop' }
  | { kind: 'noted'; pro: boolean }
  | { kind: 'plan'; decision: Decision };

/**
 * "Something hurts", from the logger's exercise menu. Free to log. With Pro the plan answers
 * straight away: it swaps the lifts that load the area and trims its work for a few weeks, with
 * the person's yes. Red flags stop that and point to a professional.
 */
export function HurtsSheet({
  open,
  onClose,
  exerciseId,
}: {
  open: boolean;
  onClose: () => void;
  exerciseId: string | null;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Something hurts" subtitle="Training guidance, not medical advice">
      {open ? <Form onClose={onClose} exerciseId={exerciseId} /> : null}
    </BottomSheet>
  );
}

function Form({ onClose, exerciseId }: { onClose: () => void; exerciseId: string | null }) {
  const now = useNow();
  const pro = useFeature('adaptive_plan');
  const brain = useBrain(now);
  const prefs = usePreferences();
  const toast = useToast();
  const [area, setArea] = useState<PainArea | null>(null);
  const [severity, setSeverity] = useState<PainSeverity | null>(null);
  const [flags, setFlags] = useState<RedFlag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'form' });

  const save = async () => {
    if (!area || !severity) {
      setError(!area ? 'Choose where it hurts.' : 'Choose how bad it is.');
      return;
    }
    setBusy(true);
    try {
      const date = toDateKey(now);
      const item = await reportPain(db, { area, severity, redFlags: flags, date, exerciseId });
      const pain = { id: item.id, area, severity, redFlags: flags, date, exerciseId };
      if (needsProfessional(pain)) {
        setStep({ kind: 'stop' });
        return;
      }
      if (!pro || !brain.input) {
        setStep({ kind: 'noted', pro });
        return;
      }
      // The same engine as the weekly plan, asked only about this report, from this week.
      const decision = decideWeek({
        ...brain.input,
        nextWeekStart: toDateKey(startOfWeek(now, prefs.weekStartsOn)),
        pains: [pain],
        events: [],
        stalls: [],
        weeks: [],
        plan: { ...brain.input.plan, kcal: null, proteinG: null },
      });
      const changes = decision.changes.filter((c) => c.cause === 'pain');
      setStep(changes.length ? { kind: 'plan', decision: { ...decision, changes } } : { kind: 'noted', pro });
    } catch (e) {
      setError(e instanceof PlanError ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (step.kind === 'stop')
    return (
      <div className="flex flex-col gap-4" data-hurts-stop>
        <div className="flex gap-3 rounded-nested bg-danger-soft p-4" role="alert">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger-text" aria-hidden />
          <p className="type-body text-text-1">
            Stop training your {PAIN_LABEL[area!].en.toLowerCase()} and see a doctor or physiotherapist before you
            load it again. The plan is not changed around this. Skip anything that brings the pain on.
          </p>
        </div>
        <PrimaryButton block onClick={onClose}>
          Done
        </PrimaryButton>
      </div>
    );

  if (step.kind === 'noted')
    return (
      <div className="flex flex-col gap-4" data-hurts-noted>
        <p className="type-body text-text-1">
          Noted. Go easy on your {PAIN_LABEL[area!].en.toLowerCase()} today: stop any set that brings the pain on.
        </p>
        {step.pro ? (
          <p className="type-subhead text-text-2">
            Nothing in your routine needs changing for it. If it gets worse or lasts, see a professional.
          </p>
        ) : (
          <p className="type-subhead text-text-2">
            With Pro, your plan swaps the lifts that load it and trims the work for a few weeks, then builds back.{' '}
            <Link to="/pro" className="font-semibold text-lime">
              See Pro
            </Link>
          </p>
        )}
        <PrimaryButton block onClick={onClose}>
          Done
        </PrimaryButton>
      </div>
    );

  if (step.kind === 'plan') {
    const weeks = RETURN_WEEKS[severity === 'moderate' ? 'moderate' : 'mild'];
    const apply = async () => {
      setBusy(true);
      try {
        await applyDecision(db, step.decision, { record: false });
        toast(`Your plan goes easy on it for ${weeks} weeks`);
        onClose();
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="flex flex-col gap-4" data-hurts-plan>
        <p className="type-subhead text-text-2">
          For the next {weeks} weeks, then your plan goes back. These go into your routine, not the workout that is
          open.
        </p>
        <ul className="flex flex-col gap-3">
          {step.decision.changes.map((c) => (
            <li key={c.id} className="rounded-nested bg-surface-2 p-3.5">
              <p className="type-headline text-text-1">{c.title.en}</p>
              <p className="type-subhead mt-0.5 text-text-2">{c.reason.en}</p>
            </li>
          ))}
        </ul>
        <p className="type-footnote text-text-2">
          If the pain is sharp, lasts, or comes with swelling or numbness, stop and see a professional.
        </p>
        <div className="flex flex-col gap-2">
          <PrimaryButton block loading={busy} onClick={() => void apply()} data-hurts-apply>
            Apply to my routine
          </PrimaryButton>
          <SecondaryButton block disabled={busy} onClick={onClose}>
            Not now
          </SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5" data-hurts-form>
      <div className="flex flex-col gap-2">
        <p className="type-footnote text-text-2">Where</p>
        <ChipGroup
          label="Where it hurts"
          value={area}
          onChange={(v) => {
            setArea(v);
            setError(null);
          }}
          options={PAIN_AREAS.map((a) => ({ value: a, label: PAIN_LABEL[a].en }))}
        />
      </div>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="How bad it is">
        <p className="type-footnote text-text-2">How bad</p>
        {SEVERITY.map((s) => (
          <OptionCard
            key={s.value}
            title={s.title}
            description={s.description}
            selected={severity === s.value}
            onSelect={() => {
              setSeverity(s.value);
              setError(null);
            }}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2">
        <p className="type-footnote text-text-2">Any of these?</p>
        <ChipGroup label="Warning signs" multiple value={flags} onChange={setFlags} options={FLAGS} />
      </div>
      {error ? (
        <p role="alert" className="type-footnote text-danger-text">
          {error}
        </p>
      ) : null}
      <PrimaryButton block loading={busy} onClick={() => void save()} data-hurts-save>
        Save
      </PrimaryButton>
    </div>
  );
}
