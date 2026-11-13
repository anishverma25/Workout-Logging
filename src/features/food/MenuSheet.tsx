import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { Camera, Image as ImageIcon, Plus } from 'lucide-react';
import { useCoachStore } from '@/app/coach';
import { useFeature } from '@/app/entitlement';
import { askFoodMenu, FoodAiError } from '@/app/foodAi';
import { BottomSheet, PrimaryButton, SecondaryButton } from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { deleteFoodLogs, logFoods } from '@/data/repositories/food';
import { portionText } from '@/domain/nutrition/calc';
import { rankMenu, type MenuMatch } from '@/domain/nutrition/solver';
import type { Meal } from '@/domain/nutrition/types';
import { LABEL_MAX_SIDE, preparePhoto } from '@/lib/photo';
import { CoachConsent } from '../coach/CoachParts';
import { MEAL_LABEL, type FoodContext } from './useFoodContext';

const VERDICT: Record<MenuMatch['verdict'], string> = {
  best: 'Best for what is left',
  fits: 'Fits',
  over: 'Over what is left',
  unknown: 'Not in the food library',
};

/**
 * Read a menu (Pro): a photo of a restaurant or mess menu. The AI reads the dish names only;
 * each number shown is the food library's for that dish at its usual portion.
 */
export function MenuSheet({
  open,
  onClose,
  ctx,
  remaining,
  date,
  meal,
}: {
  open: boolean;
  onClose: () => void;
  ctx: FoodContext;
  remaining: { kcal: number; proteinG: number };
  date: string;
  meal: Meal;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Read a menu"
      subtitle="Dish names from the photo, numbers from the library"
      tall
    >
      {open ? <Body ctx={ctx} remaining={remaining} date={date} meal={meal} /> : null}
    </BottomSheet>
  );
}

function Body({
  ctx,
  remaining,
  date,
  meal,
}: {
  ctx: FoodContext;
  remaining: { kcal: number; proteinG: number };
  date: string;
  meal: Meal;
}) {
  const pro = useFeature('ai_food');
  const store = useCoachStore();
  const toast = useToast();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'reading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MenuMatch[] | null>(null);

  async function read(file: File | undefined) {
    if (!file) return;
    setState('reading');
    setError(null);
    try {
      const photo = await preparePhoto(file, LABEL_MAX_SIDE, 0.9);
      URL.revokeObjectURL(photo.url);
      const { dishes } = await askFoodMenu({ image: photo.data, mime: photo.mime });
      setMatches(
        rankMenu({ dishes, foods: ctx.foods, remaining, diet: ctx.diet, katoriMl: ctx.katoriMl }),
      );
    } catch (e) {
      setError(
        e instanceof FoodAiError
          ? e.message
          : 'The menu could not be read. Try again, or search for the dish.',
      );
    } finally {
      setState('idle');
    }
  }
  const input = (ref: React.RefObject<HTMLInputElement | null>, capture: boolean) => (
    <input
      ref={ref}
      {...(capture ? {} : { 'data-menu-input': true })}
      type="file"
      accept="image/*"
      {...(capture ? { capture: 'environment' as const } : {})}
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={(e) => {
        void read(e.target.files?.[0]);
        e.target.value = '';
      }}
    />
  );

  if (!pro)
    return (
      <div className="flex flex-col gap-3" data-menu-locked>
        <p className="type-body text-text-1">
          Photograph any menu and see which dishes fit what you have left today.
        </p>
        <p className="type-subhead text-text-2">
          Reading menus comes with Pro.{' '}
          <Link to="/pro" className="font-semibold text-lime">
            See Pro
          </Link>
        </p>
      </div>
    );
  if (!store.consent) return <CoachConsent />;

  const add = async (m: MenuMatch) => {
    if (!m.portion) return;
    const p = m.portion;
    const logs = await logFoods(
      db,
      [{ food: p.food, amount: p.amount, unit: p.unit, size: p.size, oilLevel: null }],
      {
        date,
        meal,
        katoriMl: ctx.katoriMl,
      },
    );
    toast(`Logged ${p.food.name} to ${MEAL_LABEL[meal].toLowerCase()}`, {
      label: 'Undo',
      onSelect: () =>
        void deleteFoodLogs(
          db,
          logs.map((l) => l.id),
        ),
    });
  };

  return (
    <div className="flex flex-col gap-4" data-menu>
      <p className="type-subhead text-text-2">
        {remaining.kcal.toLocaleString('en-IN')} kcal
        {remaining.proteinG > 0 ? ` and ${remaining.proteinG} g protein` : ''} left today.
        Restaurant portions and oil vary, so treat these as the usual home portion.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {input(camera, true)}
        {input(gallery, false)}
        <PrimaryButton
          block
          icon={<Camera className="size-4" aria-hidden />}
          onClick={() => camera.current?.click()}
          loading={state === 'reading'}
        >
          Take photo
        </PrimaryButton>
        <SecondaryButton
          block
          icon={<ImageIcon className="size-4" aria-hidden />}
          onClick={() => gallery.current?.click()}
          disabled={state === 'reading'}
        >
          Choose photo
        </SecondaryButton>
      </div>
      {error ? (
        <p role="alert" className="type-footnote text-danger-text">
          {error}
        </p>
      ) : null}
      {matches ? (
        <ul className="divide-y-[0.5px] divide-divider" data-menu-results>
          {matches.map((m) => (
            <li key={m.dish} className="flex items-center gap-3 py-3" data-menu-dish={m.verdict}>
              <div className="min-w-0 flex-1">
                <p className="type-headline text-text-1">{m.dish}</p>
                {m.portion ? (
                  <p className="type-footnote tabular text-text-2">
                    {m.portion.food.name},{' '}
                    {portionText(
                      m.portion.amount,
                      m.portion.unit,
                      m.portion.size,
                      m.portion.food.pieceName,
                    )}{' '}
                    · {Math.round(m.portion.nutrients.kcal)} kcal ·{' '}
                    {Math.round(m.portion.nutrients.proteinG)} g protein
                  </p>
                ) : null}
                <p
                  className={
                    m.verdict === 'best'
                      ? 'type-footnote font-semibold text-lime'
                      : 'type-footnote text-text-2'
                  }
                >
                  {VERDICT[m.verdict]}
                </p>
              </div>
              {m.portion ? (
                <button
                  type="button"
                  className="pressable chrome tap-target flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-lime"
                  aria-label={`Add ${m.portion.food.name}`}
                  onClick={() => void add(m)}
                >
                  <Plus className="size-5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
