import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  Barcode,
  Camera,
  Crown,
  Image as ImageIcon,
  PenLine,
  ScanText,
} from 'lucide-react';
import {
  InlineNotice,
  NumberField,
  PrimaryButton,
  SecondaryButton,
  SegmentedControl,
  TextField,
} from '@/components/kit';
import { askFoodLabel, editedPortion, FoodAiError, type LabelReading } from '@/app/foodAi';
import { BarcodeError, lookupBarcode, readBarcode } from '@/app/barcode';
import { isBarcode } from '@/domain/nutrition/off';
import type { FoodPortion } from '@/data/repositories/food';
import {
  dietFromName,
  labelAddsUp,
  labelPortion,
  type LabelColumn,
  type LabelNumbers,
} from '@/domain/nutrition/label';
import { LABEL_MAX_SIDE, preparePhoto } from '@/lib/photo';
import { CoachConsent } from '../coach/CoachParts';
import { useCoachStore } from '@/app/coach';

/**
 * A packaged food from its nutrition label. Pro can photograph the label: the AI only copies
 * the printed numbers, anything it cannot read is left empty, and nothing is guessed. Anyone
 * can type the numbers from the pack. Either way the person says how much they had (grams or
 * servings) and the app does the arithmetic.
 */
export function LabelLog({
  pro,
  initial,
  onFill,
}: {
  pro: boolean;
  /** Numbers already known (from a barcode), to check and use. */
  initial?: LabelReading | null;
  onFill: (items: FoodPortion[]) => void;
}) {
  const [reading, setReading] = useState<LabelReading | null | 'manual'>(initial ?? null);
  const [source, setSource] = useState<Source>(initial ? 'barcode' : 'label');
  if (reading === null)
    return (
      <Start
        pro={pro}
        onRead={(r, from) => {
          setSource(from);
          setReading(r);
        }}
      />
    );
  return (
    <LabelForm
      reading={reading === 'manual' ? null : reading}
      source={source}
      onFill={onFill}
      onRetake={() => setReading(null)}
    />
  );
}

type Source = 'label' | 'barcode';

type StartState =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'scanning' }
  | { kind: 'error'; message: string };

function Start({
  pro,
  onRead,
}: {
  pro: boolean;
  onRead: (r: LabelReading | 'manual', from: Source) => void;
}) {
  const store = useCoachStore();
  const [state, setState] = useState<StartState>({ kind: 'idle' });
  const [code, setCode] = useState('');
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const barcodePhoto = useRef<HTMLInputElement>(null);

  async function lookup(value: string) {
    setState({ kind: 'scanning' });
    try {
      onRead(await lookupBarcode(value), 'barcode');
    } catch (e) {
      setState({
        kind: 'error',
        message: e instanceof BarcodeError ? e.message : 'That barcode could not be looked up.',
      });
    }
  }

  async function scan(file: File | undefined) {
    if (!file) return;
    setState({ kind: 'scanning' });
    const found = await readBarcode(file).catch(() => null);
    if (!found) {
      setState({
        kind: 'error',
        message:
          'No barcode found in that photo. Fill the frame with the barcode, or type its number.',
      });
      return;
    }
    setCode(found);
    await lookup(found);
  }

  async function read(file: File | undefined) {
    if (!file) return;
    setState({ kind: 'reading' });
    try {
      const photo = await preparePhoto(file, LABEL_MAX_SIDE, 0.9);
      URL.revokeObjectURL(photo.url);
      const { label } = await askFoodLabel({ image: photo.data, mime: photo.mime });
      onRead(label, 'label');
    } catch (e) {
      setState({
        kind: 'error',
        message:
          e instanceof FoodAiError
            ? e.message
            : 'The label could not be read. Try again, or type the numbers.',
      });
    }
  }

  const input = (ref: React.RefObject<HTMLInputElement | null>, capture: boolean) => (
    <input
      ref={ref}
      {...(capture ? {} : { 'data-label-input': true })}
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

  return (
    <div className="flex flex-col gap-5" data-label-start>
      <section aria-labelledby="pack-barcode" className="flex flex-col gap-2">
        <h3 id="pack-barcode" className="type-headline text-text-1">
          Scan the barcode
        </h3>
        <p className="type-meta text-text-2">
          Free. Looks the product up in Open Food Facts, an open database of food labels. Only the
          barcode number is sent.
        </p>
        <input
          ref={barcodePhoto}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          data-barcode-input
          onChange={(e) => {
            void scan(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <PrimaryButton
          block
          icon={<Barcode className="size-4" aria-hidden />}
          onClick={() => barcodePhoto.current?.click()}
          loading={state.kind === 'scanning'}
          data-scan-barcode
        >
          Photograph the barcode
        </PrimaryButton>
        <form
          className="grid grid-cols-[1fr_auto] items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (isBarcode(code)) void lookup(code.trim());
          }}
        >
          <TextField
            label="Or type the barcode number"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 14))}
            placeholder="8901234567890"
          />
          <SecondaryButton
            type="submit"
            disabled={!isBarcode(code) || state.kind === 'scanning'}
            data-lookup-barcode
          >
            Look up
          </SecondaryButton>
        </form>
      </section>

      <section aria-labelledby="pack-label" className="flex flex-col gap-2">
        <h3 id="pack-label" className="type-headline text-text-1">
          Or read the label
        </h3>
        <p className="type-meta text-text-2">
          Photograph only the nutrition table, flat and in good light, so every number is sharp.
        </p>
        {pro && store.consent ? (
          <div className="grid grid-cols-2 gap-2">
            {input(camera, true)}
            {input(gallery, false)}
            <SecondaryButton
              icon={<Camera className="size-4" aria-hidden />}
              onClick={() => camera.current?.click()}
              loading={state.kind === 'reading'}
              data-label-camera
            >
              Take photo
            </SecondaryButton>
            <SecondaryButton
              icon={<ImageIcon className="size-4" aria-hidden />}
              onClick={() => gallery.current?.click()}
              disabled={state.kind === 'reading'}
              data-label-gallery
            >
              Choose photo
            </SecondaryButton>
          </div>
        ) : pro ? (
          <CoachConsent />
        ) : (
          <Link
            to="/pro"
            className="pressable chrome flex items-center gap-3 rounded-nested bg-surface-2 p-4"
          >
            <ScanText className="size-5 shrink-0 text-text-2" aria-hidden />
            <span className="type-meta min-w-0 flex-1 text-text-2">
              Reading the label from a photo is part of Pro.
            </span>
            <Crown className="size-4 text-text-2" aria-hidden />
          </Link>
        )}
        <SecondaryButton
          block
          icon={<PenLine className="size-4" aria-hidden />}
          onClick={() => onRead('manual', 'label')}
          data-label-manual
        >
          Type the numbers from the pack
        </SecondaryButton>
      </section>
      {state.kind === 'reading' || state.kind === 'scanning' ? (
        <p className="type-meta text-text-2" aria-live="polite">
          {state.kind === 'reading' ? 'Reading the label…' : 'Looking up the barcode…'}
        </p>
      ) : null}
      {state.kind === 'error' ? (
        <InlineNotice icon={<AlertCircle />}>
          <span data-label-error>{state.message}</span>
        </InlineNotice>
      ) : null}
    </div>
  );
}

const EMPTY: LabelNumbers = { kcal: null, proteinG: null, carbsG: null, fatG: null, fibreG: null };
const fromReading = (v: LabelReading['per100']): LabelNumbers =>
  v
    ? { kcal: v.kcal, proteinG: v.proteinG, carbsG: v.carbsG, fatG: v.fatG, fibreG: v.fibreG }
    : EMPTY;

function LabelForm({
  reading,
  source,
  onFill,
  onRetake,
}: {
  reading: LabelReading | null;
  source: Source;
  onFill: (items: FoodPortion[]) => void;
  onRetake?: () => void;
}) {
  const startColumn: LabelColumn =
    reading?.per100 || !reading?.perServing ? 'per100' : 'perServing';
  const [name, setName] = useState(
    [reading?.brand, reading?.product].filter(Boolean).join(' ').trim(),
  );
  const [column, setColumn] = useState<LabelColumn>(startColumn);
  const [values, setValues] = useState<Record<LabelColumn, LabelNumbers>>({
    per100: fromReading(reading?.per100 ?? null),
    perServing: fromReading(reading?.perServing ?? null),
  });
  const [servingG, setServingG] = useState<number | null>(reading?.servingG ?? null);
  const [unit, setUnit] = useState<'g' | 'serving'>(reading?.servingG ? 'serving' : 'g');
  const [amount, setAmount] = useState<number | null>(reading?.servingG ? 1 : null);
  const amountRef = useRef<HTMLDivElement>(null);

  // Read numbers fill the form; the person can change any of them.
  useEffect(() => {
    if (reading) amountRef.current?.scrollIntoView({ block: 'nearest' });
  }, [reading]);

  const v = values[column];
  const set = (k: keyof LabelNumbers) => (n: number | null) =>
    setValues((o) => ({ ...o, [column]: { ...o[column], [k]: n } }));
  const portion = labelPortion({ values: v, column, servingG, amount, unit });
  const unread = reading && (Object.keys(v) as (keyof LabelNumbers)[]).filter((k) => v[k] === null);
  const servingName = reading?.servingText ?? 'serving';

  return (
    <div className="flex flex-col gap-4" data-label-form>
      {reading ? (
        <p className="type-meta text-text-2" data-label-read>
          {source === 'barcode' ? 'From Open Food Facts.' : 'Read from your photo.'} Check each
          number against the pack
          {unread && unread.length
            ? source === 'barcode'
              ? '; the database does not have the empty ones, type them in'
              : '; empty ones could not be read, type them in'
            : ''}
          .
          {onRetake ? (
            <>
              {' '}
              <button
                type="button"
                className="font-semibold text-text-1 underline"
                onClick={onRetake}
              >
                Start again
              </button>
            </>
          ) : null}
        </p>
      ) : null}
      <TextField
        label="Product"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="For example: MuscleBlaze Biozyme whey"
        maxLength={60}
      />
      <SegmentedControl<LabelColumn>
        label="The numbers below are"
        block
        value={column}
        onChange={setColumn}
        options={[
          { value: 'per100', label: 'Per 100 g' },
          { value: 'perServing', label: 'Per serving' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Calories"
          value={v.kcal}
          onValueChange={set('kcal')}
          min={0}
          max={column === 'per100' ? 900 : 3000}
          unit="kcal"
        />
        <NumberField
          label="Protein"
          value={v.proteinG}
          onValueChange={set('proteinG')}
          min={0}
          max={column === 'per100' ? 100 : 500}
          unit="g"
        />
        <NumberField
          label="Carbs"
          value={v.carbsG}
          onValueChange={set('carbsG')}
          min={0}
          max={column === 'per100' ? 100 : 500}
          unit="g"
        />
        <NumberField
          label="Fat"
          value={v.fatG}
          onValueChange={set('fatG')}
          min={0}
          max={column === 'per100' ? 100 : 500}
          unit="g"
        />
        <NumberField
          label="Fibre"
          value={v.fibreG}
          onValueChange={set('fibreG')}
          min={0}
          max={column === 'per100' ? 100 : 500}
          unit="g"
        />
        <NumberField
          label="Serving size"
          value={servingG}
          onValueChange={setServingG}
          min={1}
          max={2000}
          unit="g"
        />
      </div>
      {!labelAddsUp(v) ? (
        <InlineNotice icon={<AlertCircle />}>
          <span data-label-check>
            These calories do not match the protein, carbs and fat. Check them against the pack.
          </span>
        </InlineNotice>
      ) : null}

      <div ref={amountRef} className="flex flex-col gap-2">
        <h3 className="type-headline text-text-1">How much did you have?</h3>
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <NumberField
            label="Amount"
            value={amount}
            onValueChange={setAmount}
            min={0.1}
            max={unit === 'g' ? 5000 : 50}
            unit={unit === 'g' ? 'g or ml' : servingG ? `× ${servingName}` : 'servings'}
          />
          <SegmentedControl<'g' | 'serving'>
            label="Measured in"
            value={unit}
            onChange={setUnit}
            options={[
              { value: 'g', label: 'Grams' },
              { value: 'serving', label: 'Servings' },
            ]}
          />
        </div>
        {unit === 'serving' && !servingG && column === 'per100' ? (
          <p className="type-meta text-text-2">
            Add the serving size from the pack to count servings.
          </p>
        ) : null}
        {unit === 'g' && !servingG && column === 'perServing' ? (
          <p className="type-meta text-text-2">Add the serving size from the pack to use grams.</p>
        ) : null}
      </div>

      {portion ? (
        <p className="type-headline tabular text-text-1" data-label-result>
          {portion.kcal} kcal · {portion.proteinG} g protein
          <span className="type-meta ml-2 text-text-2">
            {portion.carbsG} g carbs · {portion.fatG} g fat
          </span>
        </p>
      ) : null}
      <PrimaryButton
        block
        disabled={!portion || !name.trim()}
        onClick={() =>
          portion &&
          onFill([
            editedPortion(
              name.trim(),
              dietFromName(name),
              portion,
              'label',
              !reading
                ? 'Typed from the label'
                : source === 'barcode'
                  ? 'From Open Food Facts'
                  : 'Read from the label',
            ),
          ])
        }
        data-label-add
      >
        Put on my plate
      </PrimaryButton>
      <p className="type-caption text-text-3">
        Logged foods are saved as your own, so next time you can find this product by name.
      </p>
    </div>
  );
}
