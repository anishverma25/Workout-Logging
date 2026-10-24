import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, RotateCcw, Sparkles } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '@/components/kit';
import { useCoachStore } from '@/app/coach';
import {
  askFoodPhoto,
  FoodAiError,
  PHOTO_LIMITS,
  PHOTOS_PER_DAY,
  type FoodItem,
} from '@/app/foodAi';
import { STARTER_FOODS } from '@/data/library/foods';
import type { FoodPortion } from '@/data/repositories/food';
import type { Meal } from '@/domain/nutrition/types';
import { cn } from '@/lib/cn';
import { preparePhoto, type PreparedPhoto } from '@/lib/photo';
import { AiByline, CoachConsent, Thinking } from '../coach/CoachParts';
import { AiItemRow } from './AiItemRow';
import { knownNames, portionForItem } from './aiMatch';
import type { FoodContext } from './useFoodContext';

/**
 * Snap your plate (Pro). The photo is resized on the phone and sent once with an optional note;
 * the server checks Pro and today's allowance, asks the AI to name each food and judge its amount
 * from things of known size (plate, katori, roti), and checks every number. Foods the library
 * knows use the library's tested values; unsure items are marked to check. Nothing is logged
 * until the person puts it on the plate, and the photo is not kept anywhere.
 */

type State =
  | { kind: 'pick' }
  | { kind: 'ready' }
  | { kind: 'asking' }
  | { kind: 'done'; rows: { portion: FoodPortion; item: FoodItem }[]; left: number | null }
  | { kind: 'error'; message: string; limit: boolean };

export function PhotoFoodLog({
  ctx,
  meal,
  onFill,
  onType,
}: {
  ctx: FoodContext;
  meal: Meal;
  onFill: (items: FoodPortion[]) => void;
  onType: () => void;
}) {
  const store = useCoachStore();
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [note, setNote] = useState('');
  const [state, setState] = useState<State>({ kind: 'pick' });
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  // The preview is a local blob; let it go when the photo changes or the sheet closes.
  useEffect(() => () => (photo ? URL.revokeObjectURL(photo.url) : undefined), [photo]);

  if (!store.consent) return <CoachConsent />;

  async function choose(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await preparePhoto(file));
      setState({ kind: 'ready' });
    } catch {
      setState({
        kind: 'error',
        message: 'That photo could not be opened. Try another one.',
        limit: false,
      });
    }
  }

  async function analyse() {
    if (!photo) return;
    setState({ kind: 'asking' });
    try {
      const { items, left } = await askFoodPhoto({
        image: photo.data,
        mime: photo.mime,
        note,
        diet: ctx.diet,
        known: knownNames(ctx, STARTER_FOODS[meal]),
      });
      setState({
        kind: 'done',
        rows: items.map((item) => ({ item, portion: portionForItem(item, ctx) })),
        left,
      });
    } catch (e) {
      setState({
        kind: 'error',
        message:
          e instanceof FoodAiError
            ? e.message
            : 'OverloadGPT could not be reached. Check your connection and try again.',
        limit: e instanceof FoodAiError && e.code === 'photo_limit',
      });
    }
  }

  const inputs = (
    <>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a photo of your food"
        data-photo-input
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </>
  );

  const pickButtons = (
    <div className="grid grid-cols-2 gap-2">
      <PrimaryButton
        block
        onClick={() => camera.current?.click()}
        icon={<Camera className="size-4" aria-hidden />}
      >
        Take a photo
      </PrimaryButton>
      <SecondaryButton
        block
        onClick={() => gallery.current?.click()}
        icon={<ImagePlus className="size-4" aria-hidden />}
      >
        From gallery
      </SecondaryButton>
    </div>
  );

  return (
    <div className="flex flex-col gap-3" data-photo-food>
      {inputs}
      {photo ? (
        <img
          src={photo.url}
          alt="Your food"
          className={cn(
            'w-full rounded-nested bg-surface-2 object-contain',
            state.kind === 'done' ? 'max-h-36' : 'max-h-64',
          )}
        />
      ) : (
        <div className="rounded-nested bg-surface-2 p-4">
          <p className="type-headline text-text-1">For the best result</p>
          <ul className="type-meta mt-2 flex list-disc flex-col gap-1 pl-5 text-text-2">
            <li>Shoot from above, with the whole plate or thali in the frame.</li>
            <li>Good light and nothing covering the food give the best result.</li>
            <li>Packaged food? Go back and use From a pack: it reads the label exactly.</li>
          </ul>
        </div>
      )}

      {state.kind === 'pick' ? pickButtons : null}

      {state.kind === 'ready' ? (
        <>
          <label className="type-meta text-text-2" htmlFor="photo-note">
            Add a note if you like. It makes the result more accurate.
          </label>
          <textarea
            id="photo-note"
            value={note}
            maxLength={PHOTO_LIMITS.note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Home made, 3 rotis, less oil"
            className="type-body w-full resize-none rounded-field bg-surface-2 p-3 text-text-1 placeholder:text-text-3"
          />
          <PrimaryButton
            block
            onClick={() => void analyse()}
            icon={<Sparkles className="size-4" aria-hidden />}
          >
            Work it out
          </PrimaryButton>
          <SecondaryButton
            block
            compact
            onClick={() => gallery.current?.click()}
            icon={<RotateCcw className="size-4" aria-hidden />}
          >
            Use another photo
          </SecondaryButton>
        </>
      ) : null}

      {state.kind === 'asking' ? <Thinking /> : null}

      {state.kind === 'done' ? (
        <div className="flex flex-col gap-3" aria-live="polite" data-ai-result>
          {state.rows.length ? (
            <>
              <div className="ai-surface rounded-panel p-4">
                <AiByline className="mb-2" />
                <p className="type-answer text-text-1">
                  Found {state.rows.length} {state.rows.length === 1 ? 'food' : 'foods'} on your
                  plate. Adjust anything before you log it.
                </p>
              </div>
              <ul className="flex flex-col gap-2">
                {state.rows.map((r, i) => (
                  <AiItemRow
                    key={i}
                    portion={r.portion}
                    katoriMl={ctx.katoriMl}
                    confidence={r.item.confidence}
                    onChange={(next) =>
                      setState((st) =>
                        st.kind === 'done'
                          ? {
                              ...st,
                              rows: st.rows.map((x, j) => (j === i ? { ...x, portion: next } : x)),
                            }
                          : st,
                      )
                    }
                  />
                ))}
              </ul>
              <PrimaryButton block onClick={() => onFill(state.rows.map((r) => r.portion))}>
                Put on my plate
              </PrimaryButton>
            </>
          ) : (
            <p className="type-meta rounded-nested bg-surface-2 p-4 text-text-2">
              No food found in that photo. Try one taken from above, or type the meal instead.
            </p>
          )}
          {state.left !== null ? (
            <p className="type-caption text-text-3" data-photos-left>
              {state.left === 1 ? '1 photo' : `${state.left} photos`} left today.
            </p>
          ) : null}
          <SecondaryButton block compact onClick={() => gallery.current?.click()}>
            Try another photo
          </SecondaryButton>
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div className="flex flex-col gap-2" aria-live="polite" data-ai-result>
          <p className="type-meta rounded-nested bg-surface-2 p-4 text-text-2">{state.message}</p>
          {state.limit ? null : photo ? (
            <PrimaryButton block onClick={() => void analyse()}>
              Try again
            </PrimaryButton>
          ) : (
            pickButtons
          )}
          <SecondaryButton block compact onClick={onType}>
            Type or say it instead
          </SecondaryButton>
        </div>
      ) : null}

      <p className="type-caption text-text-3">
        The photo goes to a third-party AI service to work out the food, then it is gone: Overload
        does not keep it. Up to {PHOTOS_PER_DAY} photos a day.
      </p>
    </div>
  );
}
