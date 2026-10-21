import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { BottomSheet, NumberField, OptionCard, PrimaryButton, TextLink } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { deleteCustomFood } from '@/data/repositories/food';
import { ProfileError, saveFoodSettings } from '@/data/repositories/profile';
import type { CustomFood, Profile } from '@/domain/models/schemas';
import type { DietType } from '@/domain/nutrition/types';
import { DIET_LABEL } from './foodText';

/** The four diet choices, saved the moment one is tapped. */
export function DietPicker({ value, onSaved }: { value: DietType | null; onSaved?: () => void }) {
  const toast = useToast();
  return (
    <div role="radiogroup" aria-label="What you eat" className="grid gap-2 tab:grid-cols-2">
      {(Object.keys(DIET_LABEL) as DietType[]).map((d) => (
        <OptionCard
          key={d}
          title={DIET_LABEL[d].title}
          description={DIET_LABEL[d].description}
          selected={value === d}
          onSelect={() =>
            void saveFoodSettings(db, { dietType: d })
              .then(onSaved)
              .catch((e: unknown) =>
                toast(e instanceof ProfileError ? e.message : 'Could not save. Try again.'),
              )
          }
        />
      ))}
    </div>
  );
}

/** What you eat, your own katori size, and the foods and recipes you added. */
export function FoodSettingsSheet({
  open,
  onClose,
  profile,
  customFoods,
  onEditFood,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  customFoods: CustomFood[];
  onEditFood: (food: CustomFood) => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Food settings" wide>
      {open ? (
        <SettingsBody
          profile={profile}
          customFoods={customFoods}
          onEditFood={onEditFood}
          onDone={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function SettingsBody({
  profile,
  customFoods,
  onEditFood,
  onDone,
}: {
  profile: Profile | null;
  customFoods: CustomFood[];
  onEditFood: (food: CustomFood) => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [katori, setKatori] = useState<number | null>(profile?.katoriMl ?? null);
  const [error, setError] = useState<string | null>(null);

  async function saveKatori(value: number | null) {
    try {
      await saveFoodSettings(db, { katoriMl: value });
      toast(value ? `Your katori: ${value} ml` : 'Standard katori sizes');
      onDone();
    } catch (e) {
      setError(e instanceof ProfileError ? e.message : 'Could not save. Try again.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="diet-title">
        <h3 id="diet-title" className="type-headline mb-2 text-text-1">
          What you eat
        </h3>
        <DietPicker value={profile?.dietType ?? null} />
      </section>

      <section aria-labelledby="katori-title">
        <h3 id="katori-title" className="type-headline text-text-1">
          Your katori
        </h3>
        <p className="type-meta mt-1 mb-3 text-text-2">
          Most steel katoris have their size stamped underneath. Or fill yours with water and pour
          it into a measuring cup. Every katori portion then uses your bowl. Standard sizes are 150,
          200 and 250 ml.
        </p>
        <div className="flex items-end gap-3">
          <NumberField
            label="Medium katori"
            value={katori}
            onValueChange={setKatori}
            min={80}
            max={500}
            unit="ml"
            error={error ?? undefined}
            className="flex-1"
          />
          <PrimaryButton onClick={() => void saveKatori(katori)} className="mb-0.5">
            Save
          </PrimaryButton>
        </div>
        {profile?.katoriMl ? (
          <TextLink small className="mt-2" onClick={() => void saveKatori(null)}>
            Use standard sizes
          </TextLink>
        ) : null}
      </section>

      <section aria-labelledby="mine-title">
        <h3 id="mine-title" className="type-headline mb-2 text-text-1">
          Your foods and recipes
        </h3>
        {customFoods.length ? (
          <ul className="flex flex-col gap-1">
            {customFoods.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-field bg-surface-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="type-headline block truncate text-text-1">{c.name}</span>
                  <span className="type-meta block text-text-2">
                    {c.kind === 'recipe' ? `Recipe, feeds ${c.servings}` : 'From a label'} ·{' '}
                    {Math.round(c.kcal)} kcal per 100 g
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Edit ${c.name}`}
                  onClick={() => onEditFood(c)}
                  className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full text-text-2"
                >
                  <Pencil className="size-5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${c.name}`}
                  onClick={() =>
                    void deleteCustomFood(db, c.id).then(() => toast(`Deleted ${c.name}`))
                  }
                  className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full text-text-2"
                >
                  <Trash2 className="size-5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-meta rounded-nested bg-surface-2 p-4 text-center text-text-2">
            Family recipes and packaged foods you add show here.
          </p>
        )}
      </section>
    </div>
  );
}
