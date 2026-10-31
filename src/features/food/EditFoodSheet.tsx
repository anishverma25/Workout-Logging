import { useState } from 'react';
import { BottomSheet, DestructiveButton, PrimaryButton, SegmentedControl } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import {
  measurePortion,
  deleteFoodLogs,
  FoodError,
  moveFoodLog,
  restoreFoodLogs,
  updateFoodLog,
  type FoodPortion,
} from '@/data/repositories/food';
import type { FoodLog } from '@/domain/models/schemas';
import { portionText } from '@/domain/nutrition/calc';
import { MEALS, type Meal } from '@/domain/nutrition/types';
import { NutritionPanel } from './FoodProfile';
import { NutrientLine, PortionEditor } from './PortionEditor';
import { MEAL_LABEL, type FoodContext } from './useFoodContext';

/** Change a logged food's portion, oil or meal, or delete it (with undo). */
export function EditFoodSheet({
  log,
  ctx,
  onClose,
}: {
  log: FoodLog | null;
  ctx: FoodContext;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={log !== null} onClose={onClose} title={log?.foodName ?? 'Food'}>
      {log ? <EditBody log={log} ctx={ctx} onDone={onClose} /> : null}
    </BottomSheet>
  );
}

function EditBody({ log, ctx, onDone }: { log: FoodLog; ctx: FoodContext; onDone: () => void }) {
  const toast = useToast();
  const food = ctx.foodById.get(log.foodId) ?? null;
  const [meal, setMeal] = useState<Meal>(log.meal);
  const [portion, setPortion] = useState<FoodPortion | null>(
    food && food.units.includes(log.unit)
      ? { food, amount: log.amount, unit: log.unit, size: log.size, oilLevel: log.oilLevel }
      : null,
  );
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!portion) return;
    setBusy(true);
    try {
      await updateFoodLog(db, log.id, portion, meal, ctx.katoriMl);
      onDone();
    } catch (e) {
      toast(e instanceof FoodError ? e.message : 'Could not save. Try again.');
      setBusy(false);
    }
  }

  async function remove() {
    await deleteFoodLogs(db, [log.id]);
    toast(`Removed ${log.foodName}`, {
      label: 'Undo',
      onSelect: () => void restoreFoodLogs(db, [log.id]),
    });
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl<Meal>
        label="Meal"
        block
        value={meal}
        onChange={setMeal}
        options={MEALS.map((m) => ({ value: m, label: MEAL_LABEL[m] }))}
      />
      {portion ? (
        <>
          <EditTotals portion={portion} ctx={ctx} />
          <PortionEditor
            portion={portion}
            onChange={setPortion}
            katoriMl={ctx.katoriMl}
            showTotals={false}
          />
        </>
      ) : (
        <div className="rounded-nested bg-surface-2 p-4">
          <NutrientLine
            kcal={log.kcal}
            proteinG={log.proteinG}
            carbsG={log.carbsG}
            fatG={log.fatG}
          />
          <p className="type-meta mt-1 text-text-2">
            This food is no longer in your list, so only its meal can change.
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <DestructiveButton block onClick={() => void remove()}>
          Delete
        </DestructiveButton>
        <PrimaryButton
          block
          loading={busy}
          onClick={() => (portion ? void save() : void moveFoodLog(db, log.id, meal).then(onDone))}
        >
          Save
        </PrimaryButton>
      </div>
    </div>
  );
}

function EditTotals({ portion, ctx }: { portion: FoodPortion; ctx: FoodContext }) {
  let m: ReturnType<typeof measurePortion> | null;
  try {
    m = measurePortion(portion, ctx.katoriMl);
  } catch {
    m = null;
  }
  if (!m) return null;
  return (
    <NutritionPanel
      nutrients={m.nutrients}
      grams={m.grams}
      portionLabel={portionText(portion.amount, portion.unit, portion.size, portion.food.pieceName)}
      per100={portion.food.per100}
      targets={ctx.targets}
    />
  );
}
