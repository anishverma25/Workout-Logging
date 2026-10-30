import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Plus, Settings2, Target, UtensilsCrossed } from 'lucide-react';
import { PageHeader } from '@/app/layout/PageHeader';
import {
  Card,
  ErrorState,
  IconButton,
  ListGroup,
  ListRow,
  Metric,
  PrimaryButton,
  ProgressBar,
  Skeleton,
  TextButton,
} from '@/components/kit';
import { loadMoreFoods } from '@/data/library/moreFoods';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { copyFoodLogs, deleteFoodLogs } from '@/data/repositories/food';
import type { CustomFood, FoodLog } from '@/domain/models/schemas';
import { dayTotals, mealsOn, mealTemplates } from '@/domain/nutrition/analysis';
import { portionText, roundNutrients, sumNutrients } from '@/domain/nutrition/calc';
import { MEALS, type Meal } from '@/domain/nutrition/types';
import { haptic } from '@/lib/haptics';
import { cn } from '@/lib/cn';
import { addDays, toDateKey } from '@/lib/dates';
import { useNow } from '@/lib/useNow';
import { AddFoodSheet } from './AddFoodSheet';
import { CustomFoodSheet } from './CustomFoodSheet';
import { DayAnalysisCard } from './DayAnalysisCard';
import { EditFoodSheet } from './EditFoodSheet';
import { DietPicker, FoodSettingsSheet } from './FoodSettingsSheet';
import { TargetsSheet } from './TargetsSheet';
import { DIET_LABEL } from './foodText';
import { WaterCard } from './WaterTab';
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
        actions={
          // A + in the header instead of a lime pill (UI v3, S10.1).
          <IconButton
            label="Add food"
            icon={<Plus className="size-5" aria-hidden />}
            onClick={() =>
              setAdding({
                meal: date === today ? mealForHour(now.getHours()) : 'lunch',
                locked: false,
              })
            }
            data-add-food
          />
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
        <div className="flex max-w-3xl flex-col gap-6" data-food-page>
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
          <DayAnalysisCard ctx={ctx} date={date} now={now} />
          <section aria-labelledby="meals-title">
            <h2 id="meals-title" className="type-section mb-2 text-text-1">
              Meals
            </h2>
            {/* The four meals as rows of one group (UI v3, S10.4). */}
            <div className="divide-y-[0.5px] divide-divider rounded-card bg-surface px-4">
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
            </div>
          </section>
          <WaterCard ctx={ctx} date={date} />
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
                title="How the numbers work"
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
  const left = kcal !== null ? kcal - totals.kcal : null;
  const bars = [
    { label: 'Protein', value: totals.proteinG, target: proteinG },
    { label: 'Carbs', value: totals.carbsG, target: ctx.targets.carbsG },
    { label: 'Fat', value: totals.fatG, target: ctx.targets.fatG },
    { label: 'Fibre', value: totals.fibreG, target: ctx.targets.fibreG },
  ];
  return (
    <section aria-labelledby="day-totals" data-day-totals>
      <div className="rounded-card bg-surface p-4">
        <h2 id="day-totals" className="sr-only">
          Totals
        </h2>
        {/* What is left leads (UI v3, S10.3); the ring fills as food is logged. */}
        <div className="flex items-center gap-4">
          <CalorieRing eaten={totals.kcal} target={kcal} />
          {left !== null ? (
            <Metric
              tier="hero"
              accentLabel
              label={left >= 0 ? 'Left today' : 'Over today'}
              value={n(Math.abs(left))}
              unit="kcal"
              className="[&_[data-metric]]:text-[3rem] [&_[data-metric]]:leading-[3.25rem]"
            >
              <p className="type-meta tabular mt-0.5 text-text-2">
                of {n(kcal!)} kcal · {n(totals.kcal)} eaten
              </p>
            </Metric>
          ) : (
            <Metric
              tier="hero"
              label="Eaten today"
              value={n(totals.kcal)}
              unit="kcal"
              className="[&_[data-metric]]:text-[3rem] [&_[data-metric]]:leading-[3.25rem]"
            />
          )}
        </div>
        <ul className="mt-4 grid grid-cols-4 gap-3" data-macro-bars>
          {bars.map((b) => {
            const met = b.label === 'Protein' && b.target !== null && b.value >= b.target;
            return (
              <li key={b.label} className="min-w-0">
                <p className="type-meta font-semibold text-text-2">{b.label}</p>
                <p className="type-headline tabular whitespace-nowrap text-text-1">
                  {b.value.toFixed(0)} g
                </p>
                {b.target !== null ? (
                  <p className="type-caption tabular text-text-2">of {n(b.target)} g</p>
                ) : null}
                {b.target ? (
                  <ProgressBar
                    value={Math.min(b.value, b.target)}
                    max={b.target}
                    label={b.label}
                    thickness={4}
                    className={cn('mt-1', !met && '[&>div]:bg-text-1/85')}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      {kcal === null ? (
        <p className="type-meta mt-2 px-4">
          <TextButton small onClick={onTargets}>
            Set your targets
          </TextButton>
        </p>
      ) : (
        <p className="type-meta mt-2 flex flex-wrap items-center gap-x-1 px-4 text-text-2">
          Targets {ctx.targets.mode === 'own' ? 'your own' : 'worked out for you'} ·
          <TextButton small onClick={onTargets}>
            Change
          </TextButton>
        </p>
      )}
    </section>
  );
}

/** A ring that fills as food is logged; its track is always visible, never a grey disc. */
function CalorieRing({ eaten, target }: { eaten: number; target: number | null }) {
  const size = 84;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = target ? Math.min(1, Math.max(0, eaten / target)) : 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      role="img"
      aria-label={target ? `${Math.round(f * 100)}% of today's calories` : 'Calories today'}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--lime)"
        strokeOpacity={0.16}
        strokeWidth={stroke}
      />
      {f > 0 ? (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--lime)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          className="ring-arc"
        />
      ) : null}
    </svg>
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
  // An empty meal offers the usual one, or else the last time it was eaten (UI v3, O1).
  const templates = items.length === 0 ? mealTemplates(ctx.logs, meal, date) : [];
  const usual = templates.find((t) => t.kind === 'usual');
  const previous = usual ? undefined : templates.find((t) => t.kind === 'previous');
  const offer = usual ?? previous;
  const yesterday = toDateKey(addDays(new Date(`${date}T12:00:00`), -1));
  const offerLabel = usual ? 'Usual' : previous?.date === yesterday ? 'Yesterday' : 'Last time';
  const id = `meal-${meal}`;
  return (
    <section aria-labelledby={id} data-meal={meal} className="py-3">
      <div className="flex items-center gap-3">
        <h3 id={id} className="type-headline min-w-0 flex-1 text-text-1">
          {MEAL_LABEL[meal]}
        </h3>
        {items.length ? (
          <span className="type-subhead tabular shrink-0 text-text-2">
            <strong className="type-metric-sm text-text-1">{n(total.kcal)}</strong> kcal ·{' '}
            {total.proteinG.toFixed(0)} g protein
          </span>
        ) : null}
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add food to ${MEAL_LABEL[meal].toLowerCase()}`}
          className="pressable tap-target inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-fill text-text-1"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      {items.length ? (
        <ul className="mt-1 flex flex-col">
          {items.map((l) => {
            const food = ctx.foodById.get(l.foodId);
            const portion = portionText(l.amount, l.unit, l.size, food?.pieceName);
            const oil = l.oilLevel && l.oilLevel !== 'normal' ? ` · ${l.oilLevel} oil` : '';
            return (
              <li key={l.id}>
                <ListRow
                  title={<span className="font-normal">{l.foodName}</span>}
                  subtitle={`${portion}${oil}`}
                  wrap
                  value={
                    <span className="flex flex-col items-end">
                      <span className="type-subhead tabular text-text-1">{n(l.kcal)} kcal</span>
                      <span className="type-caption tabular text-text-2">
                        {l.proteinG.toFixed(0)} g protein
                      </span>
                    </span>
                  }
                  onClick={() => onEdit(l)}
                  className="pl-3"
                />
              </li>
            );
          })}
        </ul>
      ) : offer ? (
        <button
          type="button"
          className="pressable chrome type-meta mt-2 inline-flex h-8 max-w-full items-center gap-1.5 rounded-full bg-fill px-3 text-text-1"
          data-usual={meal}
          aria-label={`Log ${offerLabel.toLowerCase()} ${MEAL_LABEL[meal].toLowerCase()}: ${offer.items.map((i) => i.foodName).join(', ')}`}
          onClick={() =>
            void copyFoodLogs(db, offer.items, { date, meal }).then((logs) => {
              haptic('medium');
              const what = MEAL_LABEL[meal].toLowerCase();
              toast(
                usual
                  ? `Logged your usual ${what}`
                  : offerLabel === 'Yesterday'
                    ? `Logged yesterday's ${what} again`
                    : `Logged your last ${what} again`,
                {
                  label: 'Undo',
                  onSelect: () =>
                    void deleteFoodLogs(
                      db,
                      logs.map((x) => x.id),
                    ),
                },
              );
            })
          }
        >
          <span className="truncate">
            {offerLabel} · {offer.items.map((i) => i.foodName).join(', ')}
          </span>
          <span className="shrink-0 font-semibold text-lime">Log</span>
        </button>
      ) : (
        <p className="type-subhead mt-0.5 text-text-2">Nothing logged yet</p>
      )}
    </section>
  );
}
