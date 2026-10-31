import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  BottomSheet,
  NumberField,
  PrimaryButton,
  SearchField,
  SegmentedControl,
  Stepper,
  TextField,
} from '@/components/kit';
import { useToast } from '@/components/ui/Toast';
import { db } from '@/data/db';
import { RECIPE_INGREDIENTS, recipePer100 } from '@/data/library/foods';
import { FoodError, saveCustomFood } from '@/data/repositories/food';
import type { CustomFood } from '@/domain/models/schemas';
import { normalize } from '@/domain/exercises/search';
import { phonetic } from '@/domain/nutrition/search';
import { fillMacros } from '@/domain/nutrition/fillMacros';
import { NutrientLine } from './PortionEditor';

type Mode = 'recipe' | 'label';
type Basis = 'serving' | 'per100';
type LabelKey = 'kcal' | 'proteinG' | 'carbsG' | 'fatG' | 'fibreG';

const LABEL_FIELDS: [LabelKey, string, string][] = [
  ['kcal', 'Calories', 'kcal'],
  ['proteinG', 'Protein', 'g'],
  ['carbsG', 'Carbs', 'g'],
  ['fatG', 'Fat', 'g'],
  ['fibreG', 'Fibre', 'g'],
];

/**
 * A food of their own: a family recipe made once for the whole pot (each person then logs a
 * share), or a packaged food from its label.
 */
export function CustomFoodSheet({
  open,
  onClose,
  initialName,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  editing?: CustomFood | null;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={editing ? `Edit ${editing.name}` : 'Add your own'}
      subtitle="A family recipe, or a packaged food from its label"
      wide
    >
      {open ? (
        <CustomFoodForm
          initialName={initialName ?? ''}
          editing={editing ?? null}
          onDone={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function CustomFoodForm({
  initialName,
  editing,
  onDone,
}: {
  initialName: string;
  editing: CustomFood | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(editing?.kind === 'food' ? 'label' : 'recipe');
  const [name, setName] = useState(editing?.name ?? initialName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recipe
  const [lines, setLines] = useState<{ id: string; grams: number | null }[]>(
    editing?.ingredients?.map((l) => ({ id: l.id, grams: l.grams })) ?? [],
  );
  const [servings, setServings] = useState(editing?.servings ?? 4);
  const [cookedG, setCookedG] = useState<number | null>(editing?.cookedG ?? null);
  const [q, setQ] = useState('');

  // Label: typed for one serving (the usual way people know a food) or per 100 g.
  const [basis, setBasis] = useState<Basis>(editing?.kind === 'food' ? 'per100' : 'serving');
  const [label, setLabel] = useState({
    kcal: editing?.kind === 'food' ? editing.kcal : null,
    proteinG: editing?.kind === 'food' ? editing.proteinG : null,
    carbsG: editing?.kind === 'food' ? editing.carbsG : null,
    fatG: editing?.kind === 'food' ? editing.fatG : null,
    fibreG: editing?.kind === 'food' ? editing.fibreG : null,
  } as Record<LabelKey, number | null>);
  const [pieceG, setPieceG] = useState<number | null>(editing?.pieceG ?? null);
  // Carbs and fat the person has typed themselves are never filled in for them.
  const [typed, setTyped] = useState<Set<LabelKey>>(
    () => new Set(editing?.kind === 'food' ? (['carbsG', 'fatG'] as LabelKey[]) : []),
  );
  const [filled, setFilled] = useState(false);
  const setField = (key: LabelKey) => (v: number | null) => {
    const now = new Set(typed).add(key);
    setTyped(now);
    setLabel((x) => {
      const next = { ...x, [key]: v };
      if ((key === 'kcal' || key === 'proteinG') && !(now.has('carbsG') && now.has('fatG'))) {
        const m = fillMacros(next.kcal, next.proteinG);
        if (m) {
          if (!now.has('carbsG')) next.carbsG = m.carbsG;
          if (!now.has('fatG')) next.fatG = m.fatG;
          setFilled(true);
        }
      }
      return next;
    });
  };
  const servingMissing = mode === 'label' && basis === 'serving' && !(pieceG && pieceG > 0);

  const matches = useMemo(() => {
    const words = normalize(q).split(' ').filter(Boolean).map(phonetic);
    if (!words.length) return [];
    return RECIPE_INGREDIENTS.filter((i) => {
      const t = normalize(i.name).split(' ').map(phonetic);
      return words.every((w) => t.some((x) => x.startsWith(w)));
    }).slice(0, 6);
  }, [q]);

  const valid = lines.filter((l): l is { id: string; grams: number } => (l.grams ?? 0) > 0);
  const preview = valid.length ? recipePer100(valid, cookedG) : null;
  const share = preview ? preview.cookedG / servings : null;

  async function save() {
    setError(null);
    if (servingMissing) {
      setError('Enter how many grams one serving weighs.');
      return;
    }
    setBusy(true);
    // Saved per 100 g, the way every food is kept.
    const per100 = (v: number | null) =>
      v === null ? null : basis === 'serving' && pieceG ? (v * 100) / pieceG : v;
    try {
      await saveCustomFood(
        db,
        mode === 'recipe'
          ? { name, recipe: { ingredients: valid, cookedG, servings } }
          : {
              name,
              pieceG,
              per100: {
                kcal: per100(label.kcal) ?? NaN,
                proteinG: per100(label.proteinG) ?? 0,
                carbsG: per100(label.carbsG) ?? 0,
                fatG: per100(label.fatG) ?? 0,
                fibreG: per100(label.fibreG) ?? 0,
              },
            },
        editing?.id,
      );
      toast(`Saved ${name.trim()}`);
      onDone();
    } catch (e) {
      setError(e instanceof FoodError ? e.message : 'Could not save. Try again.');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {editing ? null : (
        <SegmentedControl<Mode>
          label="What are you adding"
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: 'recipe', label: 'Family recipe' },
            { value: 'label', label: 'From a label' },
          ]}
        />
      )}
      <TextField
        label="Name"
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        placeholder={mode === 'recipe' ? 'Mum’s rajma' : 'Protein bar'}
      />

      {mode === 'recipe' ? (
        <>
          <div>
            <p className="type-meta mb-1.5 text-text-2">
              Raw ingredients for the whole pot, in grams
            </p>
            <ul className="flex flex-col gap-2">
              {lines.map((l, i) => {
                const ing = RECIPE_INGREDIENTS.find((x) => x.id === l.id);
                return (
                  <li key={`${l.id}-${i}`} className="flex items-end gap-2">
                    <NumberField
                      label={ing?.name ?? l.id}
                      value={l.grams}
                      onValueChange={(grams) =>
                        setLines((list) => list.map((x, j) => (j === i ? { ...x, grams } : x)))
                      }
                      allowDecimal
                      min={0}
                      max={10000}
                      unit="g"
                      className="flex-1"
                    />
                    <button
                      type="button"
                      aria-label={`Remove ${ing?.name ?? l.id}`}
                      onClick={() => setLines((list) => list.filter((_, j) => j !== i))}
                      className="pressable tap-target mb-2 inline-flex size-9 items-center justify-center rounded-full text-text-2"
                    >
                      <Trash2 className="size-5" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
            <SearchField
              label="Add an ingredient"
              value={q}
              onChange={setQ}
              placeholder="Toor dal, onion, ghee…"
              className="mt-2"
            />
            {matches.length ? (
              <ul className="mt-1 flex flex-wrap gap-2">
                {matches.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="pressable chrome type-meta h-9 rounded-full bg-surface-2 px-3 font-semibold text-text-1"
                      onClick={() => {
                        setLines((list) => [...list, { id: m.id, grams: null }]);
                        setQ('');
                      }}
                    >
                      {m.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <NumberField
            label="Cooked weight of the pot (optional)"
            value={cookedG}
            onValueChange={setCookedG}
            min={1}
            max={20000}
            unit="g"
            error={undefined}
          />
          <p className="type-meta -mt-2 text-text-2">
            Weigh the pot after cooking and take away the empty pot. Without it the raw weight is
            used.
          </p>
          <div className="flex items-center justify-between gap-3">
            <span className="type-headline text-text-1">Feeds</span>
            <Stepper
              label="People it feeds"
              value={servings}
              onChange={setServings}
              min={1}
              max={50}
              step={1}
              size="headline"
              format={(v) => `${v} ${v === 1 ? 'person' : 'people'}`}
            />
          </div>
          {preview && share ? (
            <div className="rounded-nested bg-surface-2 p-4">
              <p className="type-meta text-text-2">One share, {Math.round(share)} g:</p>
              <NutrientLine
                kcal={(preview.per100.kcal * share) / 100}
                proteinG={(preview.per100.proteinG * share) / 100}
                carbsG={(preview.per100.carbsG * share) / 100}
                fatG={(preview.per100.fatG * share) / 100}
              />
            </div>
          ) : null}
        </>
      ) : (
        <>
          <NumberField
            label={basis === 'serving' ? 'One serving' : 'One serving (optional)'}
            value={pieceG}
            onValueChange={setPieceG}
            allowDecimal
            min={1}
            max={2000}
            unit="g"
            data-serving-g
          />
          <SegmentedControl<Basis>
            label="The numbers are for"
            block
            value={basis}
            onChange={setBasis}
            options={[
              { value: 'serving', label: 'One serving' },
              { value: 'per100', label: 'Per 100 g' },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            {LABEL_FIELDS.map(([key, title, unit]) => (
              <NumberField
                key={key}
                label={title}
                value={label[key]}
                onValueChange={setField(key)}
                allowDecimal
                min={0}
                max={
                  basis === 'serving' ? (key === 'kcal' ? 9000 : 1000) : key === 'kcal' ? 900 : 100
                }
                unit={unit}
              />
            ))}
          </div>
          <p className="type-caption -mt-1 text-text-2" data-macros-hint>
            {filled
              ? 'Carbs and fat follow your calories and protein. Change them if you know them.'
              : 'Type the calories and protein; carbs and fat are filled in for you.'}
          </p>
        </>
      )}

      {error ? (
        <p role="alert" className="type-meta text-danger-text">
          {error}
        </p>
      ) : null}
      <PrimaryButton block loading={busy} onClick={() => void save()}>
        Save
      </PrimaryButton>
    </div>
  );
}
