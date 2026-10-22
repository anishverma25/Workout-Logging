import { useState } from 'react';
import {
  BottomSheet,
  NumberField,
  OptionCard,
  PrimaryButton,
  SecondaryButton,
  TextLink,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { ProfileError, saveTargetSettings } from '@/data/repositories/profile';
import type { EnergyPlan } from '@/domain/analytics/body';
import type { Profile } from '@/domain/models/schemas';
import {
  calculatedTargets,
  macroKcal,
  targetMode,
  type CalculatedTargets,
  type TargetMode,
} from '@/domain/nutrition/targets';
import { EvidenceLink } from '../science/EvidenceLink';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * The choice every person makes once: have Overload work out calories, protein, carbs, fat,
 * fibre and water from their body and goal, or type their own. Own numbers left empty fall
 * back to the worked-out ones. Typed numbers stay saved when switching to calculated.
 */
export function TargetsSheet({
  open,
  onClose,
  profile,
  energy,
  weightKg,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  energy: EnergyPlan | null;
  weightKg: number | null;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Your daily targets" wide>
      {open && profile ? (
        <TargetsBody
          profile={profile}
          calc={calculatedTargets(energy, weightKg)}
          weightKg={weightKg}
          onDone={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

type Field = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG' | 'waterMl';

function TargetsBody({
  profile,
  calc,
  weightKg,
  onDone,
}: {
  profile: Profile;
  calc: CalculatedTargets | null;
  weightKg: number | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<TargetMode | null>(targetMode(profile));
  const [own, setOwn] = useState<Record<Field, number | null>>({
    kcal: profile.calorieTarget ?? null,
    proteinG: profile.proteinTargetG ?? null,
    carbsG: profile.carbsTargetG ?? null,
    fatG: profile.fatTargetG ?? null,
    fibreG: profile.fibreTargetG ?? null,
    waterMl: profile.waterTargetMl ?? null,
  });
  const [busy, setBusy] = useState(false);
  const set = (f: Field) => (v: number | null) => setOwn((o) => ({ ...o, [f]: v }));

  // What the macros the person typed add up to, against the calories they typed or were given.
  const kcalNow = own.kcal ?? calc?.kcal ?? null;
  const macros =
    own.proteinG !== null && own.carbsG !== null && own.fatG !== null
      ? macroKcal({ proteinG: own.proteinG, carbsG: own.carbsG, fatG: own.fatG })
      : null;
  const mismatch =
    macros !== null && kcalNow !== null && Math.abs(macros - kcalNow) / kcalNow > 0.1
      ? { macros, kcal: kcalNow }
      : null;

  async function save() {
    if (!mode) return;
    setBusy(true);
    try {
      await saveTargetSettings(
        db,
        mode === 'calculated'
          ? { targetMode: 'calculated' }
          : {
              targetMode: 'own',
              calorieTarget: own.kcal,
              proteinTargetG: own.proteinG,
              carbsTargetG: own.carbsG,
              fatTargetG: own.fatG,
              fibreTargetG: own.fibreG,
              waterTargetMl: own.waterMl,
            },
      );
      toast(mode === 'calculated' ? 'Targets worked out for you' : 'Your own targets are saved');
      onDone();
    } catch (e) {
      toast(e instanceof ProfileError ? e.message : 'Could not save. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const ph = (v: number | null | undefined) => (v == null ? undefined : String(Math.round(v)));

  return (
    <div className="flex flex-col gap-4 pt-1" data-targets-sheet>
      <p className="type-body text-text-2">
        How should Overload set your daily calories, protein, carbs, fat, fibre and water?
      </p>
      <div role="radiogroup" aria-label="How to set your targets" className="grid gap-2">
        <OptionCard
          title="Work them out for me"
          description="From your weight, goal and training, using published formulas. They move as you weigh in."
          selected={mode === 'calculated'}
          onSelect={() => setMode('calculated')}
        />
        <OptionCard
          title="I will set my own"
          description="Type your own numbers. Anything you leave empty uses the worked-out number."
          selected={mode === 'own'}
          onSelect={() => setMode('own')}
        />
      </div>

      {mode === 'calculated' ? (
        <div className="rounded-nested bg-surface-2 p-4" data-calculated-targets>
          {calc ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
              <Row label="Calories" value={`${n(calc.kcal)} kcal`} />
              <Row label="Protein" value={`${n(calc.proteinG)} g`} />
              <Row label="Carbs" value={`${n(calc.carbsG)} g`} />
              <Row label="Fat" value={`${n(calc.fatG)} g`} />
              <Row label="Fibre" value={`${n(calc.fibreG)} g`} />
              <Row
                label="Water"
                value={calc.waterMl ? `${n(calc.waterMl)} ml` : 'Needs a weigh-in'}
              />
            </dl>
          ) : (
            <p className="type-meta text-text-2">
              To work out calories and macros, Overload needs your weight, height, sex and training
              days. Add them on the Body page.
              {weightKg ? ' Water is worked out from your weight already.' : ''}
            </p>
          )}
          <p className="type-caption mt-3 flex flex-wrap items-center gap-x-2 text-text-2">
            Energy from your body and goal, protein from your goal, fat at least 0.8 g per kg, fibre
            14 g per 1,000 kcal, water 35 ml per kg.
            <EvidenceLink topic="targets" about="how targets are worked out" />
          </p>
        </div>
      ) : null}

      {mode === 'own' ? (
        <div className="flex flex-col gap-3" data-own-targets>
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Calories a day"
              value={own.kcal}
              onValueChange={set('kcal')}
              allowDecimal={false}
              min={800}
              max={8000}
              unit="kcal"
              placeholder={ph(calc?.kcal)}
            />
            <NumberField
              label="Protein a day"
              value={own.proteinG}
              onValueChange={set('proteinG')}
              allowDecimal={false}
              min={20}
              max={500}
              unit="g"
              placeholder={ph(calc?.proteinG)}
            />
            <NumberField
              label="Carbs a day"
              value={own.carbsG}
              onValueChange={set('carbsG')}
              allowDecimal={false}
              min={0}
              max={1500}
              unit="g"
              placeholder={ph(calc?.carbsG)}
            />
            <NumberField
              label="Fat a day"
              value={own.fatG}
              onValueChange={set('fatG')}
              allowDecimal={false}
              min={10}
              max={500}
              unit="g"
              placeholder={ph(calc?.fatG)}
            />
            <NumberField
              label="Fibre a day"
              value={own.fibreG}
              onValueChange={set('fibreG')}
              allowDecimal={false}
              min={0}
              max={150}
              unit="g"
              placeholder={ph(calc?.fibreG)}
            />
            <NumberField
              label="Water a day"
              value={own.waterMl}
              onValueChange={set('waterMl')}
              allowDecimal={false}
              min={500}
              max={8000}
              unit="ml"
              placeholder={ph(calc?.waterMl)}
            />
          </div>
          {mismatch ? (
            <p className="type-meta text-text-2" data-macro-mismatch>
              Your protein, carbs and fat add up to {n(mismatch.macros)} kcal, but your calories are{' '}
              {n(mismatch.kcal)}. You can keep both, they just will not match.
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <p className="type-caption text-text-2">Grey numbers are the worked-out ones.</p>
            <TextLink
              small
              onClick={() =>
                setOwn({
                  kcal: calc?.kcal ?? null,
                  proteinG: calc?.proteinG ?? null,
                  carbsG: calc?.carbsG ?? null,
                  fatG: calc?.fatG ?? null,
                  fibreG: calc?.fibreG ?? null,
                  waterMl: calc?.waterMl ?? null,
                })
              }
            >
              Start from these
            </TextLink>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <PrimaryButton block onClick={() => void save()} loading={busy} disabled={!mode}>
          {mode === 'calculated' ? 'Use these targets' : 'Save targets'}
        </PrimaryButton>
        <SecondaryButton block onClick={onDone}>
          Cancel
        </SecondaryButton>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-meta text-text-2">{label}</dt>
      <dd className="type-headline tabular text-text-1">{value}</dd>
    </div>
  );
}
