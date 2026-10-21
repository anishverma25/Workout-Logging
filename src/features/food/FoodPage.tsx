import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, Crown, Plus, Settings2, UtensilsCrossed } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { useFeature } from '@/app/entitlement';
import {
  Card,
  ErrorState,
  ListGroup,
  ListRow,
  PrimaryButton,
  RingChart,
  SecondaryButton,
  Skeleton,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { copyFoodLogs, deleteFoodLogs, logFoods } from '@/data/repositories/food';
import type { CustomFood, FoodLog } from '@/domain/models/schemas';
import {
  dayTotals,
  mealsOn,
  mealTemplates,
  proteinSuggestions,
  recentFoods,
} from '@/domain/nutrition/analysis';
import { portionText, roundNutrients, sumNutrients } from '@/domain/nutrition/calc';
import { MEALS, type Meal } from '@/domain/nutrition/types';
import { addDays, formatRelativeDay, toDateKey } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/useNow';
import { EvidenceLink } from '../science/EvidenceLink';
import { AddFoodSheet } from './AddFoodSheet';
import { CustomFoodSheet } from './CustomFoodSheet';
import { EditFoodSheet } from './EditFoodSheet';
import { DietPicker, FoodSettingsSheet } from './FoodSettingsSheet';
import { DIET_LABEL } from './foodText';
import { NutrientLine } from './PortionEditor';
import { MEAL_LABEL, mealForHour, useFoodContext, type FoodContext } from './useFoodContext';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * Food: today's calories and protein against the person's targets, their meals, and logging
 * built for Indian home food (katori portions, oil levels, thalis, the usual meal in one tap).
 */
export function FoodPage() {
  const now = useNow();
  const ctx = useFoodContext(now);
  const [params, setParams] = useSearchParams();
  const today = toDateKey(now);
  const requested = params.get('date');
  const date =
    requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) && requested <= today ? requested : today;
  const [adding, setAdding] = useState<Meal | null>(
    params.get('add') === '1' ? mealForHour(now.getHours()) : null,
  );
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [custom, setCustom] = useState<{ name: string; editing: CustomFood | null } | null>(null);
  const [settings, setSettings] = useState(false);

  const go = (days: number) => {
    const next = toDateKey(addDays(new Date(`${date}T12:00:00`), days));
    setParams(next === today ? {} : { date: next }, { replace: true });
  };

  const dayLabel = date === today ? 'Today' : formatRelativeDay(new Date(`${date}T12:00:00`), now);

  return (
    <>
      <PageHeader
        title="Food"
        subtitle="Indian meals, katori portions, your numbers"
        actions={
          <PrimaryButton
            compact
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() => setAdding(date === today ? mealForHour(now.getHours()) : 'lunch')}
            data-add-food
          >
            Add food
          </PrimaryButton>
        }
      />
      {ctx.status === 'loading' ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading your food">
          <Skeleton height={176} radius="panel" />
          <Skeleton height={256} radius="panel" />
        </div>
      ) : null}
      {ctx.status === 'error' ? (
        <ErrorState
          title="Food could not load"
          message={ctx.error?.message}
          onRetry={() => window.location.reload()}
        />
      ) : null}
      {ctx.status === 'success' ? (
        <div className="flex max-w-3xl flex-col gap-4" data-food-page>
          <DayNav
            label={dayLabel}
            onPrev={() => go(-1)}
            onNext={date < today ? () => go(1) : null}
          />
          {ctx.profile?.origin === 'user' && !ctx.profile.dietType ? (
            <Card as="section" aria-labelledby="diet-first">
              <h2 id="diet-first" className="type-headline text-text-1">
                What do you eat?
              </h2>
              <p className="type-meta mt-1 mb-3 text-text-2">
                Search and suggestions then show only foods that fit.
              </p>
              <DietPicker value={null} />
            </Card>
          ) : null}
          <DaySummary ctx={ctx} date={date} />
          {date === today ? <ProteinHelp ctx={ctx} date={date} now={now} /> : null}
          {MEALS.map((m) => (
            <MealCard
              key={m}
              meal={m}
              ctx={ctx}
              date={date}
              onAdd={() => setAdding(m)}
              onEdit={setEditing}
            />
          ))}
          <ListGroup label="Food settings">
            <li>
              <ListRow
                title="Food settings"
                subtitle={[
                  ctx.diet ? DIET_LABEL[ctx.diet].title : 'Diet not set',
                  ctx.katoriMl ? `your katori ${ctx.katoriMl} ml` : 'standard katori',
                  `${ctx.customFoods.length} of your own foods`,
                ].join(' · ')}
                leading={<Settings2 className="size-5 text-text-2" aria-hidden />}
                chevron
                onClick={() => setSettings(true)}
              />
            </li>
            <li>
              <ListRow
                title="How food numbers are worked out"
                subtitle="Home recipes, USDA ingredient values, your own katori"
                leading={<UtensilsCrossed className="size-5 text-text-2" aria-hidden />}
                chevron
                to="/science#food-values"
              />
            </li>
          </ListGroup>
        </div>
      ) : null}

      <AddFoodSheet
        open={adding !== null}
        onClose={() => setAdding(null)}
        ctx={ctx}
        date={date}
        meal={adding ?? 'lunch'}
        onCreateFood={(name) => {
          setAdding(null);
          setCustom({ name, editing: null });
        }}
      />
      <EditFoodSheet log={editing} ctx={ctx} onClose={() => setEditing(null)} />
      <CustomFoodSheet
        open={custom !== null}
        onClose={() => setCustom(null)}
        initialName={custom?.name}
        editing={custom?.editing}
      />
      <FoodSettingsSheet
        open={settings}
        onClose={() => setSettings(false)}
        profile={ctx.profile}
        customFoods={ctx.customFoods}
        onEditFood={(food) => {
          setSettings(false);
          setCustom({ name: food.name, editing: food });
        }}
      />
    </>
  );
}

function DayNav({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: (() => void) | null;
}) {
  const btn =
    'pressable tap-target inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-text-1 disabled:opacity-40';
  return (
    <div className="flex items-center justify-between gap-3">
      <button type="button" className={btn} onClick={onPrev} aria-label="Previous day">
        <ChevronLeft className="size-5" aria-hidden />
      </button>
      <h2 className="type-headline text-text-1" aria-live="polite" data-food-day>
        {label}
      </h2>
      <button
        type="button"
        className={btn}
        onClick={onNext ?? undefined}
        disabled={!onNext}
        aria-label="Next day"
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}

function DaySummary({ ctx, date }: { ctx: FoodContext; date: string }) {
  const totals = dayTotals(ctx.logs, date);
  const { kcal, proteinG } = ctx.targets;
  const rings = [
    { label: 'Calories', value: totals.kcal, max: kcal ?? 0 },
    { label: 'Protein', value: totals.proteinG, max: proteinG ?? 0 },
  ];
  return (
    <Card
      as="section"
      aria-labelledby="day-totals"
      className="flex items-center gap-5"
      data-day-totals
    >
      {kcal !== null || proteinG !== null ? (
        <RingChart rings={rings} size={112} label="Today against your targets" />
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 id="day-totals" className="sr-only">
          Totals
        </h2>
        <p className="flex items-baseline gap-1">
          <span className="type-stat tabular text-text-1">{n(totals.kcal)}</span>
          <span className="type-meta text-text-2">
            {kcal !== null ? `of ${n(kcal)} kcal` : 'kcal'}
          </span>
        </p>
        <p className="type-meta mt-0.5 text-text-2">
          <span className="tabular font-semibold text-text-1">{totals.proteinG.toFixed(0)} g</span>{' '}
          protein
          {proteinG !== null ? ` of ${proteinG} g` : ''}
        </p>
        <p className="type-meta mt-0.5 tabular text-text-2">
          {totals.carbsG.toFixed(0)} g carbs · {totals.fatG.toFixed(0)} g fat ·{' '}
          {totals.fibreG.toFixed(0)} g fibre
        </p>
        {kcal === null ? (
          <Link
            to="/body"
            className="type-meta mt-1 inline-block font-semibold text-text-1 underline"
          >
            Set your targets on Body
          </Link>
        ) : (
          <p className="type-caption mt-1 text-text-2">
            Targets: {ctx.targets.kcalSource === 'set' ? 'your own' : 'calculated for you'}
          </p>
        )}
      </div>
    </Card>
  );
}

/** Pro: what would close today's protein gap, from foods that fit the person's diet. */
function ProteinHelp({ ctx, date, now }: { ctx: FoodContext; date: string; now: Date }) {
  const pro = useFeature('food_insights');
  const toast = useToast();
  const totals = dayTotals(ctx.logs, date);
  const target = ctx.targets.proteinG;
  const eaten = useMemo(() => new Set(recentFoods(ctx.logs, 40).map((l) => l.foodId)), [ctx.logs]);
  if (target === null || totals.kcal === 0) return null;
  const gap = Math.round(target - totals.proteinG);
  const ideas = proteinSuggestions({
    gapG: gap,
    diet: ctx.diet,
    foods: ctx.foodById,
    eatenIds: eaten,
    katoriMl: ctx.katoriMl,
  });
  if (!ideas.length) return null;
  return (
    <Card as="section" aria-labelledby="protein-help" data-protein-help>
      <div className="flex items-center gap-2">
        <h2 id="protein-help" className="type-headline text-text-1">
          {gap} g protein to go
        </h2>
        <EvidenceLink topic="protein" about="protein targets" />
      </div>
      {pro ? (
        <ul className="mt-3 flex flex-col gap-2">
          {ideas.map((s) => (
            <li key={s.food.id} className="flex items-center gap-3 rounded-nested bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="type-headline text-text-1">
                  {portionText(s.amount, s.unit, 'medium', s.food.pieceName)}
                  {s.unit === 'piece' && s.food.pieceName ? '' : ` ${s.food.name.toLowerCase()}`}
                </p>
                <NutrientLine kcal={s.nutrients.kcal} proteinG={s.nutrients.proteinG} />
              </div>
              <SecondaryButton
                compact
                onClick={() =>
                  void logFoods(
                    db,
                    [
                      {
                        food: s.food,
                        amount: s.amount,
                        unit: s.unit,
                        size: s.unit === 'katori' ? 'medium' : null,
                        oilLevel: null,
                      },
                    ],
                    { date, meal: mealForHour(now.getHours()), katoriMl: ctx.katoriMl },
                  ).then((logs) => {
                    haptic('medium');
                    toast(`Logged ${s.food.name}`, {
                      label: 'Undo',
                      onSelect: () =>
                        void deleteFoodLogs(
                          db,
                          logs.map((l) => l.id),
                        ),
                    });
                  })
                }
              >
                Apply
              </SecondaryButton>
            </li>
          ))}
        </ul>
      ) : (
        <Link
          to="/pro"
          className="type-meta mt-2 inline-flex items-center gap-1.5 font-semibold text-text-2"
          data-pro-lock="food_insights"
        >
          <Crown className="size-4" aria-hidden />
          Pro suggests foods you eat that close it, in one tap
        </Link>
      )}
    </Card>
  );
}

function MealCard({
  meal,
  ctx,
  date,
  onAdd,
  onEdit,
}: {
  meal: Meal;
  ctx: FoodContext;
  date: string;
  onAdd: () => void;
  onEdit: (log: FoodLog) => void;
}) {
  const toast = useToast();
  const items = mealsOn(ctx.logs, date)[meal];
  const total = roundNutrients(
    sumNutrients(
      items.map((i) => ({
        kcal: i.kcal,
        proteinG: i.proteinG,
        carbsG: i.carbsG,
        fatG: i.fatG,
        fibreG: i.fibreG,
      })),
    ),
  );
  const usual =
    items.length === 0
      ? mealTemplates(ctx.logs, meal, date).find((t) => t.kind === 'usual')
      : undefined;
  const id = `meal-${meal}`;
  return (
    <Card as="section" aria-labelledby={id} data-meal={meal}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="type-title text-text-1">
          {MEAL_LABEL[meal]}
        </h2>
        <div className="flex items-center gap-3">
          {items.length ? (
            <span className="type-meta tabular text-text-2">
              {n(total.kcal)} kcal · {total.proteinG.toFixed(0)} g protein
            </span>
          ) : null}
          <button
            type="button"
            onClick={onAdd}
            aria-label={`Add food to ${MEAL_LABEL[meal].toLowerCase()}`}
            className="pressable tap-target inline-flex size-9 items-center justify-center rounded-full bg-surface-2 text-text-1"
          >
            <Plus className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      {items.length ? (
        <ul className="mt-2 flex flex-col">
          {items.map((l) => {
            const food = ctx.foodById.get(l.foodId);
            const portion = portionText(l.amount, l.unit, l.size, food?.pieceName);
            const oil = l.oilLevel && l.oilLevel !== 'normal' ? ` · ${l.oilLevel} oil` : '';
            return (
              <li key={l.id}>
                <ListRow
                  title={l.foodName}
                  subtitle={`${portion}${oil}`}
                  value={`${n(l.kcal)} kcal`}
                  onClick={() => onEdit(l)}
                  className="px-1"
                />
              </li>
            );
          })}
        </ul>
      ) : usual ? (
        <div
          className="mt-3 flex items-center gap-3 rounded-nested bg-surface-2 p-3"
          data-usual={meal}
        >
          <p className="type-meta min-w-0 flex-1 truncate text-text-2">
            Your usual: {usual.items.map((i) => i.foodName).join(', ')}
          </p>
          <SecondaryButton
            compact
            onClick={() =>
              void copyFoodLogs(db, usual.items, { date, meal }).then((logs) => {
                haptic('medium');
                toast(`Logged your usual ${MEAL_LABEL[meal].toLowerCase()}`, {
                  label: 'Undo',
                  onSelect: () =>
                    void deleteFoodLogs(
                      db,
                      logs.map((x) => x.id),
                    ),
                });
              })
            }
          >
            Log
          </SecondaryButton>
        </div>
      ) : (
        <p className="type-meta mt-2 text-text-2">Nothing logged yet.</p>
      )}
    </Card>
  );
}
