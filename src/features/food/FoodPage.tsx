import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Crown, Plus, Settings2, Target, UtensilsCrossed } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import { useFeature } from '@/app/entitlement';
import {
  Card,
  ErrorState,
  ListGroup,
  ListRow,
  PrimaryButton,
  ProgressBar,
  RingChart,
  SecondaryButton,
  Skeleton,
} from '@/components/kit';
import { loadMoreFoods } from '@/data/library/moreFoods';
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
import { haptic } from '@/lib/haptics';
import { useNow } from '@/lib/useNow';
import { EvidenceLink } from '../science/EvidenceLink';
import { AddFoodSheet } from './AddFoodSheet';
import { CustomFoodSheet } from './CustomFoodSheet';
import { DayAnalysisCard } from './DayAnalysisCard';
import { EditFoodSheet } from './EditFoodSheet';
import { DietPicker, FoodSettingsSheet } from './FoodSettingsSheet';
import { TargetsSheet } from './TargetsSheet';
import { DIET_LABEL } from './foodText';
import { NutrientLine } from './PortionEditor';
import { DayBalance } from './DayBalance';
import { DayNav } from './DayNav';
import { useDayParam } from './useDayParam';
import { MEAL_LABEL, mealForHour, useFoodContext, type FoodContext } from './useFoodContext';

const n = (v: number) => Math.round(v).toLocaleString('en-GB');

/**
 * Food: today's calories and protein against the person's targets, their meals, and logging
 * built for Indian home food (katori portions, oil levels, thalis, the usual meal in one tap).
 */
export function FoodPage() {
  useEffect(() => {
    void loadMoreFoods();
  }, []);
  const now = useNow();
  const ctx = useFoodContext(now);
  const [params] = useSearchParams();
  const { date, today, go, label: dayLabel } = useDayParam(now);
  // A meal's own + logs to that meal only; the main Add food button lets the person choose.
  const [adding, setAdding] = useState<{ meal: Meal; locked: boolean } | null>(
    params.get('add') === '1' ? { meal: mealForHour(now.getHours()), locked: false } : null,
  );
  const [editing, setEditing] = useState<FoodLog | null>(null);
  const [custom, setCustom] = useState<{ name: string; editing: CustomFood | null } | null>(null);
  const [settings, setSettings] = useState(false);
  const [targetsOpen, setTargetsOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Food"
        subtitle="Indian meals, katori portions, your numbers"
        actions={
          <PrimaryButton
            compact
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() =>
              setAdding({
                meal: date === today ? mealForHour(now.getHours()) : 'lunch',
                locked: false,
              })
            }
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
          {ctx.profile?.origin === 'user' && ctx.targets.mode === null ? (
            <Card as="section" aria-labelledby="targets-first" data-targets-prompt>
              <h2 id="targets-first" className="type-headline text-text-1">
                Set your daily targets
              </h2>
              <p className="type-meta mt-1 mb-3 text-text-2">
                Let Overload work out calories, protein, carbs, fat, fibre and water from your body
                and goal, or type your own.
              </p>
              <PrimaryButton compact onClick={() => setTargetsOpen(true)}>
                Choose how
              </PrimaryButton>
            </Card>
          ) : null}
          <DaySummary ctx={ctx} date={date} onTargets={() => setTargetsOpen(true)} />
          <DayBalance ctx={ctx} date={date} />
          <DayAnalysisCard ctx={ctx} date={date} now={now} />
          {date === today ? <ProteinHelp ctx={ctx} date={date} now={now} /> : null}
          {MEALS.map((m) => (
            <MealCard
              key={m}
              meal={m}
              ctx={ctx}
              date={date}
              onAdd={() => setAdding({ meal: m, locked: true })}
              onEdit={setEditing}
            />
          ))}
          <ListGroup label="Food settings">
            <li>
              <ListRow
                title="Daily targets"
                subtitle={
                  ctx.targets.mode === 'own'
                    ? 'Your own numbers'
                    : ctx.targets.mode === 'calculated'
                      ? 'Worked out for you'
                      : 'Not chosen yet'
                }
                leading={<Target className="size-5 text-text-2" aria-hidden />}
                chevron
                onClick={() => setTargetsOpen(true)}
              />
            </li>
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
        meal={adding?.meal ?? 'lunch'}
        lockMeal={adding?.locked ?? false}
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
      <TargetsSheet
        open={targetsOpen}
        onClose={() => setTargetsOpen(false)}
        profile={ctx.profile}
        energy={ctx.snapshot?.energy ?? null}
        weightKg={ctx.snapshot?.weightKg ?? null}
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

function DaySummary({
  ctx,
  date,
  onTargets,
}: {
  ctx: FoodContext;
  date: string;
  onTargets: () => void;
}) {
  const totals = dayTotals(ctx.logs, date);
  const { kcal, proteinG } = ctx.targets;
  const rings = [
    { label: 'Calories', value: totals.kcal, max: kcal ?? 0 },
    { label: 'Protein', value: totals.proteinG, max: proteinG ?? 0 },
  ];
  const bars = [
    { label: 'Carbs', value: totals.carbsG, target: ctx.targets.carbsG },
    { label: 'Fat', value: totals.fatG, target: ctx.targets.fatG },
    { label: 'Fibre', value: totals.fibreG, target: ctx.targets.fibreG },
  ];
  return (
    <Card as="section" aria-labelledby="day-totals" data-day-totals>
      <div className="flex items-center gap-5">
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
          <p className="mt-1 flex items-baseline gap-1">
            <span className="type-title tabular font-bold text-text-1">
              {totals.proteinG.toFixed(0)} g
            </span>
            <span className="type-meta text-text-2">
              protein{proteinG !== null ? ` of ${n(proteinG)} g` : ''}
            </span>
          </p>
        </div>
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-3" data-macro-bars>
        {bars.map((b) => (
          <li key={b.label} className="min-w-0">
            <p className="type-meta text-text-2">{b.label}</p>
            <p className="type-headline tabular text-text-1">
              {b.value.toFixed(0)} g
              {b.target !== null ? (
                <span className="type-meta font-normal text-text-2"> of {n(b.target)}</span>
              ) : null}
            </p>
            {b.target ? (
              <ProgressBar value={Math.min(b.value, b.target)} max={b.target} label={b.label} />
            ) : null}
          </li>
        ))}
      </ul>
      {kcal === null ? (
        <button
          type="button"
          onClick={onTargets}
          className="type-meta mt-3 inline-block font-semibold text-text-1 underline"
        >
          Set your targets
        </button>
      ) : (
        <p className="type-caption mt-3 text-text-2">
          Targets: {ctx.targets.mode === 'own' ? 'your own' : 'worked out for you'}.{' '}
          <button type="button" onClick={onTargets} className="font-semibold text-text-1 underline">
            Change
          </button>
        </p>
      )}
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
              <strong className="font-semibold text-text-1">{n(total.kcal)} kcal</strong> ·{' '}
              <strong className="font-semibold text-text-1">{total.proteinG.toFixed(0)} g</strong>{' '}
              protein
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
                  value={
                    <span className="flex flex-col items-end">
                      <span className="type-headline tabular text-text-1">{n(l.kcal)} kcal</span>
                      <span className="type-caption tabular text-text-2">
                        {l.proteinG.toFixed(0)} g protein
                      </span>
                    </span>
                  }
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
